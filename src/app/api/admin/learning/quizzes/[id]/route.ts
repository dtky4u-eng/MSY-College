import { prisma } from "@/lib/db";
import { conflict, notFound, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { plural } from "@/components/admin/core/learning/shared";

/** Delete a chapter quiz and its questions — blocked once students have attempted it. */
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const quiz = await prisma.quiz.findUnique({ where: { id }, include: { _count: { select: { attempts: true, questions: true } } } });
  if (!quiz) throw notFound("Quiz not found");
  if (quiz._count.attempts > 0) {
    throw conflict(`This quiz has ${plural(quiz._count.attempts, "student attempt")} and cannot be deleted. Edit its questions or settings instead.`);
  }
  await prisma.quiz.delete({ where: { id } });
  await audit(auth.user.id, "CONTENT", "Quiz", id, { action: "DELETE", chapterId: quiz.chapterId, title: quiz.title, questions: quiz._count.questions });
  return { deleted: true };
});
