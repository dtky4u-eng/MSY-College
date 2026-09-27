"use client";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Textarea } from "@/components/ui/field";
import { cn } from "@/components/ui/cn";

export function GrantButton({ studentId, studentName, quizId, quizTitle }: { studentId: string; studentName: string; quizId: string; quizTitle: string }) {
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState(1);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, loading, fields } = useAction();
  const err = { ...errors, ...fields };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) return setErrors({ reason: "Enter a reason of at least 5 characters" });
    setErrors({});
    const res = await run(() => api("/api/mentor/quiz-reattempts", { body: { studentId, quizId, extraAttempts: extra, reason: reason.trim() } }), {
      success: "Reattempt granted",
      successDescription: `${studentName} has been notified.`,
      refresh: true,
    });
    if (res) {
      setOpen(false);
      setReason("");
      setExtra(1);
    }
  };

  return (
    <>
      <Button size="xs" variant="secondary" icon={<RotateCcw className="size-3.5" />} onClick={() => setOpen(true)}>
        Grant
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Grant quiz reattempt"
        description={`${studentName} · ${quizTitle}`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" form={`grant-${studentId}-${quizId}`} loading={loading}>Grant {extra} attempt{extra === 1 ? "" : "s"}</Button>
          </>
        }
      >
        <form id={`grant-${studentId}-${quizId}`} onSubmit={submit} className="space-y-4" noValidate>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-700">Extra attempts</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup">
              {[1, 2, 3].map((n) => (
                <button
                  type="button"
                  key={n}
                  role="radio"
                  aria-checked={extra === n}
                  onClick={() => setExtra(n)}
                  className={cn("h-10 rounded-lg border text-sm font-semibold", extra === n ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-300 text-slate-600 hover:bg-slate-50")}
                >
                  +{n}
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="Reason" htmlFor={`gr-${quizId}`} error={err.reason} required hint="Visible in the grant history and audit log">
            <Textarea id={`gr-${quizId}`} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Revised the chapter with the student in a doubt-clearing session" invalid={Boolean(err.reason)} />
          </Field>
        </form>
      </Modal>
    </>
  );
}
