import { conflict, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { refreshPaymentStatus } from "@/lib/payments";
import { loadPayment } from "../../_shared";

const RECONCILABLE = ["CREATED", "PENDING", "VERIFY_FAILED"];

/** Re-read the authoritative status from the gateway (WF-1 reconciliation). */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const p = await loadPayment(id);
  if (!RECONCILABLE.includes(p.status)) throw conflict("Only Created, Pending or Verification Failed payments can be reconciled.");
  let result: Awaited<ReturnType<typeof refreshPaymentStatus>>;
  try {
    result = await refreshPaymentStatus(id);
  } catch (e) {
    await audit(auth.user.id, "PAYMENT_EDIT", "Payment", id, { operation: "RECONCILE", previousStatus: p.status, error: e instanceof Error ? e.message : String(e) });
    throw conflict("The payment gateway could not be reached. Please try again in a few minutes.");
  }
  await audit(auth.user.id, "PAYMENT_EDIT", "Payment", id, { operation: "RECONCILE", previousStatus: p.status, newStatus: result.status });
  const changed = result.status !== p.status;
  return {
    status: result.status,
    changed,
    message: changed
      ? `Status updated from ${p.status.replace("_", " ").toLowerCase()} to ${result.status.replace("_", " ").toLowerCase()}.`
      : result.message ?? "The gateway reports no change for this payment.",
  };
});
