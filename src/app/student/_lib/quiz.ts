// Quiz engine for students (FR-STU-5). correctIndex / explanations never leave the server before submission.
import "server-only";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { parseJson } from "@/lib/json";
import { learningTree, markChapterComplete } from "@/lib/student";
import type { TFn } from "@/lib/i18n";
import type { Question, Quiz, QuizAttempt } from "@prisma/client";

export const SUBMIT_GRACE_MS = 10_000;

export type Answers = Record<string, number>;

export function gradeAttempt(order: string[], questions: Question[], answers: Answers) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  let score = 0;
  let maxScore = 0;
  for (const id of order) {
    const q = byId.get(id);
    if (!q) continue;
    maxScore += q.marks;
    if (answers[id] === q.correctIndex) score += q.marks;
  }
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0;
  return { score, maxScore, percent };
}

/** Keep only answers for questions in the attempt with a valid option index. */
export function sanitizeAnswers(raw: Record<string, unknown>, order: string[], questions: Question[]): Answers {
  const allowed = new Map(questions.filter((q) => order.includes(q.id)).map((q) => [q.id, parseJson<string[]>(q.options, []).length]));
  const out: Answers = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const n = allowed.get(k);
    if (n === undefined || typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= n) continue;
    out[k] = v;
  }
  return out;
}

/** Submit (or auto-close) an attempt. Passing completes the chapter. */
export async function finalizeAttempt(attempt: QuizAttempt, quiz: Quiz & { questions: Question[] }, answers: Answers, submittedAt: Date) {
  const order = parseJson<string[]>(attempt.questionOrder, []);
  const g = gradeAttempt(order, quiz.questions, answers);
  const passed = g.percent >= quiz.passingScore;
  const res = await prisma.quizAttempt.updateMany({
    where: { id: attempt.id, submittedAt: null },
    data: { answers: JSON.stringify(answers), score: g.score, maxScore: g.maxScore, percent: g.percent, passed, submittedAt },
  });
  if (res.count > 0 && passed) await markChapterComplete(attempt.studentId, quiz.chapterId, "QUIZ");
  return prisma.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
}

/** Timed attempts left open past expiry (+grace) are graded with the answers saved before expiry. */
export async function closeExpiredAttempts(quizId: string, studentId: string) {
  const now = Date.now();
  const stale = await prisma.quizAttempt.findMany({ where: { quizId, studentId, submittedAt: null, expiresAt: { not: null } } });
  const expired = stale.filter((a) => a.expiresAt && a.expiresAt.getTime() + SUBMIT_GRACE_MS < now);
  if (!expired.length) return;
  const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: quizId }, include: { questions: true } });
  for (const a of expired) await finalizeAttempt(a, quiz, parseJson<Answers>(a.answers, {}), a.expiresAt!);
}

/** Load a quiz for the signed-in student and verify it is reachable (domain, unlocked chapter, requirements). */
export async function loadQuizForStudent(quizId: string, student: { id: string; domainId: string | null }, t: TFn, opts: { requireRequirements?: boolean } = {}) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { orderBy: { sort: "asc" } }, chapter: { select: { id: true, module: { select: { domainId: true } } } } },
  });
  if (!quiz || !student.domainId || quiz.chapter.module.domainId !== student.domainId) throw new ApiError(404, t("quiz.err.notFound"));
  const tree = await learningTree(student.id, student.domainId);
  const node = tree.modules.flatMap((m) => m.chapters).find((c) => c.id === quiz.chapterId);
  if (!node || !node.unlocked) throw new ApiError(403, t("learn.err.locked"));
  if (opts.requireRequirements && !node.requirementsMet) throw new ApiError(409, t("quiz.err.requirements"));
  return { quiz, node };
}

/** Client-safe view of an in-progress attempt. */
export function attemptPayload(attempt: QuizAttempt, questions: Question[]) {
  const order = parseJson<string[]>(attempt.questionOrder, []);
  const byId = new Map(questions.map((q) => [q.id, q]));
  return {
    attemptId: attempt.id,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt?.toISOString() ?? null,
    serverNow: new Date().toISOString(),
    answers: parseJson<Answers>(attempt.answers, {}),
    questions: order
      .map((id) => byId.get(id))
      .filter((q): q is Question => Boolean(q))
      .map((q) => ({ id: q.id, text: q.text, options: parseJson<string[]>(q.options, []), marks: q.marks })),
  };
}

/** Result view; correct answers + explanations only when the quiz allows it. */
export function resultPayload(attempt: QuizAttempt, quiz: Quiz, questions: Question[]) {
  const order = parseJson<string[]>(attempt.questionOrder, []);
  const answers = parseJson<Answers>(attempt.answers, {});
  const byId = new Map(questions.map((q) => [q.id, q]));
  return {
    attemptId: attempt.id,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    score: attempt.score,
    maxScore: attempt.maxScore,
    percent: attempt.percent,
    passed: attempt.passed,
    passingScore: quiz.passingScore,
    showResult: quiz.showResult,
    answered: Object.keys(answers).length,
    total: order.length,
    review: quiz.showResult
      ? order
          .map((id) => byId.get(id))
          .filter((q): q is Question => Boolean(q))
          .map((q) => ({
            id: q.id,
            text: q.text,
            options: parseJson<string[]>(q.options, []),
            selected: answers[q.id] ?? null,
            correctIndex: q.correctIndex,
            correct: answers[q.id] === q.correctIndex,
            marks: q.marks,
            explanation: q.explanation,
          }))
      : null,
  };
}

export type AttemptPayload = ReturnType<typeof attemptPayload>;
export type ResultPayload = ReturnType<typeof resultPayload>;
