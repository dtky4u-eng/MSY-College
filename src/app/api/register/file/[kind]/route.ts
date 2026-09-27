import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { readStoredFile } from "@/lib/files";
import { requireRegStudent } from "@/lib/registration";

/**
 * Preview of the student's own uploaded document during registration. The student is not signed in
 * yet, so access is authorised by the registration cookie (NFR-11) instead of /api/files.
 */
export const GET = route<{ kind: string }>(async (_req, { params }) => {
  const { kind } = await params;
  const student = await requireRegStudent();
  const fileId = kind === "photo" ? student.photoFileId : kind === "admit-card" ? student.admitCardFileId : undefined;
  if (fileId === undefined) throw new ApiError(404, "Unknown document");
  if (!fileId) throw new ApiError(404, "Not uploaded yet");
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
  // The id comes from the student's own record, so the file belongs to them.
  if (!file) throw new ApiError(404, "Not uploaded yet");
  const buf = await readStoredFile(file);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `inline; filename="${file.originalName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
