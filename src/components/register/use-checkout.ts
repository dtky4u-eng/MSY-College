"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useT } from "@/components/i18n";
import type { CheckoutPayload } from "@/lib/payments";
import { errCode, errText, loadScript } from "./util";

type RazorpayResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void; on: (evt: string, cb: (r: unknown) => void) => void };
type CashfreeFactory = (o: { mode: "sandbox" | "production" }) => { checkout: (o: { paymentSessionId: string; redirectTarget: string }) => Promise<unknown> };

export const resultUrl = (paymentId: string) => `/register/payment/return?paymentId=${encodeURIComponent(paymentId)}`;

/**
 * Create (or reuse) the gateway order on the server, then hand off to the gateway the server picked:
 * Razorpay Checkout modal, Cashfree hosted checkout, or the local sandbox checkout page.
 */
export function useCheckout(opts: { onSessionExpired?: () => void } = {}) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onSessionExpired } = opts;

  const pay = useCallback(async () => {
    setBusy(true);
    setError(null);
    let checkout: CheckoutPayload;
    try {
      checkout = await api<CheckoutPayload>("/api/register/payment/create", { method: "POST" });
    } catch (e) {
      setBusy(false);
      const code = errCode(e);
      if (code === "PAID") return router.push("/login");
      if (code === "SESSION_EXPIRED") onSessionExpired?.();
      setError(errText(e, t));
      return;
    }

    try {
      if (checkout.gateway === "SANDBOX") {
        router.push(checkout.checkoutUrl);
        return;
      }
      if (checkout.gateway === "RAZORPAY") {
        await loadScript("https://checkout.razorpay.com/v1/checkout.js");
        const Razorpay = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
        if (!Razorpay) throw new Error("sdk");
        const c = checkout;
        const rzp = new Razorpay({
          key: c.keyId,
          amount: c.amount,
          currency: c.currency,
          name: c.name,
          description: c.description,
          order_id: c.orderId,
          prefill: c.prefill,
          theme: { color: "#4f46e5" },
          handler: async (r: RazorpayResponse) => {
            try {
              await api("/api/payments/verify", {
                body: { paymentId: c.paymentId, orderId: r.razorpay_order_id, gatewayPaymentId: r.razorpay_payment_id, signature: r.razorpay_signature },
              });
            } catch {
              // The result page re-reads the authoritative status and shows the right state.
            }
            router.push(resultUrl(c.paymentId));
          },
          modal: {
            ondismiss: () => {
              setBusy(false);
              setError(t("reg.pay.cancelled"));
            },
          },
        });
        rzp.open();
        return;
      }
      if (checkout.gateway === "CASHFREE") {
        await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js");
        const Cashfree = (window as unknown as { Cashfree?: CashfreeFactory }).Cashfree;
        if (!Cashfree) throw new Error("sdk");
        await Cashfree({ mode: checkout.mode }).checkout({ paymentSessionId: checkout.paymentSessionId, redirectTarget: "_self" });
        return;
      }
    } catch {
      setBusy(false);
      setError(t("reg.pay.sdkError"));
    }
  }, [router, t, onSessionExpired]);

  return { pay, busy, error, setError };
}
