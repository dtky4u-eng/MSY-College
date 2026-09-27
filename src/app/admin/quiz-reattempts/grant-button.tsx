"use client";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";

export function GrantButton({ studentId, quizId, studentName, quizTitle, used, allowed }: { studentId: string; quizId: string; studentName: string; quizTitle: string; used: number; allowed: number }) {
  const [open, setOpen] = useState(false);
  const { run, loading, fields } = useAction();
  const [extra, setExtra] = useState("1");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) return setErr("Reason must be at least 5 characters");
    setErr(null);
    const ok = await run(() => api("/api/admin/quiz-reattempts", { body: { studentId, quizId, extraAttempts: Number(extra), reason: reason.trim() } }), {
      success: "Reattempt granted",
      successDescription: `${studentName} has been notified.`,
      refresh: true,
    });
    if (ok) {
      setOpen(false);
      setReason("");
      setExtra("1");
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
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form={`grant-${studentId}-${quizId}`} loading={loading}>
              Grant attempts
            </Button>
          </>
        }
      >
        <form id={`grant-${studentId}-${quizId}`} onSubmit={submit} className="space-y-4" noValidate>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            The student has used <b>{used}</b> of <b>{allowed}</b> allowed attempt(s) without passing.
          </p>
          <Field label="Extra attempts" htmlFor={`ex-${quizId}`} required error={fields.extraAttempts}>
            <Select id={`ex-${quizId}`} value={extra} onChange={(ev) => setExtra(ev.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} attempt{n > 1 ? "s" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reason" htmlFor={`rs-${quizId}`} required error={err ?? fields.reason}>
            <Textarea id={`rs-${quizId}`} rows={3} value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={500} invalid={Boolean(err ?? fields.reason)} placeholder="e.g. Technical issue during the last attempt" />
          </Field>
        </form>
      </Modal>
    </>
  );
}
