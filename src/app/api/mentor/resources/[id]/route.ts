import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { requireMentor } from "@/lib/auth";
import { deleteStoredFile, saveUpload } from "@/lib/files";
import { LIMITS } from "@/lib/constants";
import { checkSource, readResourceForm, TYPE_KINDS } from "../_shared";

async function ownResource(domainId: string, id: string) {
  const r = await prisma.resource.findFirst({ where: { id, chapter: { module: { domainId } } } });
  if (!r) throw new ApiError(404, "Resource not found in your domain");
  return r;
}

/** Edit a resource (multipart). A new file replaces the old one; removeFile=true drops it. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const { mentor, auth } = await requireMentor("api");
  const existing = await ownResource(mentor.domainId, id);
  const { data, file } = await readResourceForm(req);
  const keepFile = !file && !data.removeFile && Boolean(existing.fileId) && TYPE_KINDS[data.type].length > 0;
  checkSource(data.type, { url: data.url, content: data.content, hasFile: Boolean(file) || keepFile });
  if (keepFile && existing.fileId) {
    // make sure the kept file is still a valid kind for a changed type
    const f = await prisma.fileObject.findUnique({ where: { id: existing.fileId } });
    const ext = f?.path.split(".").pop() ?? "";
    if (!TYPE_KINDS[data.type].includes(ext as never)) throw new ApiError(422, "The current file does not match this resource type — upload a new file", { file: "Upload a file that matches the resource type" });
  }
  const stored = file
    ? await saveUpload(file, { purpose: "RESOURCE", allowed: TYPE_KINDS[data.type], maxBytes: LIMITS.resourceBytes, ownerUserId: auth.user.id, label: "Resource file" })
    : null;
  const updated = await prisma.$transaction(async (tx) => {
    if (data.primary) await tx.resource.updateMany({ where: { chapterId: existing.chapterId, primary: true, id: { not: id } }, data: { primary: false } });
    return tx.resource.update({
      where: { id },
      data: {
        title: data.title,
        type: data.type,
        url: data.type === "NOTES" || data.type === "PDF" ? null : data.url,
        content: data.type === "NOTES" ? data.content : null,
        fileId: stored ? stored.id : keepFile ? existing.fileId : null,
        sortOrder: data.sortOrder,
        primary: data.primary,
        downloadable: data.downloadable,
      },
    });
  });
  if (existing.fileId && updated.fileId !== existing.fileId) await deleteStoredFile(existing.fileId);
  return updated;
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const { mentor } = await requireMentor("api");
  const existing = await ownResource(mentor.domainId, id);
  await prisma.resource.delete({ where: { id } });
  await deleteStoredFile(existing.fileId);
  return { deleted: true };
});
