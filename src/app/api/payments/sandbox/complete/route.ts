import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { sandboxComplete } from "@/lib/payments";
import { assertPaymentAccess } from "@/lib/registration";

const schema = z.object({
  paymentId: z.string().trim().min(1),
  outcome: z.enum(["success", "failure", "pending", "tamper"]),
  method: z.enum(["upi", "card", "netbanking"]).default("upi"),
});

/** Sandbox hosted checkout completing a test payment (no real money). */
export const POST = route(async (req) => {
  const body = await parseBody(req, schema);
  const payment = await prisma.payment.findUnique({ where: { id: body.paymentId } });
  if (!payment || payment.gateway !== "SANDBOX") throw new ApiError(404, "Sandbox order not found");
  await assertPaymentAccess(payment);
  return sandboxComplete(payment.id, body.outcome, body.method);
});
