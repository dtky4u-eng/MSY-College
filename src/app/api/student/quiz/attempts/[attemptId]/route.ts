import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { parseJson } from "@/lib/json";
import { requireActiveStudent, requireAnyStudent } from "@/app/student/_lib/server";
import { SUBMIT_GRACE_MS, closeExpiredAttempts, resultPayload, sanitizeAnswers } from "@/app/student/_lib/quiz";

/** View the result of a submitted attempt (read-only; available in every access state). */
export const GET = route<{ attemptId: string }>(async (_req, { params }) => {
  const { attemptId } = await params;
  const { student, t } = await requireAnyStudent();
  const found = await prisma.quizAttempt.findFirst({ where: { id: attemptId, studentId: student.id } });
  if (!found) throw new ApiError(404, t("quiz.err.attemptNotFound"));
  await closeExpiredAttempts(found.quizId, student.id);
  const attempt = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { quiz: { include: { questions: true } } } });
  if (!attempt.submittedAt) throw new ApiError(409, t("quiz.err.notSubmitted"));
  return resultPayload(attempt, attempt.quiz, attempt.quiz.questions);
});

const saveSchema = z.object({ answers: z.record(z.string(), z.number().int().min(0).max(50)) });

/** Autosave answers of an open attempt so "Continue" restores them. Rejected after the timer runs out. */
export const PATCH = route<{ attemptId: string }>(async (req, { params }) => {
  const { attemptId } = await params;
  const { student, t } = await requireActiveStudent();
  const body = await parseBody(req, saveSchema);
  const attempt = await prisma.quizAttempt.findFirst({ where: { id: attemptId, studentId: student.id }, include: { quiz: { include: { questions: true } } } });
  if (!attempt) throw new ApiError(404, t("quiz.err.attemptNotFound"));
  if (attempt.submittedAt) throw new ApiError(409, t("quiz.err.alreadySubmitted"));
  if (attempt.expiresAt && Date.now() > attempt.expiresAt.getTime() + SUBMIT_GRACE_MS) throw new ApiError(409, t("quiz.err.expired"));
  const order = parseJson<string[]>(attempt.questionOrder, []);
  const answers = sanitizeAnswers(body.answers, order, attempt.quiz.questions);
  await prisma.quizAttempt.update({ where: { id: attempt.id }, data: { answers: JSON.stringify(answers) } });
  return { saved: Object.keys(answers).length };
});
