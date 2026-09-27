import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { learningTree, markChapterComplete } from "@/lib/student";
import { requireActiveStudent } from "@/app/student/_lib/server";

/** WF-2: "Mark Complete" — only for chapters without a quiz, once watch/read requirements are met. */
export const POST = route<{ chapterId: string }>(async (_req, { params }) => {
  const { chapterId } = await params;
  const { student, t } = await requireActiveStudent();
  if (!student.domainId) throw new ApiError(409, t("learn.err.noDomain"));
  const tree = await learningTree(student.id, student.domainId);
  const node = tree.modules.flatMap((m) => m.chapters).find((c) => c.id === chapterId);
  if (!node) throw new ApiError(404, t("learn.err.chapterNotFound"));
  if (!node.unlocked) throw new ApiError(403, t("learn.err.locked"));
  if (node.completed) return { completed: true, already: true };
  const quiz = await prisma.quiz.findUnique({ where: { chapterId }, select: { id: true } });
  if (quiz) throw new ApiError(409, t("learn.err.hasQuiz"));
  if (!node.requirementsMet) throw new ApiError(409, t("learn.err.requirements"));
  await markChapterComplete(student.id, chapterId, "MANUAL");
  return { completed: true };
});
