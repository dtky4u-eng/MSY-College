// Payment orchestration (WF-1, FR-REG-2, NFR-3).
// • The server picks the gateway (Razorpay, Cashfree, or the built-in sandbox when no keys are configured).
// • Activation happens only after server-side verification (signature / order status / webhook).
// • Activation is idempotent: repeated verifies or webhooks never double-issue receipts or registration numbers.
// • No card data ever touches this server.
import "server-only";
import crypto from "node:crypto";
import type { Payment } from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../http";
import { newPortalRegNo, newReceiptNo, newTransactionId } from "../ids";
import { notify } from "../notify";
import { audit } from "../audit";
import { sendMail } from "../mail";
import { formatINR } from "../format";
import { getSetting, type PaymentSettings } from "../settings";
import { parseJson } from "../json";
import * as razorpay from "./razorpay";
import * as cashfree from "./cashfree";

export type LiveGateway = "RAZORPAY" | "CASHFREE" | "SANDBOX";

export type CheckoutPayload =
  | {
      gateway: "RAZORPAY";
      paymentId: string;
      keyId: string;
      orderId: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      prefill: { name: string; email: string; contact: string };
    }
  | { gateway: "CASHFREE"; paymentId: string; orderId: string; paymentSessionId: string; mode: "sandbox" | "production" }
  | { gateway: "SANDBOX"; paymentId: string; orderId: string; checkoutUrl: string; amount: number };

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** Gateway selection rule: admin setting / env PAYMENT_GATEWAY; "auto" = Razorpay if configured, else Cashfree, else sandbox. */
export async function selectGateway(): Promise<LiveGateway> {
  const setting = await getSetting<PaymentSettings>("payments", { gateway: "auto" });
  const pref = (setting.gateway !== "auto" ? setting.gateway : process.env.PAYMENT_GATEWAY || "auto").toLowerCase();
  if (pref === "razorpay" && razorpay.configured()) return "RAZORPAY";
  if (pref === "cashfree" && cashfree.configured()) return "CASHFREE";
  if (pref === "sandbox") return "SANDBOX";
  if (razorpay.configured()) return "RAZORPAY";
  if (cashfree.configured()) return "CASHFREE";
  return "SANDBOX";
}

export function gatewayStatus() {
  return { razorpay: razorpay.configured(), cashfree: cashfree.configured(), sandbox: true };
}

/** Create (or reuse) a gateway order for a locked, unpaid registration. */
export async function createOrderForStudent(studentId: string): Promise<{ payment: Payment; checkout: CheckoutPayload }> {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { domain: true, college: true } });
  if (student.paymentStatus === "PAID") throw new ApiError(409, "Payment already completed. Please sign in.");
  if (!student.registrationLocked) throw new ApiError(409, "Please review and confirm your registration before payment.");
  if (!student.domainId || !student.feeAmount) throw new ApiError(409, "Please select an internship domain first.");

  const gateway = await selectGateway();
  const amount = student.feeAmount;

  // Idempotent retry: reuse a recent open order for the same gateway and amount.
  const recent = await prisma.payment.findFirst({
    where: { studentId, gateway, amount, status: "CREATED", createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
  });

  let payment = recent;
  let cashfreeSession: string | null = recent ? parseJson<{ paymentSessionId?: string }>(recent.raw, {}).paymentSessionId ?? null : null;

  if (!payment || (gateway === "CASHFREE" && !cashfreeSession)) {
    const transactionId = newTransactionId();
    let orderId: string;
    let raw: Record<string, unknown> = {};
    if (gateway === "RAZORPAY") {
      const order = await razorpay.createOrder({ amount, receipt: transactionId, notes: { studentId, regNo: student.registrationNumber } });
      orderId = order.id;
      raw = { order };
    } else if (gateway === "CASHFREE") {
      // Cashfree order_id = our transactionId; the return page looks the payment up by it.
      const order = await cashfree.createOrder({
        orderId: transactionId,
        amount,
        customer: { id: student.studentCode, name: student.name, email: student.email ?? "", phone: student.mobile ?? "" },
        returnUrl: `${appUrl()}/register/payment/return?gateway=cashfree&order_id={order_id}`,
      });
      orderId = order.order_id;
      cashfreeSession = order.payment_session_id;
      raw = { paymentSessionId: order.payment_session_id };
    } else {
      orderId = `sbx_order_${crypto.randomBytes(8).toString("hex")}`;
    }
    payment = await prisma.payment.create({
      data: { transactionId, studentId, gateway, orderId, amount, status: "CREATED", raw: JSON.stringify(raw) },
    });
  }

  let checkout: CheckoutPayload;
  if (gateway === "RAZORPAY") {
    checkout = {
      gateway,
      paymentId: payment.id,
      keyId: process.env.RAZORPAY_KEY_ID!,
      orderId: payment.orderId!,
      amount,
      currency: "INR",
      name: "MSY College Internship",
      description: `${student.domain?.name ?? "Internship"} — internship fee`,
      prefill: { name: student.name, email: student.email ?? "", contact: student.mobile ?? "" },
    };
  } else if (gateway === "CASHFREE") {
    checkout = { gateway, paymentId: payment.id, orderId: payment.orderId!, paymentSessionId: cashfreeSession!, mode: cashfree.mode() };
  } else {
    checkout = { gateway, paymentId: payment.id, orderId: payment.orderId!, checkoutUrl: `/pay/sandbox/${payment.id}`, amount };
  }
  return { payment, checkout };
}

