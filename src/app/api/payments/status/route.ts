import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { refreshPaymentStatus } from "@/lib/payments";
import { assertPaymentAccess, paymentOutcome } from "@/lib/registration";

/** Latest payment state, re-read from the gateway when still open (polled by "awaiting confirmation"). */
export const GET = route(async (req) => {
  const paymentId = req.nextUrl.searchParams.get("paymentId")?.trim();
  if (!paymentId) throw new ApiError(422, "paymentId is required", { paymentId: "Required" });
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new ApiError(404, "Payment not found");
  await assertPaymentAccess(payment);
  rateLimit(`pay-status:${payment.id}`, 120, 10 * 60 * 1000);
  const result = await refreshPaymentStatus(payment.id);
  return paymentOutcome(result);
});
