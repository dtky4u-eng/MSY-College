// Cashfree Payment Gateway adapter (PG Orders API, x-api-version 2023-08-01).
import "server-only";
import crypto from "node:crypto";
import { ApiError } from "../http";

export const configured = () => Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
export const mode = (): "sandbox" | "production" => (process.env.CASHFREE_ENV === "production" ? "production" : "sandbox");
const base = () => (mode() === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg");

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(base() + path, {
    ...init,
    headers: {
      "x-client-id": process.env.CASHFREE_APP_ID ?? "",
      "x-client-secret": process.env.CASHFREE_SECRET_KEY ?? "",
      "x-api-version": "2023-08-01",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[cashfree]", path, res.status, body);
    throw new ApiError(502, "Payment gateway is unavailable. Please try again in a moment.");
  }
  return body as T;
}

export function createOrder(input: {
  orderId: string;
  amount: number; // paise
  customer: { id: string; name: string; email: string; phone: string };
  returnUrl: string;
}) {
  return call<{ order_id: string; payment_session_id: string; order_status: string }>("/orders", {
    method: "POST",
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: input.amount / 100,
      order_currency: "INR",
      customer_details: {
        customer_id: input.customer.id.replace(/[^\w-]/g, "_"),
        customer_name: input.customer.name,
        customer_email: input.customer.email || undefined,
        customer_phone: input.customer.phone || "9999999999",
      },
      order_meta: { return_url: input.returnUrl },
    }),
  });
}

export const fetchOrder = (orderId: string) =>
  call<{ order_id: string; order_status: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "TERMINATION_REQUESTED" }>(`/orders/${encodeURIComponent(orderId)}`);

export const fetchOrderPayments = (orderId: string) =>
  call<{ cf_payment_id: string | number; payment_status: "SUCCESS" | "PENDING" | "FAILED" | "USER_DROPPED" | "NOT_ATTEMPTED"; payment_group?: string; payment_message?: string }[]>(
    `/orders/${encodeURIComponent(orderId)}/payments`,
  );

/** x-webhook-signature = base64(HMAC_SHA256(timestamp + rawBody, secret)) */
export function verifyWebhook(rawBody: string, signature: string | null, timestamp: string | null) {
  if (!signature || !timestamp || !process.env.CASHFREE_SECRET_KEY) return false;
  const expected = crypto.createHmac("sha256", process.env.CASHFREE_SECRET_KEY).update(timestamp + rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
