// Razorpay REST adapter (Orders API + Standard Checkout signature verification).
import "server-only";
import crypto from "node:crypto";
import { ApiError } from "../http";

const BASE = "https://api.razorpay.com/v1";

export const configured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

function authHeader() {
  return "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { Authorization: authHeader(), "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[razorpay]", path, res.status, body);
    throw new ApiError(502, "Payment gateway is unavailable. Please try again in a moment.");
  }
  return body as T;
}

export function createOrder(input: { amount: number; receipt: string; notes?: Record<string, string> }) {
  return call<{ id: string; amount: number; currency: string; status: string }>("/orders", {
    method: "POST",
    body: JSON.stringify({ amount: input.amount, currency: "INR", receipt: input.receipt.slice(0, 40), notes: input.notes ?? {} }),
  });
}

export interface RazorpayPayment {
  id: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  error_description?: string;
}

export const fetchPayment = (id: string) => call<RazorpayPayment>(`/payments/${encodeURIComponent(id)}`);
export const fetchOrderPayments = (orderId: string) => call<{ items: RazorpayPayment[] }>(`/orders/${encodeURIComponent(orderId)}/payments`);

function safeEq(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** razorpay_signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret) */
export function verifySignature(orderId: string, paymentId: string, signature: string) {
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "").update(`${orderId}|${paymentId}`).digest("hex");
  return safeEq(expected, signature);
}

export function verifyWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEq(expected, signature);
}
