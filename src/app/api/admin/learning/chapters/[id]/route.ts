import { prisma } from "@/lib/db";
import { ApiError, notFound, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { chapterUpdateSchema } from "@/components/admin/core/learning/schemas";
import { assertChapterDeletable, deleteFiles, resourceFileIds, rethrowUnique } from "@/components/admin/core/learning/server";

/** Update a chapter. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const chapter = await prisma.chapter.findUnique({ where: { id } });
  if (!chapter) throw notFound("Chapter not found");
  const body = await parseBody(req, chapterUpdateSchema);
  const taken = `Chapter ${body.number} already exists in this module`;
  const clash = await prisma.chapter.findUnique({ where: { moduleId_number: { moduleId: chapter.moduleId, number: body.number } } });
  if (clash && clash.id !== id) throw new ApiError(409, taken, { number: taken });

  const data = {
    number: body.number,
    name: body.name,
    description: body.description,
    minWatchSeconds: Math.round(body.minWatchMinutes * 60),
    minReadSeconds: Math.round(body.minReadMinutes * 60),
  };
  await prisma.chapter.update({ where: { id }, data }).catch((e) => rethrowUnique(e, { number: { field: "number", message: taken } }));
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(data) as (keyof typeof data)[]) if (chapter[k] !== data[k]) changes[k] = { from: chapter[k], to: data[k] };
  if (Object.keys(changes).length) await audit(auth.user.id, "CONTENT", "Chapter", id, { action: "UPDATE", moduleId: chapter.moduleId, changes });
  return { id };
});

/** Delete a chapter (with its resources and quiz) when no learner activity depends on it. */
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const chapter = await prisma.chapter.findUnique({ where: { id }, include: { _count: { select: { resources: true } } } });
  if (!chapter) throw notFound("Chapter not found");
  await assertChapterDeletable(id);
  const files = await resourceFileIds({ id });
  await prisma.chapter.delete({ where: { id } });
  await deleteFiles(files);
  await audit(auth.user.id, "CONTENT", "Chapter", id, { action: "DELETE", moduleId: chapter.moduleId, number: chapter.number, name: chapter.name, resources: chapter._count.resources });
  return { deleted: true, moduleId: chapter.moduleId };
});
