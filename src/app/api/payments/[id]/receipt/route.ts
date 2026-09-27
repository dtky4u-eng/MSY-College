import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { getAuth } from "@/lib/auth";
import { verifyRegToken, REG_COOKIE } from "@/lib/jwt";
import { renderReceipt } from "@/lib/pdf/documents";

/**
 * Payment receipt PDF. Access: the student (signed in, or still holding the registration cookie right after payment),
 * their college and admin.
 */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    select: { studentId: true, student: { select: { userId: true, college: { select: { adminUserId: true } } } } },
  });
  if (!payment) throw new ApiError(404, "Payment not found");
  const auth = await getAuth();
  const reg = await verifyRegToken(req.cookies.get(REG_COOKIE)?.value);
  const u = auth?.user;
  const allowed =
    (u && (u.role === "ADMIN" || (u.role === "STUDENT" && payment.student.userId === u.id) || (u.role === "COLLEGE" && payment.student.college.adminUserId === u.id))) ||
    reg?.studentId === payment.studentId;
  if (!allowed) throw new ApiError(auth ? 403 : 401, "You do not have access to this receipt");
  const doc = await renderReceipt(id);
  return new Response(new Uint8Array(doc.bytes), {
    headers: { "Content-Type": doc.mime, "Content-Disposition": `attachment; filename="${doc.filename}"`, "Cache-Control": "no-store" },
  });
});
