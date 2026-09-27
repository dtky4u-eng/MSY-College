"use client";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, FileText, Lock, Pencil, ShieldCheck } from "lucide-react";
import { api } from "@/lib/client/api";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { useT } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import type { RegState } from "./types";
import { fileUrlFor } from "./step-documents";
import { errText } from "./util";

function Block({ title, onEdit, editLabel, children }: { title: string; onEdit?: () => void; editLabel: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {onEdit && (
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50">
            <Pencil className="size-3.5" /> {editLabel}
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Rows({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-slate-500">{k}</dt>
          <dd className="mt-0.5 text-sm font-medium break-words text-slate-900">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StepReview({
  state,
  onSaved,
  goTo,
  onError,
}: {
  state: RegState;
  onSaved: (s: RegState) => void;
  goTo: (n: number) => void;
  onError: (e: unknown) => boolean;
}) {
  const t = useT();
  const s = state.student;
  const locked = s.locked;
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const domain = state.domains.find((d) => d.id === s.domainId);
  const label = (list: { value: string; label: string }[], v: string) => list.find((o) => o.value === v)?.label ?? v;
  const edit = (n: number) => (locked ? undefined : () => goTo(n));

  const confirm = async () => {
    setError(null);
    if (!agree) {
      setError(t("reg.review.declRequired"));
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ state: RegState }>("/api/register/confirm", { body: { declaration: true } });
      onSaved(res.state);
    } catch (e) {
      setLoading(false);
      if (onError(e)) return;
      setError(errText(e, t));
    }
  };

  const photo = fileUrlFor("photo", s.photo);
  const admit = fileUrlFor("admitCard", s.admitCard);
  const dobText = s.dob ? formatDate(s.dob) : "—";

  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-5 sm:px-8">
        <h2 className="text-xl font-bold text-slate-900">{t("reg.review.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{locked ? t("reg.lockedNotice") : t("reg.review.desc")}</p>
      </div>
      <div className="space-y-4 px-5 py-6 sm:px-8">
        {locked && (
          <Alert tone="success" icon={<Lock />}>
            {t("reg.review.confirmedAt", { date: formatDateTime(s.lockedAt) })}
          </Alert>
        )}
        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-brand-50 to-white p-4 ring-1 ring-brand-100">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={t("reg.docs.photo")} className="h-20 w-16 shrink-0 rounded-lg object-cover ring-2 ring-white" />
          ) : (
            <div className="h-20 w-16 shrink-0 rounded-lg bg-slate-200" />
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-slate-900">{s.name}</p>
            <p className="font-mono text-xs text-slate-600">{s.registrationNumber}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {s.college.name} · {s.college.university}
            </p>
          </div>
        </div>

        <Block title={t("reg.details.personal")} onEdit={edit(2)} editLabel={t("reg.review.edit")}>
          <Rows
            items={[
              [t("reg.f.fatherName"), s.fatherName],
              [t("reg.f.gender"), s.gender ? t(`reg.gender.${s.gender}`) : ""],
              [t("reg.f.dob"), dobText],
            ]}
          />
        </Block>
        <Block title={t("reg.details.academic")} onEdit={edit(2)} editLabel={t("reg.review.edit")}>
          <Rows
            items={[
              [t("reg.f.programme"), label(state.options.programmes, s.programme)],
              [t("reg.f.majorSubject"), s.majorSubject],
              [t("reg.f.session"), label(state.options.sessions, s.session)],
              [t("reg.f.semester"), label(state.options.semesters, s.semester)],
            ]}
          />
        </Block>
        <Block title={t("reg.details.account")} onEdit={edit(2)} editLabel={t("reg.review.edit")}>
          <Rows
            items={[
              [t("reg.f.mobile"), s.mobile],
              [t("reg.f.email"), s.email],
              [t("reg.f.username"), s.username],
            ]}
          />
        </Block>
        <Block title={t("reg.step.domain")} onEdit={edit(3)} editLabel={t("reg.review.edit")}>
          {domain ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{domain.name}</p>
                <p className="text-xs text-slate-500">
                  {domain.sector} · {t("reg.domain.hours", { n: domain.durationHours })} · {t("reg.domain.certificate")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">{t("reg.review.feeDue")}</p>
                <p className="text-lg font-bold text-slate-900">{formatINR(s.feeAmount ?? domain.fee)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">—</p>
          )}
        </Block>
        <Block title={t("reg.step.documents")} onEdit={edit(4)} editLabel={t("reg.review.edit")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { title: t("reg.docs.photo"), url: photo, f: s.photo },
              { title: t("reg.docs.admit"), url: admit, f: s.admitCard },
            ].map((d) => (
              <a
                key={d.title}
                href={d.url ?? undefined}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200 hover:ring-brand-300"
              >
                <FileText className="size-5 shrink-0 text-brand-600" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">{d.title}</span>
                  <span className="block truncate text-xs text-slate-500">{d.f?.name ?? "—"}</span>
                </span>
              </a>
            ))}
          </div>
        </Block>

        {!locked && (
          <>
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {t("reg.review.warning")}
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 hover:border-brand-300">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-brand-600" />
              <span className="text-sm text-slate-700">
                {t("reg.review.declaration")}{" "}
                <Link href="/terms-and-conditions" target="_blank" className="font-medium text-brand-600 underline-offset-2 hover:underline">
                  {t("reg.review.terms")}
                </Link>
                ,{" "}
                <Link href="/privacy-policy" target="_blank" className="font-medium text-brand-600 underline-offset-2 hover:underline">
                  {t("reg.review.privacy")}
                </Link>{" "}
                {t("reg.review.and")}{" "}
                <Link href="/refund-cancellation-policy" target="_blank" className="font-medium text-brand-600 underline-offset-2 hover:underline">
                  {t("reg.review.refund")}
                </Link>
                .
              </span>
            </label>
          </>
        )}
      </div>
      <div className="flex flex-col-reverse gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        {!locked ? (
          <Button variant="ghost" onClick={() => goTo(4)} icon={<ArrowLeft className="size-4" />}>
            {t("reg.back")}
          </Button>
        ) : (
          <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:inline-flex">
            <ShieldCheck className="size-4 text-emerald-600" /> {t("reg.secureNote")}
          </span>
        )}
        {locked ? (
          <Button size="lg" className="w-full sm:w-auto" onClick={() => goTo(6)} icon={<ArrowRight className="size-4" />}>
            {t("reg.review.toPayment")}
          </Button>
        ) : (
          <Button size="lg" className="w-full sm:w-auto" onClick={confirm} loading={loading} disabled={!agree} icon={!loading ? <Lock className="size-4" /> : undefined}>
            {t("reg.review.confirm")}
          </Button>
        )}
      </div>
    </Card>
  );
}