export interface VerifyInput {
  paymentId: string;
  orderId?: string;
  gatewayPaymentId?: string;
  signature?: string;
}

export type VerifyResult = { status: "SUCCESS" | "PENDING" | "FAILED" | "VERIFY_FAILED" | "CREATED" | "REFUNDED"; payment: Payment; message?: string };

/** Server-side verification after the client returns from checkout. */
export async function verifyPayment(input: VerifyInput): Promise<VerifyResult> {
  const payment = await prisma.payment.findUnique({ where: { id: input.paymentId } });
  if (!payment) throw new ApiError(404, "Payment not found");
  if (payment.status === "SUCCESS") return { status: "SUCCESS", payment };

  if (payment.gateway === "RAZORPAY") {
    if (!input.gatewayPaymentId || !input.signature || input.orderId !== payment.orderId) {
      return fail(payment, "VERIFY_FAILED", "Missing or mismatched payment details from the gateway");
    }
    if (!razorpay.verifySignature(payment.orderId!, input.gatewayPaymentId, input.signature)) {
      return fail(payment, "VERIFY_FAILED", "Signature verification failed", input.gatewayPaymentId);
    }
    const rp = await razorpay.fetchPayment(input.gatewayPaymentId).catch(() => null);
    if (rp && rp.status === "authorized") {
      const p = await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "PENDING", gatewayPaymentId: input.gatewayPaymentId, gatewaySignature: input.signature, method: rp.method ?? null },
      });
      return { status: "PENDING", payment: p, message: "Payment received, awaiting confirmation" };
    }
    if (rp && rp.status === "failed") return fail(payment, "FAILED", rp.error_description || "Payment failed", input.gatewayPaymentId);
    const p = await markPaymentSuccess(payment.id, { gatewayPaymentId: input.gatewayPaymentId, signature: input.signature, method: rp?.method ?? null, raw: rp });
    return { status: "SUCCESS", payment: p };
  }

  if (payment.gateway === "CASHFREE") return refreshCashfree(payment);

  if (payment.gateway === "SANDBOX") {
    if (!input.gatewayPaymentId || !input.signature || input.orderId !== payment.orderId) {
      return fail(payment, "VERIFY_FAILED", "Missing or mismatched payment details from the gateway");
    }
    if (!timingSafeEq(sandboxSign(payment.orderId!, input.gatewayPaymentId), input.signature)) {
      return fail(payment, "VERIFY_FAILED", "Signature verification failed", input.gatewayPaymentId);
    }
    const sbx = parseJson<{ pendingUntil?: number; method?: string }>(payment.raw, {});
    if (sbx.pendingUntil && sbx.pendingUntil > Date.now()) {
      const p = await prisma.payment.update({ where: { id: payment.id }, data: { status: "PENDING", gatewayPaymentId: input.gatewayPaymentId, gatewaySignature: input.signature } });
      return { status: "PENDING", payment: p, message: "Payment received, awaiting confirmation" };
    }
    const p = await markPaymentSuccess(payment.id, { gatewayPaymentId: input.gatewayPaymentId, signature: input.signature, method: sbx.method ?? "upi" });
    return { status: "SUCCESS", payment: p };
  }

  return { status: payment.status as VerifyResult["status"], payment };
}

