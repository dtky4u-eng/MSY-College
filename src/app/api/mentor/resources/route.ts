import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { requireMentor } from "@/lib/auth";
import { saveUpload } from "@/lib/files";
import { LIMITS } from "@/lib/constants";
import { mentorChapter } from "@/app/mentor/_lib/scope";
import { checkSource, readResourceForm, TYPE_KINDS } from "./_shared";

/** Add a chapter resource in the mentor's own domain (FR-MEN-2). */
export const POST = route(async (req) => {
  const { mentor, auth } = await requireMentor("api");
  const { data, file, chapterId } = await readResourceForm(req);
  if (!chapterId) throw new ApiError(422, "Choose a chapter");
  const chapter = await mentorChapter(mentor, chapterId);
  checkSource(data.type, { url: data.url, content: data.content, hasFile: Boolean(file) });
  const stored = file
    ? await saveUpload(file, { purpose: "RESOURCE", allowed: TYPE_KINDS[data.type], maxBytes: LIMITS.resourceBytes, ownerUserId: auth.user.id, label: "Resource file" })
    : null;
  const created = await prisma.$transaction(async (tx) => {
    if (data.primary) await tx.resource.updateMany({ where: { chapterId: chapter.id, primary: true }, data: { primary: false } });
    return tx.resource.create({
      data: {
        chapterId: chapter.id,
        title: data.title,
        type: data.type,
        url: data.type === "NOTES" || data.type === "PDF" ? null : data.url,
        content: data.type === "NOTES" ? data.content : null,
        fileId: stored?.id ?? null,
        sortOrder: data.sortOrder,
        primary: data.primary,
        downloadable: data.downloadable,
        createdById: auth.user.id,
      },
    });
  });
  return created;
});
