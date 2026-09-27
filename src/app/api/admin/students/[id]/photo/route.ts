import { prisma } from "@/lib/db";
import { ApiError, formFile, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { KIND_SETS, deleteStoredFile, fileUrl, saveUpload } from "@/lib/files";
import { LIMITS } from "@/lib/constants";
import { audit } from "@/lib/audit";
import { findStudentOr404 } from "../../_helpers";

/** Replace the student's photo (JPG/PNG/WEBP up to 2 MB, magic-byte checked — FR-ADM-6, NFR-6). Multipart: file. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const auth = await requireApiRole("ADMIN");
  const { id } = await params;
  const s = await findStudentOr404(id);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "Upload the photo as multipart form data");
  }
  const file = formFile(form, "file");
  if (!file) throw new ApiError(422, "Choose a photo to upload", { file: "Choose a photo to upload" });

  let saved;
  try {
    saved = await saveUpload(file, {
      purpose: "PHOTO",
      allowed: KIND_SETS.image,
      maxBytes: LIMITS.imageBytes,
      studentId: s.id,
      ownerUserId: s.userId,
      label: "Photo",
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 422) throw new ApiError(422, e.message, { file: e.message });
    throw e;
  }
  await prisma.student.update({ where: { id: s.id }, data: { photoFileId: saved.id } });
  if (s.photoFileId && s.photoFileId !== saved.id) await deleteStoredFile(s.photoFileId);
  await audit(auth.user.id, "STUDENT_UPDATE", "Student", s.id, {
    section: "PHOTO",
    changes: { photoFileId: { from: s.photoFileId, to: saved.id } },
    fileName: saved.originalName,
    size: saved.size,
  });
  return { photoFileId: saved.id, url: fileUrl(saved.id) };
});

/** Remove the student's photo. */
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const auth = await requireApiRole("ADMIN");
  const { id } = await params;
  const s = await findStudentOr404(id);
  if (!s.photoFileId) throw new ApiError(409, "This student has no photo to remove");
  await prisma.student.update({ where: { id: s.id }, data: { photoFileId: null } });
  await deleteStoredFile(s.photoFileId);
  await audit(auth.user.id, "STUDENT_UPDATE", "Student", s.id, { section: "PHOTO", changes: { photoFileId: { from: s.photoFileId, to: null } } });
  return { photoFileId: null };
});
