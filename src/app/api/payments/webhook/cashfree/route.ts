import { route } from "@/lib/http";
import { handleCashfreeWebhook } from "@/lib/payments";

/** Cashfree webhook. Signature = HMAC(timestamp + raw body); the order status is then re-read from Cashfree. */
export const POST = route(async (req) => {
  const raw = await req.text();
  return handleCashfreeWebhook(raw, req.headers.get("x-webhook-signature"), req.headers.get("x-webhook-timestamp"));
});
