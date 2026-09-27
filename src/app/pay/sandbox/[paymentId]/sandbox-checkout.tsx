"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, CheckCircle2, CreditCard, FlaskConical, Hourglass, Landmark, Lock, ShieldAlert, Smartphone, X, XCircle } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { formatINR } from "@/lib/format";
import { Logo } from "@/components/brand";
import { cn } from "@/components/ui/cn";

type Method = "upi" | "card" | "netbanking";
type Outcome = "success" | "failure" | "pending" | "tamper";

const METHODS: { id: Method; label: string; icon: React.ComponentType<{ className?: string }>; note: string }[] = [
  { id: "upi", label: "UPI", icon: Smartphone, note: "Simulates a UPI collect request approved in your UPI app." },
  { id: "card", label: "Card", icon: CreditCard, note: "Simulates a debit / credit card payment with 3-D Secure." },
  { id: "netbanking", label: "Netbanking", icon: Landmark, note: "Simulates a redirect to your bank's net banking page." },
];

const BANKS = ["State Bank of India", "HDFC Bank", "ICICI Bank", "Punjab National Bank", "Bank of Baroda", "Axis Bank"];

export function SandboxCheckout({
  payment,
  merchant,
}: {
  payment: {
    id: string;
    orderId: string;
    transactionId: string;
    amount: number;
    status: string;
    description: string;
    customer: { name: string; email: string; mobile: string };
  };
  merchant: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("upi");
  const [bank, setBank] = useState(BANKS[0]!);
  const [busy, setBusy] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultUrl = `/register/payment/return?paymentId=${encodeURIComponent(payment.id)}`;
  const paid = payment.status === "SUCCESS";

  const complete = async (outcome: Outcome) => {
    setBusy(outcome);
    setError(null);
    try {
      const r = await api<{ orderId: string; gatewayPaymentId: string; signature: string | null; error: string | null }>("/api/payments/sandbox/complete", {
        body: { paymentId: payment.id, outcome, method },
      });
      // Like a real gateway handler: hand the ids + signature back to the merchant for server-side verification.
      if (r.signature) {
        await api("/api/payments/verify", { body: { paymentId: payment.id, orderId: r.orderId, gatewayPaymentId: r.gatewayPaymentId, signature: r.signature } }).catch(() => undefined);
      }
      router.replace(resultUrl);
    } catch (e) {
      setBusy(null);
      if (e instanceof ApiClientError && e.status === 409) {
        router.replace(resultUrl);
        return;
      }
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const current = METHODS.find((m) => m.id === method)!;

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-center text-xs font-semibold text-amber-950 sm:text-sm">
        <FlaskConical className="size-4 shrink-0" />
        Sandbox · test mode · no real money is charged
      </div>

      <div className="mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-12">
        <div className="overflow-hidden rounded-2xl bg-white shadow-pop ring-1 ring-slate-200">
          {/* Merchant header */}
          <div className="flex items-center justify-between gap-3 bg-slate-900 px-5 py-4 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <Logo className="size-10 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{merchant}</p>
                <p className="truncate text-xs text-slate-400">{payment.description}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] tracking-wide text-slate-400 uppercase">Amount</p>
              <p className="text-xl font-bold">{formatINR(payment.amount, { decimals: true })}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-xs text-slate-500">
            <span>
              Order <span className="font-mono text-slate-700">{payment.orderId}</span>
            </span>
            <span className="truncate">
              {payment.customer.name}
              {payment.customer.mobile && <> · +91 {payment.customer.mobile}</>}
            </span>
          </div>

          {paid ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
              <p className="mt-3 text-lg font-semibold text-slate-900">This order is already paid</p>
              <Link href={resultUrl} className="mt-5 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
                View payment status
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-[200px_1fr]">
              {/* Methods */}
              <div className="flex gap-2 overflow-x-auto border-b border-slate-100 p-3 md:flex-col md:border-r md:border-b-0" role="tablist" aria-label="Payment method">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={method === m.id}
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      "flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors md:flex-none",
                      method === m.id ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <m.icon className="size-4" /> {m.label}
                  </button>
                ))}
              </div>

              <div className="space-y-5 p-5">
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <current.icon className="size-4 text-brand-600" /> {current.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{current.note}</p>
                  {method === "netbanking" && (
                    <label className="mt-3 block text-xs font-medium text-slate-600">
                      Bank
                      <select
                        value={bank}
                        onChange={(e) => setBank(e.target.value)}
                        className="mt-1 block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      >
                        {BANKS.map((b) => (
                          <option key={b}>{b}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Building2 className="size-3.5" /> No payment details are collected in sandbox mode.
                  </p>
                </div>

                {error && (
                  <p className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800" role="alert">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
                  </p>
                )}

                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => complete("success")}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy === "success" ? <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Lock className="size-4" />}
                  Pay {formatINR(payment.amount)} successfully
                </button>

                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Test other outcomes</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        { o: "failure", label: "Simulate failure", icon: XCircle, cls: "text-rose-700 hover:bg-rose-50 border-rose-200" },
                        { o: "pending", label: "Simulate pending", icon: Hourglass, cls: "text-amber-800 hover:bg-amber-50 border-amber-200" },
                        { o: "tamper", label: "Simulate verification failure", icon: ShieldAlert, cls: "text-violet-700 hover:bg-violet-50 border-violet-200" },
                      ] as const
                    ).map((b) => (
                      <button
                        key={b.o}
                        type="button"
                        disabled={busy !== null}
                        onClick={() => complete(b.o)}
                        className={cn("flex min-h-10 items-center justify-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-semibold disabled:opacity-60", b.cls)}
                      >
                        {busy === b.o ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <b.icon className="size-4" />}
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">Pending payments confirm automatically after about 20 seconds.</p>
                </div>

                <Link href="/register" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
                  <X className="size-3.5" /> Cancel and return to registration
                </Link>
              </div>
            </div>
          )}
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <Lock className="size-3.5" /> Secured sandbox checkout · Ref {payment.transactionId}
        </p>
      </div>
    </div>
  );
}
