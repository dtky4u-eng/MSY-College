"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, CalendarCheck2, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { dateRangeErrors, defaultEndYmd, durationLabel, isRealYmd } from "@/components/admin/core/students/validate";

export interface StartTarget {
  id: string;
  name: string;
  hasMentor: boolean;
  start: string | null;
  end: string | null;
}

interface Note {
  id: string;
  name: string | null;
  reason: string;
}

interface StartResult {
  updated: number;
  mentorsAssigned: number;
  skipped: Note[];
  mentorWarnings: Note[];
  startDate: string;
  endDate: string;
}

/** Set (or reschedule) a common internship start date for one or more students (FR-ADM-7). */
export function StartDialog({
  open,
  onClose,
  onDone,
  targets,
  defaultWeeks,
  today,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  targets: StartTarget[];
  defaultWeeks: number;
  today: string;
}) {
  const single = targets.length === 1 ? targets[0]! : null;
  const reschedule = targets.length > 0 && targets.every((t) => t.start);
  const withoutMentor = targets.filter((t) => !t.hasMentor).length;

  const [start, setStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(false);
  const [end, setEnd] = useState("");
  const [autoAssign, setAutoAssign] = useState(true);
  const [local, setLocal] = useState<Record<string, string>>({});
  const [result, setResult] = useState<StartResult | null>(null);
  const { run, loading, fields, setFields } = useAction();
  const toast = useToast();
  const err = { ...fields, ...local };

  useEffect(() => {
    if (!open) return;
    const s = single?.start ?? today;
    setStart(s);
    const hasCustom = Boolean(single?.end && single.start && single.end !== defaultEndYmd(single.start, defaultWeeks));
    setCustomEnd(hasCustom);
    setEnd(single?.end ?? defaultEndYmd(s, defaultWeeks));
    setAutoAssign(true);
    setLocal({});
    setFields({});
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const computedEnd = isRealYmd(start) ? defaultEndYmd(start, defaultWeeks) : "";
  const effectiveEnd = customEnd ? end : computedEnd;
  const duration = durationLabel(start, effectiveEnd);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = dateRangeErrors(start, customEnd ? end : computedEnd || start);
    if (!customEnd) delete v.endDate;
    setLocal(v);
    if (Object.keys(v).length) return;
    const res = await run(
      () =>
        api<StartResult>("/api/admin/internships/start", {
          body: { studentIds: targets.map((t) => t.id), startDate: start, endDate: customEnd ? end : null, autoAssignMentors: withoutMentor > 0 && autoAssign },
        }),
      { refresh: true },
    );
    if (!res) return;
    const detail = [
      res.mentorsAssigned ? `${res.mentorsAssigned} mentor${res.mentorsAssigned === 1 ? "" : "s"} assigned` : null,
      res.skipped.length ? `${res.skipped.length} skipped` : null,
      res.mentorWarnings.length ? `${res.mentorWarnings.length} without a mentor` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const title = `${res.updated} student${res.updated === 1 ? "" : "s"} scheduled`;
    if (res.updated) toast.success(title, detail || undefined);
    else toast.warning("No students were scheduled", detail || undefined);
    if (res.skipped.length || res.mentorWarnings.length) setResult(res);
    else onDone();
  };

  return (
    <Modal
      open={open}
      onClose={() => !loading && (result ? onDone() : onClose())}
      size="md"
      title={result ? "Scheduling summary" : reschedule ? "Reschedule internship" : "Set internship start date"}
      description={
        result
          ? "Some students need attention."
          : single
            ? single.name
            : `${targets.length} selected student${targets.length === 1 ? "" : "s"} will get the same dates.`
      }
      footer={
        result ? (
          <Button onClick={onDone}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form="internship-start-form" loading={loading} icon={<CalendarCheck2 className="size-4" />}>
              {reschedule ? "Save new dates" : targets.length > 1 ? `Schedule ${targets.length} students` : "Schedule internship"}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <ResultView result={result} />
      ) : (
        <form id="internship-start-form" onSubmit={submit} noValidate className="space-y-4">
          <Field label="Start date" htmlFor="is-start" required error={err.startDate} hint={start < today && isRealYmd(start) ? "This date is in the past — the internship starts immediately." : undefined}>
            <Input
              id="is-start"
              type="date"
              value={start}
              invalid={Boolean(err.startDate)}
              onChange={(e) => {
                setStart(e.target.value);
                setLocal({});
                setFields({});
              }}
            />
          </Field>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-sm text-slate-700">
              Default end date ({defaultWeeks} weeks): <b className="tabular-nums">{computedEnd ? formatDate(computedEnd) : "—"}</b>
            </p>
            <Checkbox
              className="mt-2"
              checked={customEnd}
              onChange={(e) => {
                setCustomEnd(e.target.checked);
                if (e.target.checked && !end) setEnd(computedEnd);
                setLocal({});
              }}
              label="Use a different end date"
            />
            {customEnd && (
              <Field label="End date" htmlFor="is-end" required error={err.endDate} className="mt-3">
                <Input
                  id="is-end"
                  type="date"
                  value={end}
                  min={start || undefined}
                  invalid={Boolean(err.endDate)}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    setLocal({});
                    setFields({});
                  }}
                />
              </Field>
            )}
            {duration && <p className="mt-2 text-xs text-slate-500">Duration: {duration}</p>}
          </div>

          {withoutMentor > 0 ? (
            <Checkbox
              checked={autoAssign}
              onChange={(e) => setAutoAssign(e.target.checked)}
              label={
                <>
                  Auto-assign mentors to {withoutMentor === targets.length && targets.length === 1 ? "this student" : `${withoutMentor} student${withoutMentor === 1 ? "" : "s"} without a mentor`}
                  <span className="block text-xs text-slate-500">Round-robin among active mentors of each student&apos;s domain, least-loaded first.</span>
                </>
              }
            />
          ) : (
            <p className="text-xs text-slate-500">{targets.length === 1 ? "This student already has a mentor." : "All selected students already have a mentor."}</p>
          )}

          <Alert tone="info">Students become active and are notified. Before the start date they see “Not Started”.</Alert>
        </form>
      )}
    </Modal>
  );
}

function ResultView({ result }: { result: StartResult }) {
  return (
    <div className="space-y-4" aria-live="polite">
      <Alert tone={result.updated ? "success" : "warning"} icon={result.updated ? <CheckCircle2 /> : <AlertTriangle />}>
        {result.updated
          ? `Scheduled ${result.updated} student${result.updated === 1 ? "" : "s"} from ${formatDate(result.startDate)} to ${formatDate(result.endDate)}.`
          : "No students were scheduled."}
        {result.mentorsAssigned ? ` ${result.mentorsAssigned} mentor assignment${result.mentorsAssigned === 1 ? "" : "s"} made.` : ""}
      </Alert>
      {result.skipped.length > 0 && <NoteList title={`Skipped (${result.skipped.length})`} notes={result.skipped} tone="rose" />}
      {result.mentorWarnings.length > 0 && <NoteList title={`Scheduled without a mentor (${result.mentorWarnings.length})`} notes={result.mentorWarnings} tone="amber" />}
    </div>
  );
}

function NoteList({ title, notes, tone }: { title: string; notes: Note[]; tone: "rose" | "amber" }) {
  return (
    <div className={tone === "rose" ? "overflow-hidden rounded-xl border border-rose-200" : "overflow-hidden rounded-xl border border-amber-200"}>
      <p className={tone === "rose" ? "bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900" : "bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900"}>{title}</p>
      <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
        {notes.map((n) => (
          <li key={n.id} className="flex justify-between gap-3 px-4 py-2 text-sm">
            <span className="text-slate-800">{n.name ?? n.id}</span>
            <span className="text-right text-slate-500">{n.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
