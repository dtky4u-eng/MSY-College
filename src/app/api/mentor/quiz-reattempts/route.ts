import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireMentor } from "@/lib/auth";
import { quizAttemptInfo } from "@/lib/student";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { assignedStudent } from "@/app/mentor/_lib/scope";

const schema = z.object({
  studentId: z.string().min(1),
  quizId: z.string().min(1),
  extraAttempts: z.number().int("Choose 1, 2 or 3 attempts").min(1, "Grant at least 1 attempt").max(3, "You can grant at most 3 attempts at a time"),
  reason: z.string().trim().min(5, "Enter a reason of at least 5 characters").max(500),
});

/** Grant extra quiz attempts to an assigned student whose attempts are exhausted (FR-MEN-4, WF-2). */
export const POST = route(async (req) => {
  const { mentor, auth } = await requireMentor("api");
  const body = await parseBody(req, schema);
  const student = await assignedStudent(mentor, body.studentId);
  const quiz = await prisma.quiz.findFirst({ where: { id: body.quizId, chapter: { module: { domainId: mentor.domainId } } }, include: { chapter: true } });
  if (!quiz) throw new ApiError(404, "Quiz not found in your domain");
  if (student.domainId !== mentor.domainId) throw new ApiError(409, "This student is not enrolled in your domain");
  const info = await quizAttemptInfo(quiz.id, student.id);
  if (!info) throw new ApiError(404, "Quiz not found");
  if (info.passed) throw new ApiError(409, "The student has already passed this quiz");
  if (info.attemptsRemaining > 0 || info.openAttemptId) throw new ApiError(409, "The student still has attempts remaining for this quiz");

  const grant = await prisma.quizReattemptGrant.create({
    data: { quizId: quiz.id, studentId: student.id, extraAttempts: body.extraAttempts, reason: body.reason, grantedById: auth.user.id },
  });
  await notify([student.userId], {
    title: "Quiz reattempt granted",
    body: `Your mentor granted ${body.extraAttempts} extra attempt${body.extraAttempts === 1 ? "" : "s"} for “${quiz.title}”.`,
    kind: "INFO",
    link: "/student/learning",
  });
  await audit(auth.user.id, "QUIZ_REATTEMPT", "Quiz", quiz.id, { studentId: student.id, extraAttempts: body.extraAttempts, reason: body.reason, by: "MENTOR" });
  return { id: grant.id };
});
