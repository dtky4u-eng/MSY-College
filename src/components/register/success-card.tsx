"use client";
import { useState } from "react";
import { Check, Copy, Download, LogIn, PartyPopper, Sparkles } from "lucide-react";
import { formatDateTime, formatINR } from "@/lib/format";
import { useT } from "@/components/i18n";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function CopyButton({ value }: { value: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          // clipboard not available (http / old browser) — ignore
        }
      }}
      className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-xs font-medium text-white hover:bg-white/25"
      aria-label={t("reg.res.copy")}
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {done ? t("reg.res.copied") : t("reg.res.copy")}
    </button>
  );
}

/** Celebratory registration-complete screen (FR-REG-3): portal number, receipt download, login. */
export function SuccessCard({
  name,
  portalRegNo,
  username,
  domainName,
  paymentId,
  transactionId,
  amount,
  receiptNo,
  paidAt,
}: {
  name: string;
  portalRegNo: string | null;
  username: string | null;
  domainName: string | null;
  paymentId: string | null;
  transactionId?: string | null;
  amount?: number | null;
  receiptNo?: string | null;
  paidAt?: string | null;
}) {
  const t = useT();
  return (
    <Card className="overflow-hidden">
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 px-6 pt-10 pb-8 text-center text-white sm:px-10">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <Sparkles className="absolute top-6 left-8 size-5 text-emerald-100/70" />
        <Sparkles className="absolute top-12 right-10 size-4 text-amber-200/80" />
        <div className="relative">
          <div className="mx-auto flex size-16 animate-slide-up items-center justify-center rounded-full bg-white text-emerald-600 shadow-lg shadow-emerald-900/20">
            <PartyPopper className="size-8" />
          </div>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{t("reg.res.successTitle")}</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-emerald-50">{t("reg.res.successDesc")}</p>
          {portalRegNo && (
            <div className="mx-auto mt-6 max-w-sm rounded-2xl bg-white/10 p-4 ring-1 ring-white/25 backdrop-blur">
              <p className="text-xs font-medium tracking-wide text-emerald-100 uppercase">{t("reg.res.regNo")}</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-wider sm:text-3xl" data-testid="portal-reg-no">
                {portalRegNo}
              </p>
              <div className="mt-2 flex justify-center">
                <CopyButton value={portalRegNo} />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-5 px-6 py-6 sm:px-10">
        <p className="text-center text-sm text-slate-600">{t("reg.res.regNoHint")}</p>
        <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
          {(
            [
              [t("reg.pay.student"), name],
              [t("reg.res.username"), username],
              [t("reg.pay.domain"), domainName],
              [t("reg.res.amountPaid"), amount != null ? formatINR(amount) : null],
              [t("reg.res.txn"), transactionId],
              [t("reg.res.receiptNo"), receiptNo],
              [t("reg.res.paidOn"), paidAt ? formatDateTime(paidAt) : null],
            ] as [string, string | null | undefined][]
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="truncate font-medium text-slate-900">{v}</dd>
              </div>
            ))}
        </dl>
        <div className="flex flex-col gap-3 sm:flex-row">
          {paymentId && (
            <ButtonLink href={`/api/payments/${paymentId}/receipt`} external variant="outline" size="lg" className="flex-1" icon={<Download className="size-4" />}>
              {t("reg.res.receipt")}
            </ButtonLink>
          )}
          <ButtonLink href="/login" size="lg" className="flex-1" icon={<LogIn className="size-4" />}>
            {t("reg.res.login")}
          </ButtonLink>
        </div>
        <p className="rounded-xl border border-brand-100 bg-brand-50/60 p-3 text-center text-xs text-brand-900">{t("reg.res.next")}</p>
      </div>
    </Card>
  );
}
