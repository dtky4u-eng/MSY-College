import { prisma } from "@/lib/db";
import { notFound, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseJson } from "@/lib/json";
import { questionUpdateSchema } from "@/components/admin/core/learning/schemas";
import { resequenceQuestions } from "@/components/admin/core/learning/server";

/** Edit a question. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) throw notFound("Question not found");
  const body = await parseBody(req, questionUpdateSchema);
  const data = { text: body.text, options: JSON.stringify(body.options), correctIndex: body.correctIndex, marks: body.marks, explanation: body.explanation };
  await prisma.question.update({ where: { id }, data });

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (q.text !== data.text) changes.text = { from: q.text.slice(0, 120), to: data.text.slice(0, 120) };
  if (q.options !== data.options) changes.options = { from: parseJson<string[]>(q.options, []), to: body.options };
  if (q.correctIndex !== data.correctIndex) changes.correctIndex = { from: q.correctIndex, to: data.correctIndex };
  if (q.marks !== data.marks) changes.marks = { from: q.marks, to: data.marks };
  if ((q.explanation ?? null) !== data.explanation) changes.explanation = { from: q.explanation, to: data.explanation };
  if (Object.keys(changes).length) await audit(auth.user.id, "CONTENT", "Question", id, { action: "UPDATE", quizId: q.quizId, changes });
  return { id };
});

/** Delete a question. */
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) throw notFound("Question not found");
  await prisma.question.delete({ where: { id } });
  await resequenceQuestions(q.quizId);
  await audit(auth.user.id, "CONTENT", "Question", id, { action: "DELETE", quizId: q.quizId, text: q.text.slice(0, 120) });
  return { deleted: true };
});
