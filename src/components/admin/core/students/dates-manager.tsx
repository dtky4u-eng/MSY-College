"use client";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { toISTDateString } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/page";
import { dateRangeErrors, defaultEndYmd, durationLabel, isRealYmd } from "./validate";

/** Set or change internship start/end dates for a paid student (end on or after start). */
export function DatesManager({
  studentId,
  start,
  end,
  paid,
  status,
  defaultWeeks,
}: {
  studentId: string;
  start: string | null;
  end: string | null;
  paid: boolean;
  status: string;
  defaultWeeks: number;
}) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(start ?? "");
  const [e, setE] = useState(end ?? "");
  const [endTouched, setEndTouched] = useState(Boolean(end));
  const [local, setLocal] = useState<Record<string, string>>({});
  const { run, loading, fields, setFields } = useAction();
  const err = { ...fields, ...local };

  const openModal = () => {
    const initialStart = start ?? toISTDateString();
    setS(initialStart);
    setE(end ?? defaultEndYmd(initialStart, defaultWeeks));
    setEndTouched(Boolean(end));
    setLocal({});
    setFields({});
    setOpen(true);
  };

  const changeStart = (v: string) => {
    setS(v);
    if (!endTouched && isRealYmd(v)) setE(defaultEndYmd(v, defaultWeeks));
    setLocal({});
    setFields({});
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const v = dateRangeErrors(s, e);
    setLocal(v);
    if (Object.keys(v).length) return;
    const res = await run(() => api<{ changed: boolean; activated?: boolean }>(`/api/admin/students/${studentId}/dates`, { body: { startDate: s, endDate: e } }), {
      success: "Internship dates saved",
      refresh: true,
    });
    if (!res) return;
    setOpen(false);
  };

  const duration = durationLabel(s, e);
  const suggested = isRealYmd(s) ? defaultEndYmd(s, defaultWeeks) : null;
  return (
    <>
      <Button variant="outline" size="sm" icon={<CalendarDays className="size-4" />} onClick={openModal} disabled={!paid} title={paid ? undefined : "Available after the fee is paid"}>
        {start ? "Change dates" : "Set dates"}
      </Button>
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        size="md"
        title={start ? "Change internship dates" : "Set internship dates"}
        description="Dates are calendar days in IST. The student is notified of the change."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form="student-dates-form" loading={loading}>
              Save dates
            </Button>
          </>
        }
      >
        <form id="student-dates-form" onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" htmlFor="dt-start" required error={err.startDate}>
              <Input id="dt-start" type="date" value={s} onChange={(x) => changeStart(x.target.value)} invalid={Boolean(err.startDate)} />
            </Field>
            <Field
              label="End date"
              htmlFor="dt-end"
              required
              error={err.endDate}
              hint={suggested ? `Default: ${defaultWeeks} weeks → ${suggested}` : undefined}
            >
              <Input
                id="dt-end"
                type="date"
                value={e}
                min={s || undefined}
                onChange={(x) => {
                  setE(x.target.value);
                  setEndTouched(true);
                  setLocal({});
                  setFields({});
                }}
                invalid={Boolean(err.endDate)}
              />
            </Field>
          </div>
          {duration && <p className="text-sm text-slate-600">Duration: {duration}</p>}
          {suggested && e !== suggested && (
            <button
              type="button"
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
              onClick={() => {
                setE(suggested);
                setEndTouched(false);
              }}
            >
              Use the default end date ({suggested})
            </button>
          )}
          {!start && status === "PENDING" && <Alert tone="info">Setting a start date makes the internship active. Before the start date the student sees “Not Started”.</Alert>}
          {status === "COMPLETED" && <Alert tone="warning">This internship is completed. Changing dates affects generated documents such as attendance sheets.</Alert>}
        </form>
      </Modal>
    </>
  );
}
