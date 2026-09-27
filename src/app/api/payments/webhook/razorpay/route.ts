import { route } from "@/lib/http";
import { handleRazorpayWebhook } from "@/lib/payments";

/** Razorpay webhook (payment.captured / order.paid / payment.failed). Signature over the raw body. */
export const POST = route(async (req) => {
  const raw = await req.text();
  return handleRazorpayWebhook(raw, req.headers.get("x-razorpay-signature"));
});
