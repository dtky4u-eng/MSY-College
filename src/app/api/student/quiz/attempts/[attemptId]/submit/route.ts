import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { parseJson } from "@/lib/json";
import { requireActiveStudent } from "@/app/student/_lib/server";
import { SUBMIT_GRACE_MS, finalizeAttempt, resultPayload, sanitizeAnswers, type Answers } from "@/app/student/_lib/quiz";

const schema = z.object({ answers: z.record(z.string(), z.number().int().min(0).max(50)).default({}) });

/**
 * FR-STU-5: submit an attempt. Score = sum of marks of correct answers; passed = percent ≥ passing score.
 * For timed quizzes the server enforces expiresAt (10 s grace); a late submission is graded with the
 * answers autosaved before expiry.
 */
export const POST = route<{ attemptId: string }>(async (req, { params }) => {
  const { attemptId } = await params;
  const { student, t } = await requireActiveStudent();
  const body = await parseBody(req, schema);
  const attempt = await prisma.quizAttempt.findFirst({ where: { id: attemptId, studentId: student.id }, include: { quiz: { include: { questions: true } } } });
  if (!attempt) throw new ApiError(404, t("quiz.err.attemptNotFound"));
  if (attempt.submittedAt) throw new ApiError(409, t("quiz.err.alreadySubmitted"));

  const order = parseJson<string[]>(attempt.questionOrder, []);
  const now = new Date();
  const late = attempt.expiresAt ? now.getTime() > attempt.expiresAt.getTime() + SUBMIT_GRACE_MS : false;
  const answers: Answers = late ? parseJson<Answers>(attempt.answers, {}) : sanitizeAnswers(body.answers, order, attempt.quiz.questions);
  const done = await finalizeAttempt(attempt, attempt.quiz, answers, late && attempt.expiresAt ? attempt.expiresAt : now);
  if (!done.submittedAt) throw new ApiError(409, t("quiz.err.alreadySubmitted"));
  return { late, ...resultPayload(done, attempt.quiz, attempt.quiz.questions) };
});
