"use client";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Award, Check, Clock, Layers } from "lucide-react";
import { api } from "@/lib/client/api";
import { formatINR } from "@/lib/format";
import { useT } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import type { RegState } from "./types";
import { errText } from "./util";

export function StepDomain({ state, onSaved, onBack, onError }: { state: RegState; onSaved: (s: RegState) => void; onBack: () => void; onError: (e: unknown) => boolean }) {
  const t = useT();
  const [selected, setSelected] = useState<string | null>(state.student.domainId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const m = new Map<string, RegState["domains"]>();
    for (const d of state.domains) m.set(d.sector, [...(m.get(d.sector) ?? []), d]);
    return [...m.entries()];
  }, [state.domains]);

  const chosen = state.domains.find((d) => d.id === selected);

  const submit = async () => {
    setError(null);
    if (!selected) {
      setError(t("reg.domain.pick"));
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ state: RegState }>("/api/register/domain", { body: { domainId: selected } });
      onSaved(res.state);
    } catch (e) {
      setLoading(false);
      if (onError(e)) return;
      setError(errText(e, t));
    }
  };

  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-5 sm:px-8">
        <h2 className="text-xl font-bold text-slate-900">{t("reg.domain.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("reg.domain.desc")}</p>
      </div>
      <div className="space-y-7 px-5 py-6 sm:px-8">
        {error && <Alert tone="error">{error}</Alert>}
        {state.domains.length === 0 && <EmptyState icon={<Layers />} title={t("reg.domain.none")} />}
        {groups.map(([sector, list]) => (
          <section key={sector}>
            <h3 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">{sector}</h3>
            <div role="radiogroup" aria-label={sector} className="grid gap-3 sm:grid-cols-2">
              {list.map((d) => {
                const on = d.id === selected;
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setSelected(d.id);
                      setError(null);
                    }}
                    className={cn(
                      "relative flex flex-col rounded-xl border p-4 text-left transition-all",
                      on ? "border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20" : "border-slate-200 bg-white hover:border-brand-300 hover:shadow-card",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-semibold text-slate-900">{d.name}</span>
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                          on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300",
                        )}
                        aria-hidden
                      >
                        {on && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                    </span>
                    {d.description && <span className="mt-1 line-clamp-2 text-xs text-slate-500">{d.description}</span>}
                    <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5 text-slate-400" /> {t("reg.domain.hours", { n: d.durationHours })}
                      </span>
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Award className="size-3.5" /> {t("reg.domain.certificate")}
                      </span>
                    </span>
                    <span className="mt-3 flex items-end justify-between border-t border-slate-100 pt-3">
                      <span className="text-xs text-slate-500">
                        {t("reg.domain.fee")}
                        {d.customFee && <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{t("reg.domain.collegeRate")}</span>}
                      </span>
                      <span className="text-lg font-bold text-slate-900">{formatINR(d.fee)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div className="sticky bottom-0 flex flex-col gap-3 rounded-b-2xl border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Button variant="ghost" onClick={onBack} icon={<ArrowLeft className="size-4" />} className="hidden sm:inline-flex">
          {t("reg.back")}
        </Button>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          {chosen && (
            <p className="min-w-0 text-sm">
              <span className="block truncate text-xs text-slate-500">{t("reg.domain.yourChoice")}</span>
              <span className="block truncate font-semibold text-slate-900">
                {chosen.name} · {formatINR(chosen.fee)}
              </span>
            </p>
          )}
          <Button size="lg" loading={loading} onClick={submit} disabled={!state.domains.length} icon={!loading ? <ArrowRight className="size-4" /> : undefined} className="shrink-0">
            {t("reg.saveContinue")}
          </Button>
        </div>
        <Button variant="ghost" onClick={onBack} icon={<ArrowLeft className="size-4" />} className="sm:hidden">
          {t("reg.back")}
        </Button>
      </div>
    </Card>
  );
}
