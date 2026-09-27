import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { verifyPayment } from "@/lib/payments";
import { assertPaymentAccess, paymentOutcome } from "@/lib/registration";

const schema = z
  .object({
    paymentId: z.string().trim().min(1).optional(),
    orderId: z.string().trim().min(1).max(120).optional(),
    gatewayPaymentId: z.string().trim().max(120).optional(),
    signature: z.string().trim().max(256).optional(),
  })
  .refine((v) => v.paymentId || v.orderId, { message: "paymentId or orderId is required", path: ["paymentId"] });

/**
 * Server-side verification after checkout returns (NFR-3). Razorpay/sandbox: signature check;
 * Cashfree: authoritative order status (the return page may only know the order id).
 */
export const POST = route(async (req) => {
  const body = await parseBody(req, schema);
  const payment = body.paymentId
    ? await prisma.payment.findUnique({ where: { id: body.paymentId } })
    : await prisma.payment.findFirst({ where: { orderId: body.orderId, gateway: "CASHFREE" } });
  if (!payment) throw new ApiError(404, "Payment not found");
  await assertPaymentAccess(payment);
  rateLimit(`pay-verify:${payment.id}`, 30, 10 * 60 * 1000);

  const result = await verifyPayment({
    paymentId: payment.id,
    orderId: body.orderId ?? payment.orderId ?? undefined,
    gatewayPaymentId: body.gatewayPaymentId,
    signature: body.signature,
  });
  return paymentOutcome(result);
});