/** Poll the gateway for the latest state (used by "awaiting confirmation" screens and admin reconcile). */
export async function refreshPaymentStatus(paymentId: string): Promise<VerifyResult> {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (["SUCCESS", "REFUNDED", "FAILED"].includes(payment.status)) return { status: payment.status as VerifyResult["status"], payment };
  if (payment.gateway === "CASHFREE") return refreshCashfree(payment);
  if (payment.gateway === "RAZORPAY" && payment.orderId && razorpay.configured()) {
    const list = await razorpay.fetchOrderPayments(payment.orderId).catch(() => null);
    const captured = list?.items?.find((x) => x.status === "captured");
    if (captured) return { status: "SUCCESS", payment: await markPaymentSuccess(payment.id, { gatewayPaymentId: captured.id, method: captured.method, raw: captured }) };
    if (list?.items?.some((x) => x.status === "authorized")) return { status: "PENDING", payment, message: "Payment received, awaiting confirmation" };
    return { status: payment.status as VerifyResult["status"], payment };
  }
  if (payment.gateway === "SANDBOX" && payment.status === "PENDING") {
    const sbx = parseJson<{ pendingUntil?: number; method?: string }>(payment.raw, {});
    if (!sbx.pendingUntil || sbx.pendingUntil <= Date.now()) {
      return { status: "SUCCESS", payment: await markPaymentSuccess(payment.id, { gatewayPaymentId: payment.gatewayPaymentId, method: sbx.method ?? "upi" }) };
    }
    return { status: "PENDING", payment, message: "Payment received, awaiting confirmation" };
  }
  return { status: payment.status as VerifyResult["status"], payment };
}

async function refreshCashfree(payment: Payment): Promise<VerifyResult> {
  const order = await cashfree.fetchOrder(payment.orderId!);
  if (order.order_status === "PAID") {
    const pays = await cashfree.fetchOrderPayments(payment.orderId!).catch(() => []);
    const ok = pays.find((x) => x.payment_status === "SUCCESS");
    const p = await markPaymentSuccess(payment.id, { gatewayPaymentId: ok ? String(ok.cf_payment_id) : null, method: ok?.payment_group ?? null, raw: { order, payment: ok } });
    return { status: "SUCCESS", payment: p };
  }
  if (order.order_status === "ACTIVE") {
    const pays = await cashfree.fetchOrderPayments(payment.orderId!).catch(() => []);
    if (pays.some((x) => x.payment_status === "PENDING")) {
      const p = await prisma.payment.update({ where: { id: payment.id }, data: { status: "PENDING" } });
      return { status: "PENDING", payment: p, message: "Payment received, awaiting confirmation" };
    }
    const failed = pays.find((x) => x.payment_status === "FAILED");
    if (failed) return fail(payment, "FAILED", failed.payment_message || "Payment failed", String(failed.cf_payment_id));
    return { status: "CREATED", payment, message: "Payment not completed" };
  }
  return fail(payment, "FAILED", `Order ${order.order_status.toLowerCase()}`);
}

async function fail(payment: Payment, status: "FAILED" | "VERIFY_FAILED", reason: string, gatewayPaymentId?: string): Promise<VerifyResult> {
  const p = await prisma.payment.update({
    where: { id: payment.id },
    data: { status, failureReason: reason, ...(gatewayPaymentId ? { gatewayPaymentId } : {}) },
  });
  return {
    status,
    payment: p,
    message:
      status === "VERIFY_FAILED"
        ? `Payment could not be verified. If money was debited, contact support with payment ID ${gatewayPaymentId ?? p.transactionId}.`
        : reason,
  };
}

/** Activate the registration for a successful payment. Idempotent. */
export async function markPaymentSuccess(
  paymentId: string,
  data: {
    gatewayPaymentId?: string | null;
    signature?: string | null;
    method?: string | null;
    raw?: unknown;
    manual?: { actorId: string; reason: string };
  },
): Promise<Payment> {
  const current = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (current.status === "SUCCESS") return current;

  const receiptNo = await newReceiptNo();
  const updated = await prisma.payment.updateMany({
    where: { id: paymentId, status: { not: "SUCCESS" } },
    data: {
      status: "SUCCESS",
      paidAt: new Date(),
      receiptNo,
      receiptGeneratedAt: new Date(),
      failureReason: null,
      gatewayPaymentId: data.gatewayPaymentId ?? current.gatewayPaymentId,
      gatewaySignature: data.signature ?? current.gatewaySignature,
      method: data.method ?? current.method,
      ...(data.raw !== undefined ? { raw: JSON.stringify(data.raw) } : {}),
      ...(data.manual ? { manualReason: data.manual.reason, markedById: data.manual.actorId } : {}),
    },
  });
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (updated.count === 0) return payment; // raced with another verifier

  const student = await prisma.student.findUniqueOrThrow({ where: { id: payment.studentId }, include: { domain: true } });
  if (student.paymentStatus !== "PAID") {
    const portalRegNo = student.portalRegNo ?? (await newPortalRegNo());
    await prisma.student.update({
      where: { id: student.id },
      data: { paymentStatus: "PAID", nextStep: 7, registeredAt: new Date(), portalRegNo, registrationLocked: true },
    });
    if (student.userId) await prisma.user.update({ where: { id: student.userId }, data: { active: true } });
    await notify([student.userId], {
      kind: "PAYMENT",
      title: "Payment successful — welcome to MSY College!",
      body: `Your payment of ${formatINR(payment.amount)} is confirmed. Your MSY College Registration Number is ${portalRegNo}. Your internship start date will be announced soon.`,
      link: "/student/downloads",
    });
    if (student.email) {
      await sendMail({
        to: student.email,
        subject: "MSY College internship registration confirmed",
        text: `Dear ${student.name},\n\nWe have received your internship fee of ${formatINR(payment.amount)} for ${student.domain?.name ?? "your domain"}.\nReceipt: ${receiptNo}\nMSY College Registration Number: ${portalRegNo}\n\nYou can now sign in at ${appUrl()}/login with your username, email or registration number.\n\nTeam MSY College`,
      }).catch(() => undefined);
    }
  }
  if (data.manual) {
    await audit(data.manual.actorId, "PAYMENT_MARK_PAID", "Payment", paymentId, { reason: data.manual.reason, previousStatus: current.status, amount: payment.amount });
  }
  return payment;
}

