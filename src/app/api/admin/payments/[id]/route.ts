import { z } from "zod";
import { prisma } from "@/lib/db";
import { conflict, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rupeesToPaise } from "@/lib/format";
import { REASON_MIN, loadPayment, paymentDetail } from "../_shared";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  await requireApiRole("ADMIN");
  return paymentDetail(id);
});

const editSchema = z.object({
  amount: z.coerce.number({ message: "Enter the amount in rupees" }).positive("Amount must be greater than zero").max(1_000_000, "Amount is too large"),
  method: z
    .string()
    .trim()
    .max(40, "Method is too long")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  reason: z.string().trim().min(REASON_MIN, `Reason must be at least ${REASON_MIN} characters`).max(500),
});

/** Edit amount / method of a CREATED payment (FR-ADM-9, NFR-4). */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, editSchema);
  const p = await loadPayment(id);
  if (p.status !== "CREATED") throw conflict("Only payments in the Created state can be edited.");
  const amount = rupeesToPaise(body.amount);
  if (amount === p.amount && (body.method ?? null) === (p.method ?? null)) throw conflict("Nothing to change — the amount and method are the same.");

  const updated = await prisma.payment.update({ where: { id }, data: { amount, method: body.method } });
  if (amount !== p.amount && p.student.paymentStatus !== "PAID") {
    await prisma.student.update({ where: { id: p.student.id }, data: { feeAmount: amount } });
  }
  await audit(auth.user.id, "PAYMENT_EDIT", "Payment", id, {
    reason: body.reason,
    before: { amount: p.amount, method: p.method },
    after: { amount: updated.amount, method: updated.method },
    studentFeeUpdated: amount !== p.amount && p.student.paymentStatus !== "PAID",
  });
  return { id };
});
