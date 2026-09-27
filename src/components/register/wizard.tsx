"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { GraduationCap, Lock, LogOut } from "lucide-react";
import { api } from "@/lib/client/api";
import { useT } from "@/components/i18n";
import { Alert } from "@/components/ui/page";
import type { RegState } from "./types";
import { Stepper } from "./stepper";
import { StepVerify } from "./step-verify";
import { StepDetails } from "./step-details";
import { StepDomain } from "./step-domain";
import { StepDocuments } from "./step-documents";
import { StepReview } from "./step-review";
import { StepPayment } from "./step-payment";
import { SuccessCard } from "./success-card";
import { errCode } from "./util";

/** Where to resume: paid → done; locked-but-unpaid → payment; else the last saved step. */
function resumeStep(s: RegState): number {
  if (s.student.paid) return 7;
  if (s.student.locked) return 6;
  return Math.min(Math.max(s.student.nextStep, 2), 5);
}

export function RegisterWizard({ initial }: { initial: RegState | null }) {
  const t = useT();
  const [state, setState] = useState<RegState | null>(initial);
  const [step, setStep] = useState<number>(initial ? resumeStep(initial) : 1);
  const [expired, setExpired] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const reachable = !state ? 1 : state.student.paid ? 7 : state.student.locked ? 6 : Math.min(state.student.nextStep, 5);
  const done = (n: number) => {
    if (!state) return false;
    if (n === 1) return true;
    if (state.student.locked) return n <= 5 || state.student.paid;
    return n < state.student.nextStep;
  };

  const goTo = useCallback(
    (n: number) => {
      if (!state) return setStep(1);
      // After confirmation steps 2–4 are read-only: show them through the review summary.
      if (state.student.locked && n >= 2 && n <= 4) return setStep(5);
      setStep(Math.min(n, reachable));
    },
    [state, reachable],
  );

  const expire = useCallback(() => {
    setState(null);
    setStep(1);
    setExpired(true);
  }, []);

  /** Shared API error handling: session expiry and lock conflicts reset the view. Returns true when handled. */
  const onError = useCallback(
    (e: unknown) => {
      const code = errCode(e);
      if (code === "SESSION_EXPIRED") {
        expire();
        return true;
      }
      if (code === "LOCKED" || code === "PAID") {
        api<{ state: RegState }>("/api/register/state")
          .then((r) => {
            setState(r.state);
            setStep(resumeStep(r.state));
          })
          .catch(() => expire());
        return true;
      }
      return false;
    },
    [expire],
  );

  const saved = (next: number) => (s: RegState) => {
    setState(s);
    setStep(s.student.paid ? 7 : next);
  };

  const startOver = async () => {
    await api("/api/register/logout", { method: "POST" }).catch(() => undefined);
    setState(null);
    setExpired(false);
    setStep(1);
  };

  return (
    <div ref={topRef} className="mx-auto max-w-4xl scroll-mt-20 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-1 sm:mb-8">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
          <GraduationCap className="size-3.5" /> {t("reg.subtitle")}
        </span>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{t("reg.title")}</h1>
      </div>

      {step <= 6 && <Stepper current={step} reachable={reachable} done={done} onSelect={goTo} />}

      {state && step >= 2 && step <= 6 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
          <p className="min-w-0 truncate">
            <span className="font-semibold text-slate-900">{state.student.name}</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="font-mono text-xs text-slate-600">{state.student.registrationNumber}</span>
            <span className="mx-1.5 hidden text-slate-300 sm:inline">·</span>
            <span className="hidden text-slate-500 sm:inline">{state.student.college.name}</span>
          </p>
          <button type="button" onClick={startOver} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600">
            <LogOut className="size-3.5" /> {t("reg.startOver")}
          </button>
        </div>
      )}

      {state?.student.locked && !state.student.paid && step >= 2 && step <= 5 && (
        <Alert tone="info" icon={<Lock />} className="mb-4">
          {t("reg.lockedNotice")}
        </Alert>
      )}

      <div key={step} className="animate-slide-up">
        {(step === 1 || !state) && (
          <StepVerify
            expired={expired}
            onVerified={(s) => {
              setExpired(false);
              setState(s);
              setStep(resumeStep(s));
            }}
          />
        )}
        {state && step === 2 && <StepDetails state={state} onSaved={saved(3)} onError={onError} />}
        {state && step === 3 && <StepDomain state={state} onSaved={saved(4)} onBack={() => goTo(2)} onError={onError} />}
        {state && step === 4 && <StepDocuments state={state} onSaved={(s) => setState(s)} onNext={() => setStep(5)} onBack={() => goTo(3)} onError={onError} />}
        {state && step === 5 && <StepReview state={state} onSaved={saved(6)} goTo={goTo} onError={onError} />}
        {state && step === 6 && <StepPayment state={state} goTo={goTo} onSessionExpired={expire} />}
        {state && step === 7 && (
          <SuccessCard
            name={state.student.name}
            portalRegNo={state.student.portalRegNo}
            username={state.student.username}
            domainName={state.domains.find((d) => d.id === state.student.domainId)?.name ?? null}
            paymentId={state.successPaymentId}
          />
        )}
      </div>
    </div>
  );
}
