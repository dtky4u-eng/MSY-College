"use client";
// FR-STU-5 quiz: Start / Continue / Retry / View Result, countdown with auto-submit, autosave.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, ListChecks, Lock, RotateCcw, Send, Trophy, XCircle } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { useToast } from "@/components/ui/toast";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/page";
import { ProgressBar } from "@/components/ui/progress";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/components/ui/cn";
import { useT } from "@/components/i18n";
import type { QuizInfo } from "@/lib/student";
import type { AttemptPayload, ResultPayload } from "@/app/student/_lib/quiz";

export type QuizPanelInfo = QuizInfo & { description: string | null; showResult: boolean; lastAttemptId: string | null };

type Mode = { kind: "idle" } | { kind: "taking"; attempt: AttemptPayload & { timeLimitMinutes: number | null; title: string } } | { kind: "result"; result: ResultPayload & { late?: boolean } };

export function QuizPanel({
  quiz,
  canAct,
  requirementsMet,
  completed,
  beforeStart,
}: {
  quiz: QuizPanelInfo;
  canAct: boolean;
  requirementsMet: boolean;
  completed: boolean;
  beforeStart?: () => Promise<void>;
}) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      await beforeStart?.();
      const a = await api<AttemptPayload & { timeLimitMinutes: number | null; title: string; resumed: boolean }>(`/api/student/quiz/${quiz.id}/start`, { method: "POST" });
      setMode({ kind: "taking", attempt: a });
      if (a.resumed) toast.info(t("quiz.resumed"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error.generic"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const viewResult = async (attemptId: string) => {
    setBusy(true);
    try {
      const r = await api<ResultPayload>(`/api/student/quiz/attempts/${attemptId}`);
      setMode({ kind: "result", result: r });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error.generic"));
    } finally {
      setBusy(false);
    }
  };

  if (mode.kind === "taking")
    return (
      <QuizTaking
        attempt={mode.attempt}
        onDone={(r) => {
          setMode({ kind: "result", result: r });
          router.refresh();
        }}
        onAbort={() => {
          setMode({ kind: "idle" });
          router.refresh();
        }}
      />
    );

  if (mode.kind === "result")
    return (
      <QuizResult
        result={mode.result}
        attemptsRemaining={quiz.attemptsRemaining}
        canRetry={canAct && !mode.result.passed && quiz.attemptsRemaining > 0}
        onRetry={start}
        onClose={() => setMode({ kind: "idle" })}
        busy={busy}
      />
    );

  const total = quiz.attemptsAllowed + quiz.extraAttempts;
  const exhausted = !quiz.passed && !quiz.openAttemptId && quiz.attemptsRemaining <= 0;
  return (
    <Card>
      <CardHeader
        icon={<ListChecks className="size-5" />}
        title={quiz.title}
        description={quiz.description ?? t("quiz.defaultDesc")}
        actions={quiz.passed ? <Badge tone="green" dot>{t("quiz.passed")}</Badge> : exhausted ? <Badge tone="red">{t("quiz.exhaustedShort")}</Badge> : null}
      />
      <CardBody className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label={t("quiz.questions")} value={quiz.questionCount} />
          <Fact label={t("quiz.passingScore")} value={`${quiz.passingScore}%`} />
          <Fact label={t("quiz.timeLimit")} value={quiz.timeLimitMinutes ? t("quiz.minutes", { n: quiz.timeLimitMinutes }) : t("quiz.untimed")} />
          <Fact label={t("quiz.attempts")} value={t("quiz.attemptsUsed", { used: quiz.attemptsUsed, total })} />
        </dl>
        {quiz.bestPercent !== null && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>{t("quiz.bestScore")}</span>
              <span className="font-semibold text-slate-700">{quiz.bestPercent}%</span>
            </div>
            <ProgressBar value={quiz.bestPercent} tone={quiz.passed ? "green" : "amber"} />
          </div>
        )}
        {quiz.extraAttempts > 0 && <p className="text-xs text-slate-500">{t("quiz.extraGranted", { n: quiz.extraAttempts })}</p>}
        {!canAct && <Alert tone="info">{t("quiz.readOnly")}</Alert>}
        {canAct && !requirementsMet && !quiz.passed && !completed && (
          <Alert tone="warning" icon={<Lock />}>
            {t("quiz.needRequirements")}
          </Alert>
        )}
        {canAct && exhausted && (
          <Alert tone="error" icon={<AlertTriangle />} title={t("quiz.exhaustedTitle")}>
            {t("quiz.askMentor")}
          </Alert>
        )}
        {quiz.timeLimitMinutes && canAct && !quiz.passed && !exhausted && <p className="text-xs text-slate-500">{t("quiz.timedNote", { n: quiz.timeLimitMinutes })}</p>}
      </CardBody>
      <CardFooter>
        {quiz.lastAttemptId && (
          <Button variant="outline" onClick={() => viewResult(quiz.lastAttemptId!)} disabled={busy}>
            {t("quiz.viewResult")}
          </Button>
        )}
        {canAct && !quiz.passed && quiz.openAttemptId && (
          <Button onClick={start} loading={busy} icon={<ListChecks className="size-4" />}>
            {t("quiz.continue")}
          </Button>
        )}
        {canAct && !quiz.passed && !quiz.openAttemptId && quiz.attemptsRemaining > 0 && (
          <Button onClick={start} loading={busy} disabled={!requirementsMet || quiz.questionCount === 0} icon={quiz.attemptsUsed > 0 ? <RotateCcw className="size-4" /> : <ListChecks className="size-4" />}>
            {quiz.attemptsUsed > 0 ? t("quiz.retry") : t("quiz.start")}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function QuizTaking({ attempt, onDone, onAbort }: { attempt: AttemptPayload & { timeLimitMinutes: number | null; title: string }; onDone: (r: ResultPayload & { late?: boolean }) => void; onAbort: () => void }) {
  const t = useT();
  const toast = useToast();
  const [answers, setAnswers] = useState<Record<string, number>>(attempt.answers ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const submittedRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Server clock offset so the countdown matches expiresAt enforced on the server.
  const offset = useRef(new Date(attempt.serverNow).getTime() - Date.now());
  const expiresAt = attempt.expiresAt ? new Date(attempt.expiresAt).getTime() : null;
  const [remaining, setRemaining] = useState<number | null>(expiresAt ? Math.max(0, expiresAt - (Date.now() + offset.current)) : null);

  const submit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        const r = await api<ResultPayload & { late: boolean }>(`/api/student/quiz/attempts/${attempt.attemptId}/submit`, { body: { answers: answersRef.current } });
        if (auto) toast.info(t("quiz.autoSubmitted"));
        else toast.success(t("quiz.submitted"));
        onDone(r);
      } catch (e) {
        submittedRef.current = false;
        toast.error(e instanceof Error ? e.message : t("error.generic"));
        if (e instanceof ApiClientError && e.status === 409) onAbort();
      } finally {
        setSubmitting(false);
        setConfirm(false);
      }
    },
    [attempt.attemptId, onDone, onAbort, t, toast],
  );

  // Countdown + auto-submit at expiry.
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => {
      const left = Math.max(0, expiresAt - (Date.now() + offset.current));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        void submit(true);
      }
    }, 500);
    return () => clearInterval(id);
  }, [expiresAt, submit]);

  // Autosave (debounced) so Continue restores answers and late submissions keep them.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = setTimeout(() => {
      if (submittedRef.current) return;
      api(`/api/student/quiz/attempts/${attempt.attemptId}`, { method: "PATCH", body: { answers } }).catch(() => undefined);
    }, 600);
    return () => clearTimeout(id);
  }, [answers, attempt.attemptId]);

  const answered = attempt.questions.filter((q) => answers[q.id] !== undefined).length;
  const total = attempt.questions.length;
  const mm = remaining !== null ? Math.floor(remaining / 60000) : 0;
  const ss = remaining !== null ? Math.floor((remaining % 60000) / 1000) : 0;
  const low = remaining !== null && remaining < 60_000;

  return (
    <Card>
      <div className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-slate-100 bg-white/95 px-5 py-3 backdrop-blur">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-slate-900">{attempt.title}</p>
          <p className="text-xs text-slate-500">{t("quiz.answeredOf", { n: answered, total })}</p>
        </div>
        {remaining !== null && (
          <div
            className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-display text-base font-bold tabular-nums", low ? "animate-pulse bg-rose-50 text-rose-700" : "bg-brand-50 text-brand-700")}
            role="timer"
            aria-live={low ? "assertive" : "off"}
            aria-label={t("quiz.timeLeft")}
          >
            <Clock className="size-4" /> {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>
        )}
        <ProgressBar value={(answered / Math.max(1, total)) * 100} size="sm" className="w-full" />
      </div>
      <ol className="divide-y divide-slate-100">
        {attempt.questions.map((q, i) => (
          <li key={q.id} className="px-5 py-5">
            <fieldset>
              <legend className="mb-3 flex gap-2 text-sm font-semibold text-slate-900">
                <span className="text-brand-600">{i + 1}.</span>
                <span className="whitespace-pre-line">{q.text}</span>
                {q.marks > 1 && <span className="ml-auto shrink-0 text-xs font-medium text-slate-400">{t("quiz.marks", { n: q.marks })}</span>}
              </legend>
              <div className="grid gap-2">
                {q.options.map((opt, oi) => {
                  const sel = answers[q.id] === oi;
                  return (
                    <label
                      key={oi}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
                        sel ? "border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500" : "border-slate-200 hover:border-brand-300 hover:bg-slate-50",
                      )}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        className="mt-0.5 size-4 accent-brand-600"
                        checked={sel}
                        disabled={submitting}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                      />
                      <span>
                        <span className="mr-1.5 font-semibold text-slate-400">{String.fromCharCode(65 + oi)}.</span>
                        {opt}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <CardFooter>
        <p className="mr-auto text-xs text-slate-500">{t("quiz.autosaveNote")}</p>
        <Button icon={<Send className="size-4" />} loading={submitting} onClick={() => (answered < total ? setConfirm(true) : submit(false))}>
          {t("quiz.submit")}
        </Button>
      </CardFooter>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("quiz.confirmTitle")}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={submitting}>
              {t("quiz.keepAnswering")}
            </Button>
            <Button onClick={() => submit(false)} loading={submitting}>
              {t("quiz.submitAnyway")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{t("quiz.confirmUnanswered", { n: total - answered })}</p>
      </Modal>
    </Card>
  );
}

function QuizResult({
  result,
  canRetry,
  attemptsRemaining,
  onRetry,
  onClose,
  busy,
}: {
  result: ResultPayload & { late?: boolean };
  canRetry: boolean;
  attemptsRemaining: number;
  onRetry: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  const t = useT();
  return (
    <Card>
      <CardBody>
        <div className={cn("flex flex-col items-center gap-3 rounded-2xl p-6 text-center", result.passed ? "bg-emerald-50" : "bg-rose-50")}>
          {result.passed ? <Trophy className="size-10 text-emerald-600" /> : <XCircle className="size-10 text-rose-500" />}
          <p className={cn("font-display text-3xl font-bold", result.passed ? "text-emerald-700" : "text-rose-700")}>{result.percent}%</p>
          <p className="text-sm font-semibold text-slate-800">{result.passed ? t("quiz.resultPassed") : t("quiz.resultFailed", { pct: result.passingScore })}</p>
          <p className="text-sm text-slate-600">{t("quiz.scoreLine", { score: result.score, max: result.maxScore, answered: result.answered, total: result.total })}</p>
          {result.late && <Badge tone="amber">{t("quiz.lateNote")}</Badge>}
        </div>
        {!result.passed && !canRetry && attemptsRemaining <= 0 && (
          <Alert tone="error" icon={<AlertTriangle />} title={t("quiz.exhaustedTitle")} className="mt-4">
            {t("quiz.askMentor")}
          </Alert>
        )}
        {result.review ? (
          <ol className="mt-6 space-y-4">
            {result.review.map((q, i) => (
              <li key={q.id} className="rounded-xl border border-slate-200 p-4">
                <p className="flex gap-2 text-sm font-semibold text-slate-900">
                  {q.correct ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />}
                  <span>
                    {i + 1}. {q.text}
                  </span>
                </p>
                <ul className="mt-3 grid gap-1.5">
                  {q.options.map((o, oi) => (
                    <li
                      key={oi}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm",
                        oi === q.correctIndex ? "bg-emerald-50 font-medium text-emerald-800 ring-1 ring-emerald-200" : oi === q.selected ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200" : "text-slate-600",
                      )}
                    >
                      <span className="mr-1.5 font-semibold">{String.fromCharCode(65 + oi)}.</span>
                      {o}
                      {oi === q.selected && <span className="ml-2 text-xs">({t("quiz.yourAnswer")})</span>}
                    </li>
                  ))}
                </ul>
                {q.selected === null && <p className="mt-2 text-xs text-slate-500">{t("quiz.notAnswered")}</p>}
                {q.explanation && (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">{t("quiz.explanation")}:</span> {q.explanation}
                  </p>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-center text-xs text-slate-500">{t("quiz.resultHidden")}</p>
        )}
      </CardBody>
      <CardFooter>
        <Button variant="outline" onClick={onClose}>
          {t("action.close")}
        </Button>
        {canRetry && (
          <Button onClick={onRetry} loading={busy} icon={<RotateCcw className="size-4" />}>
            {t("quiz.retryWithCount", { n: attemptsRemaining })}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
