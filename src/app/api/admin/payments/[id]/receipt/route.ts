import { prisma } from "@/lib/db";
import { conflict, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { newReceiptNo } from "@/lib/ids";
import { loadPayment } from "../../_shared";

/** Generate or regenerate the receipt of a successful payment (FR-ADM-9). */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const p = await loadPayment(id);
  if (p.status !== "SUCCESS") throw conflict("Receipts can be generated only for successful payments.");
  const regenerated = Boolean(p.receiptNo);
  const receiptNo = p.receiptNo ?? (await newReceiptNo());
  const updated = await prisma.payment.update({ where: { id }, data: { receiptNo, receiptGeneratedAt: new Date() } });
  await audit(auth.user.id, "PAYMENT_RECEIPT", "Payment", id, { receiptNo, regenerated });
  return { receiptNo: updated.receiptNo, receiptGeneratedAt: updated.receiptGeneratedAt, downloadUrl: `/api/payments/${id}/receipt`, regenerated };
});
