import { z } from "zod";
import { prisma } from "@/lib/db";
import { conflict, notFound, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { quizAttemptInfo } from "@/lib/student";

const schema = z.object({
  studentId: z.string().min(1, "Select a student"),
  quizId: z.string().min(1, "Select a quiz"),
  extraAttempts: z.coerce.number({ message: "Choose the number of extra attempts" }).int().min(1, "Grant at least 1 attempt").max(5, "Grant at most 5 attempts at a time"),
  reason: z.string().trim().min(5, "Reason must be at least 5 characters").max(500, "Reason must be 500 characters or fewer"),
});

/** Grant extra quiz attempts to a student whose attempts are exhausted (WF-2). */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, schema);
  const [student, quiz] = await Promise.all([
    prisma.student.findUnique({ where: { id: body.studentId }, select: { id: true, name: true, userId: true, domainId: true } }),
    prisma.quiz.findUnique({ where: { id: body.quizId }, include: { chapter: { select: { name: true, module: { select: { domainId: true } } } } } }),
  ]);
  if (!student) throw notFound("Student not found");
  if (!quiz) throw notFound("Quiz not found");
  if (quiz.chapter.module.domainId !== student.domainId) throw conflict("This quiz is not part of the student's domain.");
  const info = await quizAttemptInfo(quiz.id, student.id);
  if (info?.passed) throw conflict("The student has already passed this quiz.");

  const grant = await prisma.quizReattemptGrant.create({
    data: { quizId: quiz.id, studentId: student.id, extraAttempts: body.extraAttempts, reason: body.reason, grantedById: auth.user.id },
  });
  await notify([student.userId], {
    kind: "INFO",
    title: "Quiz reattempt granted",
    body: `You have been given ${body.extraAttempts} more attempt${body.extraAttempts > 1 ? "s" : ""} for the quiz "${quiz.title}" (${quiz.chapter.name}).`,
    link: "/student/learning",
  });
  await audit(auth.user.id, "QUIZ_REATTEMPT", "QuizReattemptGrant", grant.id, {
    studentId: student.id,
    student: student.name,
    quizId: quiz.id,
    quiz: quiz.title,
    extraAttempts: body.extraAttempts,
    reason: body.reason,
    attemptsUsedBefore: info?.attemptsUsed ?? 0,
  });
  return { id: grant.id };
});
