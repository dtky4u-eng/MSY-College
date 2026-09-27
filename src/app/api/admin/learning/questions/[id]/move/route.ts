import { prisma } from "@/lib/db";
import { badRequest, notFound, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { moveSchema } from "@/components/admin/core/learning/schemas";
import { neighbourPosition, resequenceQuestions } from "@/components/admin/core/learning/server";

/** Move a question one place up or down within its quiz. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const { direction } = await parseBody(req, moveSchema);
  const q = await prisma.question.findUnique({ where: { id }, select: { quizId: true } });
  if (!q) throw notFound("Question not found");
  const rows = await prisma.question.findMany({ where: { quizId: q.quizId }, orderBy: [{ sort: "asc" }, { id: "asc" }], select: { id: true } });
  const position = neighbourPosition(rows, id, direction);
  if (position === null) throw badRequest(direction === "up" ? "This question is already first" : "This question is already last");
  await resequenceQuestions(q.quizId, id, position);
  await audit(auth.user.id, "CONTENT", "Question", id, { action: "REORDER", quizId: q.quizId, position });
  return { position };
});
