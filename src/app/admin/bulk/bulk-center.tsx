"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Eye, Filter, Play, Sparkles, Users } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/field";
import { Alert } from "@/components/ui/page";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { BULK_OPERATIONS, type BulkOperation } from "@/lib/constants";
import { formatDate, formatNumber } from "@/lib/format";

type Opt = { value: string; label: string };
const GENERATING = new Set<string>(["FULL_LIFECYCLE", "ATTENDANCE", "LEARNING", "ASSESSMENT", "RESULTS", "COMPLETION", "LOGBOOKS"]);
const CONFIRM = "GENERATE";
const MAX = 500;

interface Preview {
  operation: BulkOperation;
  generating: boolean;
  matched: number;
  eligible: number;
  excluded: { reason: string; count: number }[];
  unmatchedRegNos: string[];
  overLimit: boolean;
  sample: { id: string; name: string; regNo: string; college: string; domain: string; status: string; start: string | null }[];
  workingDays: number;
  estimates: { label: string; value: number }[];
}

const emptyFilters = { collegeId: "", domainId: "", session: "", semester: "", status: "", paymentStatus: "", startFrom: "", startTo: "", regNos: "" };

export function BulkCenter({ options }: { options: { colleges: Opt[]; domains: Opt[]; sessions: Opt[]; semesters: Opt[]; statuses: Opt[] } }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [op, setOp] = useState<BulkOperation>("ATTENDANCE");
  const [opt, setOpt] = useState({ attendanceFrom: "", attendanceTo: "", presentRatio: "100", includeQuizzes: true, includeReceipts: true, generateSubmissions: true });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const pv = useAction();
  const runner = useAction();

  const regNos = useMemo(
    () =>
      filters.regNos
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [filters.regNos],
  );
  const payload = useMemo(
    () => ({
      type: op,
      filters: {
        collegeId: filters.collegeId || null,
        domainId: filters.domainId || null,
        session: filters.session || null,
        semester: filters.semester || null,
        status: filters.status || null,
        paymentStatus: filters.paymentStatus || null,
        startFrom: filters.startFrom || null,
        startTo: filters.startTo || null,
        regNos,
      },
      options: {
        attendanceFrom: opt.attendanceFrom || null,
        attendanceTo: opt.attendanceTo || null,
        presentRatio: Number(opt.presentRatio),
        includeQuizzes: opt.includeQuizzes,
        includeReceipts: opt.includeReceipts,
        generateSubmissions: opt.generateSubmissions,
      },
    }),
    [op, filters, opt, regNos],
  );
  const key = JSON.stringify(payload);
  const stale = preview !== null && previewKey !== key;
  const generating = GENERATING.has(op);
  const setF = (k: keyof typeof filters, v: string) => setFilters((s) => ({ ...s, [k]: v }));
  const anyFilter = Object.entries(filters).some(([, v]) => v);

  const validate = () => {
    const n: Record<string, string> = {};
    if (filters.startFrom && filters.startTo && filters.startFrom > filters.startTo) n.startTo = "Must be on or after the start of the range";
    if (opt.attendanceFrom && opt.attendanceTo && opt.attendanceFrom > opt.attendanceTo) n.attendanceTo = "Must be on or after the start date";
    if (regNos.length > MAX) n.regNos = `Paste at most ${MAX} registration numbers`;
    setErrs(n);
    return Object.keys(n).length === 0;
  };

  const doPreview = async () => {
    if (!validate()) return;
    const res = await pv.run(() => api<Preview>("/api/admin/bulk/preview", { body: payload }));
    if (res) {
      setPreview(res);
      setPreviewKey(key);
    }
  };

  const doRun = async () => {
    const n: Record<string, string> = {};
    if (generating && reason.trim().length < 10) n.reason = "Explain why records are being generated (at least 10 characters)";
    if (generating && confirm.trim() !== CONFIRM) n.confirm = `Type ${CONFIRM} to confirm`;
    setErrs(n);
    if (Object.keys(n).length) return;
    const res = await runner.run(() => api<{ id: string; total: number }>("/api/admin/bulk", { body: { ...payload, reason: reason.trim(), confirm: confirm.trim() } }), {
      success: "Bulk job started",
      successDescription: "Progress is shown in the jobs list below.",
    });
    if (res) {
      setPreview(null);
      setPreviewKey(null);
      setReason("");
      setConfirm("");
      window.dispatchEvent(new CustomEvent("bulk:refresh"));
      document.getElementById("bulk-jobs")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const e = { ...pv.fields, ...runner.fields, ...errs };
  const showAttendance = op === "ATTENDANCE" || op === "FULL_LIFECYCLE";
  const canRun = preview && !stale && preview.eligible > 0 && !preview.overLimit;

  return (
    <div className="mb-6 grid gap-6 xl:grid-cols-5">
      <div className="space-y-6 xl:col-span-3">
        <Card>
          <CardHeader
            title="1. Select students"
            description="Combine any filters, or paste specific registration numbers."
            icon={<Filter className="size-5" />}
            actions={
              anyFilter ? (
                <Button size="sm" variant="ghost" onClick={() => setFilters(emptyFilters)}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="College" htmlFor="bf-college">
                <Select id="bf-college" value={filters.collegeId} onChange={(ev) => setF("collegeId", ev.target.value)}>
                  <option value="">All colleges</option>
                  {options.colleges.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Domain" htmlFor="bf-domain">
                <Select id="bf-domain" value={filters.domainId} onChange={(ev) => setF("domainId", ev.target.value)}>
                  <option value="">All domains</option>
                  {options.domains.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Session" htmlFor="bf-session">
                <Select id="bf-session" value={filters.session} onChange={(ev) => setF("session", ev.target.value)}>
                  <option value="">All sessions</option>
                  {options.sessions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Semester" htmlFor="bf-sem">
                <Select id="bf-sem" value={filters.semester} onChange={(ev) => setF("semester", ev.target.value)}>
                  <option value="">All semesters</option>
                  {options.semesters.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Internship status" htmlFor="bf-status">
                <Select id="bf-status" value={filters.status} onChange={(ev) => setF("status", ev.target.value)}>
                  <option value="">Any status</option>
                  {options.statuses.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Payment" htmlFor="bf-pay">
                <Select id="bf-pay" value={filters.paymentStatus} onChange={(ev) => setF("paymentStatus", ev.target.value)}>
                  <option value="">Paid & unpaid</option>
                  <option value="PAID">Paid</option>
                  <option value="UNPAID">Unpaid</option>
                </Select>
              </Field>
              <Field label="Start date from" htmlFor="bf-sf">
                <Input id="bf-sf" type="date" value={filters.startFrom} onChange={(ev) => setF("startFrom", ev.target.value)} />
              </Field>
              <Field label="Start date to" htmlFor="bf-st" error={e.startTo ?? e["filters.startTo"]}>
                <Input id="bf-st" type="date" value={filters.startTo} onChange={(ev) => setF("startTo", ev.target.value)} invalid={Boolean(e.startTo)} />
              </Field>
            </div>
            <Field label="Registration numbers" htmlFor="bf-reg" hint={regNos.length ? `${regNos.length} number(s) — university or MSY College registration numbers` : "Optional — one per line or separated by commas"} error={e.regNos ?? e["filters.regNos"]}>
              <Textarea id="bf-reg" rows={3} value={filters.regNos} onChange={(ev) => setF("regNos", ev.target.value)} placeholder={"23MISTBCOM0139\nMSY26000012"} className="font-mono text-xs" />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="2. Choose an operation" description="Operations marked “Creates records” change student data." icon={<Sparkles className="size-5" />} />
          <CardBody className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Operation">
              {BULK_OPERATIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={op === o.value}
                  onClick={() => setOp(o.value)}
                  className={cn(
                    "rounded-xl border px-3.5 py-3 text-left transition",
                    op === o.value ? "border-brand-500 bg-brand-50/70 ring-2 ring-brand-500/20" : "border-slate-200 bg-white hover:border-brand-200 hover:bg-slate-50",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{o.label}</span>
                    {GENERATING.has(o.value) ? <Badge tone="amber">Creates records</Badge> : <Badge tone="blue">Documents</Badge>}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">{o.description}</span>
                </button>
              ))}
            </div>

            {(showAttendance || op === "LEARNING" || op === "ZIP") && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-800">Options</p>
                <div className="space-y-4">
                  {showAttendance && (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Attendance from" htmlFor="bo-af" hint="Default: internship start">
                        <Input id="bo-af" type="date" value={opt.attendanceFrom} onChange={(ev) => setOpt((s) => ({ ...s, attendanceFrom: ev.target.value }))} />
                      </Field>
                      <Field label="Attendance to" htmlFor="bo-at" hint="Default: today or end date" error={e.attendanceTo ?? e["options.attendanceTo"]}>
                        <Input id="bo-at" type="date" value={opt.attendanceTo} onChange={(ev) => setOpt((s) => ({ ...s, attendanceTo: ev.target.value }))} invalid={Boolean(e.attendanceTo)} />
                      </Field>
                      <Field label={`Present ratio: ${opt.presentRatio}%`} htmlFor="bo-pr" hint="Remaining missing days are marked absent">
                        <input id="bo-pr" type="range" min={50} max={100} step={5} value={opt.presentRatio} onChange={(ev) => setOpt((s) => ({ ...s, presentRatio: ev.target.value }))} className="mt-3 w-full accent-brand-600" />
                      </Field>
                    </div>
                  )}
                  {(op === "LEARNING" || op === "FULL_LIFECYCLE") && (
                    <Checkbox checked={opt.includeQuizzes} onChange={(ev) => setOpt((s) => ({ ...s, includeQuizzes: ev.target.checked }))} label="Create passing quiz attempts for chapters that have a quiz" />
                  )}
                  {op === "FULL_LIFECYCLE" && (
                    <Checkbox
                      checked={opt.generateSubmissions}
                      onChange={(ev) => setOpt((s) => ({ ...s, generateSubmissions: ev.target.checked }))}
                      label="Create approved live-project and report records where missing (needed for certificate eligibility)"
                    />
                  )}
                  {(op === "ZIP" || op === "FULL_LIFECYCLE") && (
                    <Checkbox checked={opt.includeReceipts} onChange={(ev) => setOpt((s) => ({ ...s, includeReceipts: ev.target.checked }))} label="Include payment receipts in each student's folder" />
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              {stale && <span className="text-xs text-amber-700">Selection changed — preview again before running.</span>}
              <Button variant={preview && !stale ? "outline" : "primary"} icon={<Eye className="size-4" />} loading={pv.loading} onClick={doPreview}>
                {preview && !stale ? "Refresh preview" : "Preview"}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="xl:col-span-2">
        <Card className="xl:sticky xl:top-20">
          <CardHeader title="3. Preview & run" description="Nothing changes until you run the job." icon={<Users className="size-5" />} />
          <CardBody className="space-y-4">
            {!preview ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">Choose the students and an operation, then select Preview to see who will be processed and what will be created.</p>
            ) : (
              <div className={cn("space-y-4", stale && "opacity-60")}>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric label="Matched" value={preview.matched} />
                  <Metric label="Eligible" value={preview.eligible} tone={preview.eligible ? "brand" : "red"} />
                  <Metric label="Working days" value={preview.workingDays} />
                </div>
                {preview.overLimit && (
                  <Alert tone="error" icon={<AlertTriangle />}>
                    {formatNumber(preview.eligible)} students are eligible. A job can process at most {MAX}; narrow the filters.
                  </Alert>
                )}
                {preview.excluded.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-slate-500 uppercase">Not processed</p>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.excluded.map((x) => (
                        <Badge key={x.reason} tone="gray">
                          {x.reason}: {x.count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {preview.unmatchedRegNos.length > 0 && (
                  <Alert tone="warning" title="Registration numbers not found">
                    <span className="font-mono text-xs break-all">{preview.unmatchedRegNos.join(", ")}</span>
                  </Alert>
                )}
                {preview.estimates.length > 0 && (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {preview.estimates.map((x) => (
                      <li key={x.label} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-slate-600">{x.label}</span>
                        <b className="text-slate-900 tabular-nums">{formatNumber(x.value)}</b>
                      </li>
                    ))}
                  </ul>
                )}
                {preview.sample.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-slate-500 uppercase">
                      Sample {preview.sample.length < preview.eligible ? `(${preview.sample.length} of ${preview.eligible})` : ""}
                    </p>
                    <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                      <Table>
                        <THead>
                          <TR>
                            <TH>Student</TH>
                            <TH>Start</TH>
                            <TH>Status</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {preview.sample.map((s) => (
                            <TR key={s.id}>
                              <TD>
                                <p className="font-medium text-slate-900">{s.name}</p>
                                <p className="text-[11px] text-slate-500">
                                  {s.regNo} · {s.domain}
                                </p>
                              </TD>
                              <TD className="text-xs whitespace-nowrap">{formatDate(s.start)}</TD>
                              <TD>
                                <StatusBadge status={s.status} />
                              </TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </div>
                  </div>
                )}

                {generating && preview.eligible > 0 && !preview.overLimit && (
                  <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                    <p className="flex items-start gap-2 text-sm text-amber-900">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      This operation creates or changes records for {formatNumber(preview.eligible)} student(s). Generated records are flagged and the job is audited.
                    </p>
                    <Field label="Reason" htmlFor="br-reason" required error={e.reason}>
                      <Textarea id="br-reason" rows={2} value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={500} invalid={Boolean(e.reason)} placeholder="e.g. Offline batch attended classroom sessions; attendance registers verified by the college" />
                    </Field>
                    <Field label={<>Type <span className="font-mono text-amber-800">{CONFIRM}</span> to confirm</>} htmlFor="br-confirm" required error={e.confirm}>
                      <Input id="br-confirm" value={confirm} onChange={(ev) => setConfirm(ev.target.value)} autoComplete="off" invalid={Boolean(e.confirm)} />
                    </Field>
                  </div>
                )}
                <Button
                  className="w-full"
                  variant={generating ? "danger" : "primary"}
                  icon={<Play className="size-4" />}
                  loading={runner.loading}
                  disabled={!canRun || (generating && confirm.trim() !== CONFIRM)}
                  onClick={doRun}
                >
                  Run for {formatNumber(preview.eligible)} student(s)
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "gray" }: { label: string; value: number; tone?: "gray" | "brand" | "red" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-2 py-2.5">
      <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={cn("font-display text-xl font-bold tabular-nums", tone === "brand" ? "text-brand-700" : tone === "red" ? "text-rose-600" : "text-slate-900")}>{formatNumber(value)}</p>
    </div>
  );
}
