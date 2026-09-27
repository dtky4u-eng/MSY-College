"use client";
import { useState } from "react";
import { CalendarPlus, Trash2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { formatDate } from "@/lib/format";

interface Leave {
  date: string;
  remarks: string | null;
  byMentor: boolean;
  revocable: boolean;
}

export function LeaveManager({ studentId, min, max, locked, leaves }: { studentId: string; min: string; max?: string; locked: boolean; leaves: Leave[] }) {
  const [date, setDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revoke, setRevoke] = useState<string | null>(null);
  const { run, loading, fields } = useAction();
  const del = useAction();
  const err = { ...errors, ...fields };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ve: Record<string, string> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) ve.date = "Choose a date";
    else if (date < min || (max && date > max)) ve.date = "Date must be within the internship window";
    if (remarks.trim().length < 3) ve.remarks = "Enter the reason for leave";
    setErrors(ve);
    if (Object.keys(ve).length) return;
    const res = await run(() => api(`/api/mentor/students/${studentId}/leave`, { body: { date, remarks: remarks.trim() } }), { success: "Leave approved", refresh: true });
    if (res) {
      setDate("");
      setRemarks("");
    }
  };

  return (
    <div className="space-y-5">
      {locked ? (
        <p className="text-sm text-slate-500">Attendance is locked for this student.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field label="Date" htmlFor="lv-date" error={err.date} required>
            <Input id="lv-date" type="date" min={min} max={max} value={date} onChange={(e) => setDate(e.target.value)} invalid={Boolean(err.date)} />
          </Field>
          <Field label="Reason" htmlFor="lv-remarks" error={err.remarks} required>
            <Textarea id="lv-remarks" rows={2} maxLength={300} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Medical leave" invalid={Boolean(err.remarks)} />
          </Field>
          <Button type="submit" className="w-full" loading={loading} icon={<CalendarPlus className="size-4" />}>
            Approve leave
          </Button>
        </form>
      )}
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Leave days ({leaves.length})</p>
        {leaves.length === 0 ? (
          <p className="text-sm text-slate-500">No approved leave.</p>
        ) : (
          <ul className="space-y-1.5">
            {leaves.map((l) => (
              <li key={l.date} className="flex items-center justify-between gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-sky-900">{formatDate(l.date)}</p>
                  {l.remarks && <p className="truncate text-xs text-sky-800/80">{l.remarks}</p>}
                </div>
                {l.revocable && !locked && (
                  <button type="button" onClick={() => setRevoke(l.date)} className="rounded p-1 text-sky-700 hover:bg-white hover:text-rose-600" aria-label={`Revoke leave on ${formatDate(l.date)}`}>
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(revoke)}
        onClose={() => setRevoke(null)}
        tone="danger"
        loading={del.loading}
        title="Revoke approved leave?"
        description={revoke ? `The leave on ${formatDate(revoke)} will be removed and the day will count as not marked.` : undefined}
        confirmLabel="Revoke leave"
        onConfirm={async () => {
          await del.run(() => api(`/api/mentor/students/${studentId}/leave?date=${revoke}`, { method: "DELETE" }), { success: "Leave revoked", refresh: true });
          setRevoke(null);
        }}
      />
    </div>
  );
}
