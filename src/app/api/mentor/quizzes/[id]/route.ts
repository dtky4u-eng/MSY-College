import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { requireMentor } from "@/lib/auth";
import { audit } from "@/lib/audit";

/** Delete a quiz in the mentor's domain (with its questions, attempts and grants). */
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const { mentor, auth } = await requireMentor("api");
  const quiz = await prisma.quiz.findFirst({ where: { id, chapter: { module: { domainId: mentor.domainId } } }, include: { _count: { select: { attempts: true } } } });
  if (!quiz) throw new ApiError(404, "Quiz not found in your domain");
  await prisma.quiz.delete({ where: { id } });
  await audit(auth.user.id, "CONTENT", "Quiz", id, { action: "delete", chapterId: quiz.chapterId, title: quiz.title, attempts: quiz._count.attempts });
  return { deleted: true };
});
