import { prisma } from "@/lib/db";
import { formFields, notFound, route, validate } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { resourceUpdateSchema } from "@/components/admin/core/learning/schemas";
import { deleteFiles, readForm, resequenceResources } from "@/components/admin/core/learning/server";
import { resolveSource } from "../_source";

/** Update a resource (multipart). Replacing or removing the file deletes the old stored file. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const resource = await prisma.resource.findUnique({ where: { id } });
  if (!resource) throw notFound("Resource not found");
  const form = await readForm(req);
  const body = validate(resourceUpdateSchema, formFields(form));
  const existing = resource.fileId ? await prisma.fileObject.findUnique({ where: { id: resource.fileId } }) : null;

  const src = await resolveSource(form, body, auth.user.id, existing);
  try {
    await prisma.$transaction(async (tx) => {
      if (body.primary && !resource.primary) {
        await tx.resource.updateMany({ where: { chapterId: resource.chapterId, primary: true, id: { not: id } }, data: { primary: false } });
      }
      await tx.resource.update({
        where: { id },
        data: {
          type: body.type,
          title: body.title,
          url: src.url,
          fileId: src.fileId,
          content: src.content,
          primary: body.primary,
          downloadable: body.downloadable,
        },
      });
    });
  } catch (e) {
    await deleteFiles([src.saved?.id]);
    throw e;
  }
  const fileReplaced = Boolean(resource.fileId && resource.fileId !== src.fileId);
  if (fileReplaced) await deleteFiles([resource.fileId]);
  if (body.sortOrder !== undefined && body.sortOrder !== resource.sortOrder) await resequenceResources(resource.chapterId, id, body.sortOrder);

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const after = { type: body.type, title: body.title, url: src.url, primary: body.primary, downloadable: body.downloadable };
  for (const k of Object.keys(after) as (keyof typeof after)[]) if (resource[k] !== after[k]) changes[k] = { from: resource[k], to: after[k] };
  if (resource.fileId !== src.fileId) changes.file = { from: existing?.originalName ?? null, to: src.saved?.originalName ?? null };
  if ((resource.content ?? null) !== src.content) changes.content = { from: "(previous notes)", to: src.content ? "(updated notes)" : null };
  if (body.sortOrder !== undefined && body.sortOrder !== resource.sortOrder) changes.sortOrder = { from: resource.sortOrder, to: body.sortOrder };
  if (Object.keys(changes).length) await audit(auth.user.id, "CONTENT", "Resource", id, { action: "UPDATE", chapterId: resource.chapterId, changes });
  return { id };
});

/** Delete a resource and its stored file. */
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const resource = await prisma.resource.findUnique({ where: { id } });
  if (!resource) throw notFound("Resource not found");
  await prisma.resource.delete({ where: { id } });
  await deleteFiles([resource.fileId]);
  await resequenceResources(resource.chapterId);
  await audit(auth.user.id, "CONTENT", "Resource", id, { action: "DELETE", chapterId: resource.chapterId, type: resource.type, title: resource.title });
  return { deleted: true };
});
