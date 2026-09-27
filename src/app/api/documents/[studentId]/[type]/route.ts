import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/constants";
import { renderStudentDocument } from "@/lib/pdf/documents";

/**
 * Render a student document as PDF.
 * Access: the student, their assigned mentor, admin; colleges may download certificates and marksheets (FR-COL-3, WF-4).
 */
export const GET = route<{ studentId: string; type: string }>(async (req, { params }) => {
  const { studentId, type: rawType } = await params;
  const type = rawType.toUpperCase().replace(/-/g, "_") as DocumentType;
  if (!DOCUMENT_TYPES.includes(type)) throw new ApiError(404, "Unknown document type");
  const auth = await requireApiRole();
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    select: { userId: true, college: { select: { adminUserId: true } }, mentor: { select: { userId: true } } },
  });
  if (!s) throw new ApiError(404, "Student not found");
  const u = auth.user;
  const allowed =
    u.role === "ADMIN" ||
    (u.role === "STUDENT" && s.userId === u.id) ||
    (u.role === "MENTOR" && s.mentor?.userId === u.id) ||
    (u.role === "COLLEGE" && s.college.adminUserId === u.id && (type === "CERTIFICATE" || type === "MARKSHEET"));
  if (!allowed) throw new ApiError(403, "You do not have access to this document");

  const doc = await renderStudentDocument(studentId, type, { force: u.role === "ADMIN" && req.nextUrl.searchParams.get("force") === "1" });
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new Response(new Uint8Array(doc.bytes), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${doc.filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