// ── Sandbox gateway (local development / demos) ──

export function sandboxSign(orderId: string, gatewayPaymentId: string): string {
  const secret = process.env.SANDBOX_GATEWAY_SECRET || process.env.JWT_SECRET || "sandbox";
  return crypto.createHmac("sha256", secret).update(`${orderId}|${gatewayPaymentId}`).digest("hex");
}

function timingSafeEq(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export type SandboxOutcome = "success" | "failure" | "pending" | "tamper";

/**
 * Acts as the sandbox gateway's hosted checkout completing a payment. Returns what a real gateway
 * would hand back to the browser; the browser then calls verify like it would with Razorpay.
 */
export async function sandboxComplete(paymentId: string, outcome: SandboxOutcome, method = "upi") {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.gateway !== "SANDBOX") throw new ApiError(404, "Sandbox order not found");
  if (payment.status === "SUCCESS") throw new ApiError(409, "This order is already paid");
  const gatewayPaymentId = `sbx_pay_${crypto.randomBytes(7).toString("hex")}`;
  if (outcome === "failure") {
    await prisma.payment.update({ where: { id: paymentId }, data: { status: "FAILED", failureReason: "Payment declined by bank (sandbox)", gatewayPaymentId, method } });
    return { outcome, orderId: payment.orderId!, gatewayPaymentId, signature: null, error: "Payment declined by bank" };
  }
  const raw = { method, ...(outcome === "pending" ? { pendingUntil: Date.now() + 20_000 } : {}) };
  await prisma.payment.update({ where: { id: paymentId }, data: { raw: JSON.stringify(raw), method } });
  const signature = outcome === "tamper" ? sandboxSign(payment.orderId!, gatewayPaymentId + "x") : sandboxSign(payment.orderId!, gatewayPaymentId);
  return { outcome, orderId: payment.orderId!, gatewayPaymentId, signature, error: null };
}

// ── Webhooks ──

export async function handleRazorpayWebhook(rawBody: string, signature: string | null) {
  if (!razorpay.verifyWebhook(rawBody, signature)) throw new ApiError(400, "Invalid webhook signature");
  const evt = JSON.parse(rawBody) as { event: string; payload?: { payment?: { entity?: { id: string; order_id: string; method?: string; error_description?: string } } } };
  const entity = evt.payload?.payment?.entity;
  if (!entity?.order_id) return { ignored: true };
  const payment = await prisma.payment.findFirst({ where: { gateway: "RAZORPAY", orderId: entity.order_id } });
  if (!payment) return { ignored: true };
  if (evt.event === "payment.captured" || evt.event === "order.paid") {
    await markPaymentSuccess(payment.id, { gatewayPaymentId: entity.id, method: entity.method ?? null, raw: evt });
  } else if (evt.event === "payment.failed" && payment.status !== "SUCCESS") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: entity.error_description ?? "Payment failed", gatewayPaymentId: entity.id } });
  }
  return { handled: evt.event };
}

export async function handleCashfreeWebhook(rawBody: string, signature: string | null, timestamp: string | null) {
  if (!cashfree.verifyWebhook(rawBody, signature, timestamp)) throw new ApiError(400, "Invalid webhook signature");
  const evt = JSON.parse(rawBody) as { type: string; data?: { order?: { order_id: string } } };
  const orderId = evt.data?.order?.order_id;
  if (!orderId) return { ignored: true };
  const payment = await prisma.payment.findFirst({ where: { gateway: "CASHFREE", orderId } });
  if (!payment) return { ignored: true };
  await refreshCashfree(payment); // always re-read the authoritative order status
  return { handled: evt.type };
}
