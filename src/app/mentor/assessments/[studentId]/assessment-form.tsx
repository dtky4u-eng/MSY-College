"use client";
import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { ASSESSMENT_CRITERIA, RATINGS } from "@/lib/constants";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Textarea, Checkbox } from "@/components/ui/field";
import { cn } from "@/components/ui/cn";

const TONE: Record<string, string> = {
  VERY_GOOD: "border-emerald-500 bg-emerald-50 text-emerald-700",
  GOOD: "border-sky-500 bg-sky-50 text-sky-700",
  SATISFACTORY: "border-amber-500 bg-amber-50 text-amber-800",
  NEEDS_IMPROVEMENT: "border-rose-500 bg-rose-50 text-rose-700",
};

export function AssessmentForm({
  studentId,
  locked,
  initial,
  submittedAt,
}: {
  studentId: string;
  locked: boolean;
  initial: { ratings: Record<string, string>; remarks: string; recommendCertificate: boolean };
  submittedAt: string | null;
}) {
  const [ratings, setRatings] = useState<Record<string, string>>(initial.ratings);
  const [remarks, setRemarks] = useState(initial.remarks);
  const [recommend, setRecommend] = useState(initial.recommendCertificate);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, loading, fields } = useAction();
  const err = { ...errors, ...fields };

  const score = useMemo(() => {
    const vals = ASSESSMENT_CRITERIA.map((c) => RATINGS.find((r) => r.value === ratings[c.key])?.score).filter((x): x is 40 | 60 | 80 | 100 => typeof x === "number");
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
  }, [ratings]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ve: Record<string, string> = {};
    for (const c of ASSESSMENT_CRITERIA) if (!ratings[c.key]) ve[`ratings.${c.key}`] = "Choose a rating";
    if (remarks.trim().length < 10) ve.remarks = "Supervisor remarks must be at least 10 characters";
    setErrors(ve);
    if (Object.keys(ve).length) return;
    await run(() => api(`/api/mentor/assessments/${studentId}`, { method: "PUT", body: { ratings, remarks: remarks.trim(), recommendCertificate: recommend } }), {
      success: submittedAt ? "Assessment updated" : "Assessment submitted",
      refresh: true,
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <Card>
        <CardHeader
          title="Assessment criteria"
          description={submittedAt ? `Last saved ${submittedAt}` : "Rate the student on every criterion"}
          actions={<span className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 tabular-nums">Score {score !== null ? `${score}%` : "—"}</span>}
        />
        <ul className="divide-y divide-slate-100">
          {ASSESSMENT_CRITERIA.map((c) => {
            const e = err[`ratings.${c.key}`];
            return (
              <li key={c.key} className="px-5 py-4">
                <fieldset disabled={locked}>
                  <legend className="mb-2 text-sm font-medium text-slate-800">{c.label}</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={c.label}>
                    {RATINGS.map((r) => {
                      const on = ratings[c.key] === r.value;
                      return (
                        <label key={r.value} className={cn("flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors sm:text-sm", on ? TONE[r.value] : "border-slate-200 text-slate-600 hover:bg-slate-50", locked && "cursor-not-allowed opacity-70")}>
                          <input type="radio" className="sr-only" name={c.key} value={r.value} checked={on} onChange={() => setRatings((s) => ({ ...s, [c.key]: r.value }))} />
                          {r.label}
                        </label>
                      );
                    })}
                  </div>
                  {e && <p className="mt-1 text-xs font-medium text-rose-600">{e}</p>}
                </fieldset>
              </li>
            );
          })}
        </ul>
        <CardBody className="space-y-4 border-t border-slate-100">
          <Field label="Supervisor remarks" htmlFor="as-remarks" error={err.remarks} required>
            <Textarea id="as-remarks" rows={4} maxLength={2000} value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={locked} invalid={Boolean(err.remarks)} />
          </Field>
          <Checkbox label="I recommend this student for the internship certificate" checked={recommend} onChange={(e) => setRecommend(e.target.checked)} disabled={locked} />
        </CardBody>
        {!locked && (
          <CardFooter>
            <Button type="submit" loading={loading} icon={<Save className="size-4" />}>
              {submittedAt ? "Update assessment" : "Submit assessment"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </form>
  );
}
