import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { quizAttemptInfo } from "@/lib/student";
import { requireActiveStudent } from "@/app/student/_lib/server";
import { attemptPayload, closeExpiredAttempts, loadQuizForStudent } from "@/app/student/_lib/quiz";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** FR-STU-5: start a new attempt, or resume the open one with the same question order. */
export const POST = route<{ quizId: string }>(async (_req, { params }) => {
  const { quizId } = await params;
  const { student, t } = await requireActiveStudent();
  const { quiz } = await loadQuizForStudent(quizId, student, t, { requireRequirements: true });
  if (quiz.questions.length === 0) throw new ApiError(409, t("quiz.err.noQuestions"));

  await closeExpiredAttempts(quiz.id, student.id);
  const info = await quizAttemptInfo(quiz.id, student.id);
  if (!info) throw new ApiError(404, t("quiz.err.notFound"));

  if (info.openAttemptId) {
    const open = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: info.openAttemptId } });
    return { resumed: true, ...attemptPayload(open, quiz.questions), timeLimitMinutes: quiz.timeLimitMinutes, title: quiz.title };
  }
  if (info.passed) throw new ApiError(409, t("quiz.err.alreadyPassed"));
  if (info.attemptsRemaining <= 0) throw new ApiError(409, t("quiz.err.exhausted"));

  const ids = quiz.questions.map((q) => q.id);
  const now = new Date();
  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId: quiz.id,
      studentId: student.id,
      startedAt: now,
      expiresAt: quiz.timeLimitMinutes ? new Date(now.getTime() + quiz.timeLimitMinutes * 60_000) : null,
      questionOrder: JSON.stringify(quiz.randomize ? shuffle(ids) : ids),
    },
  });
  return { resumed: false, ...attemptPayload(attempt, quiz.questions), timeLimitMinutes: quiz.timeLimitMinutes, title: quiz.title };
});
