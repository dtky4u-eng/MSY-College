import type { Metadata } from "next";
import { getLang } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/i18n";
import { RegisterShell } from "@/components/register/shell";
import { PaymentResult } from "@/components/register/payment-result";

export const metadata: Metadata = { title: "Payment Status", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Return / result page after checkout (FR-REG-2, WF-1). Razorpay and the sandbox land here with ?paymentId=,
 * Cashfree with ?gateway=cashfree&order_id=. The page verifies server-side and polls pending payments.
 */
export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.slice(0, 120) || undefined;
  };
  const lang = await getLang();
  return (
    <I18nProvider lang={lang}>
      <RegisterShell>
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
          <PaymentResult paymentId={one("paymentId")} orderId={one("gateway") === "cashfree" ? one("order_id") : undefined} />
        </div>
      </RegisterShell>
    </I18nProvider>
  );
}
