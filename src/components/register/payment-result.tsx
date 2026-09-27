"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertOctagon, ArrowLeft, Hourglass, Loader2, Mail, Phone, RefreshCw, RotateCcw, SearchX, XCircle } from "lucide-react";
import { api } from "@/lib/client/api";
import { ORG } from "@/lib/constants";
import { formatINR, formatTime } from "@/lib/format";
import { useT } from "@/components/i18n";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import type { PaymentOutcome } from "./types";
import { SuccessCard } from "./success-card";
import { useCheckout } from "./use-checkout";
import { errCode, errText } from "./util";

const POLL_MS = 5000;

function SupportBox({ id }: { id: string }) {
  const t = useT();
  const tel = ORG.phone.replace(/\s/g, "");
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{t("reg.res.contact")}</p>
      <p className="mt-1 text-xs text-slate-500">
        {t("reg.res.paymentId")}: <span className="font-mono font-semibold text-slate-800 select-all">{id}</span>
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <ButtonLink href={`tel:${tel}`} external variant="outline" className="flex-1" icon={<Phone className="size-4" />}>
          {t("reg.res.call", { phone: ORG.phone })}
        </ButtonLink>
        <ButtonLink
          href={`mailto:${ORG.email}?subject=${encodeURIComponent(`Payment verification — ${id}`)}`}
          external
          variant="outline"
          className="flex-1"
          icon={<Mail className="size-4" />}
        >
          {t("reg.res.mail", { email: ORG.email })}
        </ButtonLink>
      </div>
    </div>
  );
}

function StateCard({ tone, icon, title, desc, children }: { tone: "amber" | "red" | "slate"; icon: React.ReactNode; title: string; desc: React.ReactNode; children?: React.ReactNode }) {
  const ring = { amber: "bg-amber-50 text-amber-600", red: "bg-rose-50 text-rose-600", slate: "bg-slate-100 text-slate-600" }[tone];
  return (
    <Card className="p-6 sm:p-8">
      <div className="text-center">
        <div className={cn("mx-auto flex size-16 items-center justify-center rounded-full [&>svg]:size-8", ring)}>{icon}</div>
        <h2 className="mt-4 text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{desc}</p>
      </div>
      {children && <div className="mt-6 space-y-4">{children}</div>}
    </Card>
  );
}

