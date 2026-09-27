"use client";
import Link from "next/link";
import { ArrowLeft, Award, Clock, CreditCard, Landmark, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { formatINR } from "@/lib/format";
import { useT } from "@/components/i18n";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import type { RegState } from "./types";
import { resultUrl, useCheckout } from "./use-checkout";

export function StepPayment({ state, goTo, onSessionExpired }: { state: RegState; goTo: (n: number) => void; onSessionExpired: () => void }) {
  const t = useT();
  const s = state.student;
  const domain = state.domains.find((d) => d.id === s.domainId);
  const amount = s.feeAmount ?? domain?.fee ?? 0;
  const { pay, busy, error } = useCheckout({ onSessionExpired });
  const last = state.lastPayment;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Card>
        <div className="border-b border-slate-100 px-5 py-5 sm:px-8">
          <h2 className="text-xl font-bold text-slate-900">{t("reg.pay.title")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("reg.pay.desc")}</p>
        </div>
        <div className="space-y-5 px-5 py-6 sm:px-8">
          {error && <Alert tone="error">{error}</Alert>}
          {!error && last && (last.status === "FAILED" || last.status === "VERIFY_FAILED") && (
            <Alert tone="warning">{t("reg.pay.previousFailed", { reason: last.failureReason ?? last.status })}</Alert>
          )}
          {!error && last?.status === "PENDING" && (
            <Alert
              tone="info"
              action={
                <ButtonLink href={resultUrl(last.id)} size="sm" variant="outline">
                  {t("reg.pay.checkStatus")}
                </ButtonLink>
              }
            >
              {t("reg.pay.previousPending")}
            </Alert>
          )}

          <div className="rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{t("reg.pay.summary")}</p>
              <Lock className="size-4 text-emerald-600" aria-hidden />
            </div>
            <dl className="divide-y divide-slate-100 text-sm">
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-slate-500">{t("reg.pay.student")}</dt>
                <dd className="text-right font-medium text-slate-900">
                  {s.name}
                  <span className="block font-mono text-xs font-normal text-slate-500">{s.registrationNumber}</span>
                </dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-slate-500">{t("reg.pay.domain")}</dt>
                <dd className="text-right font-medium text-slate-900">{domain?.name ?? "—"}</dd>
              </div>
              {domain && (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-slate-500">{t("reg.pay.duration")}</dt>
                  <dd className="flex flex-wrap justify-end gap-x-3 text-right text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" /> {t("reg.domain.hours", { n: domain.durationHours })}
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <Award className="size-3.5" /> {t("reg.domain.certificate")}
                    </span>
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-4 bg-slate-50/80 px-4 py-4">
                <dt className="font-semibold text-slate-900">{t("reg.pay.amount")}</dt>
                <dd className="text-2xl font-extrabold text-slate-900">{formatINR(amount)}</dd>
              </div>
            </dl>
          </div>

          <Button size="lg" className="h-14 w-full text-base" onClick={pay} loading={busy} icon={!busy ? <ShieldCheck className="size-5" /> : undefined}>
            {busy ? t("reg.pay.opening") : t("reg.pay.button", { amount: formatINR(amount) })}
          </Button>
          <div className="flex items-center justify-center gap-4 text-slate-400" aria-label={t("reg.pay.methods")}>
            <Smartphone className="size-5" />
            <CreditCard className="size-5" />
            <Landmark className="size-5" />
            <span className="text-xs text-slate-500">{t("reg.pay.methods")}</span>
          </div>
        </div>
        <div className="rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-8">
          <Button variant="ghost" onClick={() => goTo(5)} icon={<ArrowLeft className="size-4" />}>
            {t("reg.back")}
          </Button>
        </div>
      </Card>
      <div className="space-y-4">
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck className="size-4 text-emerald-600" /> {t("reg.pay.secure")}
          </p>
          <p className="mt-3 text-sm text-slate-600">{t("reg.pay.includes")}</p>
          <Link href="/refund-cancellation-policy" target="_blank" className="mt-3 inline-block text-xs font-semibold text-brand-600 hover:text-brand-700">
            {t("reg.pay.refundLink")} →
          </Link>
        </Card>
      </div>
    </div>
  );
}
