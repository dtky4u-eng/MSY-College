import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, conflict, parseBody, route } from "@/lib/http";
import { requireApiRole, revokeAllSessions } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { REASON_MIN, loadPayment } from "../../_shared";

const schema = z.object({
  reason: z.string().trim().min(REASON_MIN, `Reason must be at least ${REASON_MIN} characters`).max(500, "Reason is too long"),
  confirm: z.string().trim().min(1, "Type the transaction ID to confirm"),
});

/**
 * Record a refund (record-only — the money is returned from the gateway dashboard).
 * SUCCESS → REFUNDED; the student's registration becomes unpaid and their login is deactivated.
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, schema);
  const p = await loadPayment(id);
  if (p.status !== "SUCCESS") throw conflict("Only successful payments can be marked as refunded.");
  if (body.confirm !== p.transactionId) {
    throw new ApiError(422,"The confirmation does not match the transaction ID", { confirm: "Type the exact transaction ID" });
  }

  const note = `Refund recorded: ${body.reason}`;
  await prisma.payment.update({ where: { id }, data: { status: "REFUNDED", failureReason: note.slice(0, 500) } });
  const otherSuccess = await prisma.payment.count({ where: { studentId: p.studentId, status: "SUCCESS" } });
  let deactivated = false;
  if (otherSuccess === 0) {
    await prisma.student.update({ where: { id: p.student.id }, data: { paymentStatus: "UNPAID" } });
    if (p.student.userId) {
      await prisma.user.update({ where: { id: p.student.userId }, data: { active: false } });
      await revokeAllSessions(p.student.userId);
      deactivated = true;
    }
  }
  await audit(auth.user.id, "PAYMENT_REFUND", "Payment", id, {
    reason: body.reason,
    amount: p.amount,
    transactionId: p.transactionId,
    studentId: p.student.id,
    studentMarkedUnpaid: otherSuccess === 0,
    userDeactivated: deactivated,
  });
  return { id, status: "REFUNDED", deactivated };
});