export function PaymentResult({ paymentId, orderId }: { paymentId?: string; orderId?: string }) {
  const t = useT();
  const [outcome, setOutcome] = useState<PaymentOutcome | null>(null);
  const [error, setError] = useState<{ msg: string; code?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { pay, busy, error: payError } = useCheckout();

  const load = useCallback(
    async (mode: "initial" | "poll" | "manual") => {
      if (mode !== "initial") setChecking(true);
      try {
        const res =
          mode === "initial" && orderId && !paymentId
            ? await api<PaymentOutcome>("/api/payments/verify", { body: { orderId } })
            : await api<PaymentOutcome>(`/api/payments/status?paymentId=${encodeURIComponent(paymentId ?? outcome?.payment.id ?? "")}`);
        setOutcome(res);
        setError(null);
      } catch (e) {
        if (mode !== "poll" || !outcome) setError({ msg: errText(e, t), code: errCode(e) });
      } finally {
        setChecking(false);
        setLastChecked(new Date());
      }
    },
    [orderId, paymentId, outcome, t],
  );

  useEffect(() => {
    if (!paymentId && !orderId) {
      setError({ msg: t("reg.res.notFound") });
      return;
    }
    load("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-poll while the payment is awaiting confirmation (FR-REG-2).
  useEffect(() => {
    if (outcome?.status !== "PENDING") return;
    timer.current = setTimeout(() => load("poll"), POLL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [outcome, load]);

  if (error && !outcome) {
    const expired = error.code === "SESSION_EXPIRED" || error.code === "FORBIDDEN";
    return (
      <StateCard tone="slate" icon={<SearchX />} title={expired ? t("reg.err.SESSION_EXPIRED") : t("reg.res.notFound")} desc={expired ? t("reg.res.noAccess") : error.msg}>
        <ButtonLink href="/register" size="lg" className="w-full" icon={<ArrowLeft className="size-4" />}>
          {t("reg.res.backToReg")}
        </ButtonLink>
      </StateCard>
    );
  }

  if (!outcome) {
    return (
      <Card className="p-10 text-center" aria-busy="true">
        <Loader2 className="mx-auto size-10 animate-spin text-brand-600" />
        <p className="mt-4 text-lg font-semibold text-slate-900">{t("reg.res.verifying")}</p>
        <p className="mt-1 text-sm text-slate-500">{t("reg.res.verifyingDesc")}</p>
      </Card>
    );
  }

  const p = outcome.payment;
  const supportId = p.gatewayPaymentId ?? p.transactionId;
  const summary = (
    <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
      <div>
        <dt className="text-xs text-slate-500">{t("reg.res.txn")}</dt>
        <dd className="truncate font-mono text-xs font-semibold text-slate-900">{p.transactionId}</dd>
      </div>
      <div className="text-right">
        <dt className="text-xs text-slate-500">{t("reg.pay.amount")}</dt>
        <dd className="font-semibold text-slate-900">{formatINR(p.amount)}</dd>
      </div>
    </dl>
  );

  switch (outcome.status) {
    case "SUCCESS":
      return (
        <SuccessCard
          name={outcome.student.name}
          portalRegNo={outcome.student.portalRegNo}
          username={outcome.student.username}
          domainName={outcome.student.domainName}
          paymentId={p.id}
          transactionId={p.transactionId}
          amount={p.amount}
          receiptNo={p.receiptNo}
          paidAt={p.paidAt}
        />
      );
    case "PENDING":
      return (
        <StateCard tone="amber" icon={<Hourglass className="animate-pulse" />} title={t("reg.res.pendingTitle")} desc={t("reg.res.pendingDesc")}>
          {summary}
          <p className="flex items-center justify-center gap-2 text-xs text-slate-500" aria-live="polite">
            {checking ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {checking ? t("reg.res.pendingChecking") : lastChecked ? t("reg.res.lastChecked", { time: formatTime(lastChecked) }) : null}
          </p>
          <Button variant="outline" className="w-full" onClick={() => load("manual")} loading={checking}>
            {t("reg.res.recheck")}
          </Button>
          <SupportBox id={supportId} />
        </StateCard>
      );
    case "VERIFY_FAILED":
      return (
        <StateCard tone="red" icon={<AlertOctagon />} title={t("reg.res.verifyFailedTitle")} desc={t("reg.res.verifyFailedDesc", { id: supportId })}>
          {summary}
          <SupportBox id={supportId} />
          <Button variant="ghost" className="w-full" onClick={() => load("manual")} loading={checking} icon={<RefreshCw className="size-4" />}>
            {t("reg.res.recheck")}
          </Button>
        </StateCard>
      );
    case "REFUNDED":
      return (
        <StateCard tone="slate" icon={<RotateCcw />} title={t("reg.res.refundedTitle")} desc={t("reg.res.refundedDesc")}>
          {summary}
          <SupportBox id={supportId} />
        </StateCard>
      );
    default: {
      const failed = outcome.status === "FAILED";
      return (
        <StateCard
          tone={failed ? "red" : "slate"}
          icon={<XCircle />}
          title={failed ? t("reg.res.failedTitle") : t("reg.res.notCompletedTitle")}
          desc={failed ? t("reg.res.failedDesc") : t("reg.res.notCompletedDesc")}
        >
          {failed && p.failureReason && (
            <Alert tone="error" title={t("reg.res.reason")}>
              {p.failureReason}
            </Alert>
          )}
          {payError && <Alert tone="error">{payError}</Alert>}
          {summary}
          <Button size="lg" className="w-full" onClick={pay} loading={busy} icon={!busy ? <RotateCcw className="size-4" /> : undefined}>
            {t("reg.res.retry")}
          </Button>
          <ButtonLink href="/register" variant="ghost" className="w-full" icon={<ArrowLeft className="size-4" />}>
            {t("reg.res.backToReg")}
          </ButtonLink>
        </StateCard>
      );
    }
  }
}
