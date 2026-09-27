import { prisma } from "@/lib/db";
import { ApiError, formFields, route, validate } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { resourceCreateSchema } from "@/components/admin/core/learning/schemas";
import { deleteFiles, readForm, resequenceResources } from "@/components/admin/core/learning/server";
import { resolveSource } from "./_source";

/** Add a resource to a chapter (multipart: fields + optional `file`). */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const form = await readForm(req);
  const body = validate(resourceCreateSchema, formFields(form));
  const chapter = await prisma.chapter.findUnique({ where: { id: body.chapterId }, select: { id: true } });
  if (!chapter) throw new ApiError(422, "Chapter not found", { chapterId: "Chapter not found" });

  const src = await resolveSource(form, body, auth.user.id, null);
  let id: string;
  try {
    const last = await prisma.resource.aggregate({ where: { chapterId: chapter.id }, _max: { sortOrder: true } });
    id = await prisma.$transaction(async (tx) => {
      if (body.primary) await tx.resource.updateMany({ where: { chapterId: chapter.id, primary: true }, data: { primary: false } });
      const r = await tx.resource.create({
        data: {
          chapterId: chapter.id,
          type: body.type,
          title: body.title,
          url: src.url,
          fileId: src.fileId,
          content: src.content,
          sortOrder: (last._max.sortOrder ?? 0) + 1,
          primary: body.primary,
          downloadable: body.downloadable,
          createdById: auth.user.id,
        },
      });
      return r.id;
    });
  } catch (e) {
    await deleteFiles([src.saved?.id]);
    throw e;
  }
  await resequenceResources(chapter.id, id, body.sortOrder);
  await audit(auth.user.id, "CONTENT", "Resource", id, {
    action: "CREATE",
    chapterId: chapter.id,
    type: body.type,
    title: body.title,
    ...(src.saved ? { file: src.saved.originalName } : {}),
  });
  return { id };
});
