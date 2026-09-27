import { z } from "zod";
import { prisma } from "@/lib/db";
import { conflict, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { markPaymentSuccess } from "@/lib/payments";
import { REASON_MIN, loadPayment } from "../../_shared";

const MARKABLE = ["CREATED", "PENDING", "VERIFY_FAILED"];

const schema = z.object({
  reason: z.string().trim().min(REASON_MIN, `Reason must be at least ${REASON_MIN} characters`).max(500, "Reason is too long"),
  method: z
    .string()
    .trim()
    .max(40, "Method is too long")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  reference: z
    .string()
    .trim()
    .max(80, "Reference is too long")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

/** Manual "Mark Paid" with a mandatory reason (FR-ADM-9, WF-1). markPaymentSuccess() writes the audit entry. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, schema);
  const p = await loadPayment(id);
  if (!MARKABLE.includes(p.status)) throw conflict("Only Created, Pending or Verification Failed payments can be marked as paid.");
  const other = await prisma.payment.findFirst({ where: { studentId: p.studentId, status: "SUCCESS", id: { not: id } }, select: { transactionId: true } });
  if (other) throw conflict(`This student already has a successful payment (${other.transactionId}). Marking another one paid would double-charge the student.`);

  const reason = body.reference ? `${body.reason} [Ref: ${body.reference}]` : body.reason;
  const payment = await markPaymentSuccess(id, { manual: { actorId: auth.user.id, reason }, method: body.method ?? p.method ?? "manual" });
  return { id: payment.id, status: payment.status, receiptNo: payment.receiptNo };
});
