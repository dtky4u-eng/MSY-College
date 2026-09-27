import { prisma } from "@/lib/db";
import { ApiError, formFile, route } from "@/lib/http";
import { KIND_SETS, deleteStoredFile, fileUrl, saveUpload } from "@/lib/files";
import { LIMITS } from "@/lib/constants";
import { requireAnyStudent } from "@/app/student/_lib/server";
import { readMultipart } from "@/app/student/_lib/submissions";

/** G-5: real profile-photo upload (JPG/PNG/WEBP ≤ 2 MB) replacing the URL field; the old photo file is deleted. */
export const POST = route(async (req) => {
  const { auth, student, t } = await requireAnyStudent();
  const form = await readMultipart(req, t);
  const file = formFile(form, "photo");
  if (!file) throw new ApiError(422, t("profile.err.photoRequired"), { photo: t("profile.err.photoRequired") });
  const saved = await saveUpload(file, {
    purpose: "PHOTO",
    allowed: KIND_SETS.image,
    maxBytes: LIMITS.imageBytes,
    ownerUserId: auth.user.id,
    studentId: student.id,
    label: t("profile.photoLabel"),
  });
  const oldId = student.photoFileId;
  try {
    await prisma.student.update({ where: { id: student.id }, data: { photoFileId: saved.id } });
  } catch (e) {
    await deleteStoredFile(saved.id).catch(() => undefined);
    throw e;
  }
  if (oldId && oldId !== saved.id) {
    // Keep the file if something else (e.g. a college record) still points at it.
    const inUse = await prisma.student.count({ where: { OR: [{ photoFileId: oldId }, { admitCardFileId: oldId }] } });
    if (!inUse) await deleteStoredFile(oldId).catch(() => undefined);
  }
  return { fileId: saved.id, url: fileUrl(saved.id) };
});
