"use client";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Award, CalendarRange, Check, CreditCard, KeyRound, ListChecks, Pencil, Plus, Save, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input, Switch } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/page";
import { cn } from "@/components/ui/cn";

// ───────────── Certificate eligibility ─────────────

interface Eligibility {
  minAttendancePercent: number;
  minHoursPercent: number;
  minQuizAverage: number;
  requireAllChapters: boolean;
  requireProjectApproved: boolean;
  requireReportApproved: boolean;
  requireMentorRecommendation: boolean;
}

const pctErr = (s: string, label: string) => {
  if (s.trim() === "") return `Enter ${label}`;
  if (!/^\d+$/.test(s.trim())) return "Enter a whole number";
  const n = Number(s);
  return n < 0 || n > 100 ? "Enter a value between 0 and 100" : null;
};

export function EligibilityForm({ initial }: { initial: Eligibility }) {
  const [nums, setNums] = useState({
    minAttendancePercent: String(initial.minAttendancePercent),
    minHoursPercent: String(initial.minHoursPercent),
    minQuizAverage: String(initial.minQuizAverage),
  });
  const [flags, setFlags] = useState({
    requireAllChapters: initial.requireAllChapters,
    requireProjectApproved: initial.requireProjectApproved,
    requireReportApproved: initial.requireReportApproved,
    requireMentorRecommendation: initial.requireMentorRecommendation,
  });
  const [clientErr, setClientErr] = useState<Record<string, string>>({});
  const { run, loading, fields } = useAction();
  const errors = { ...fields, ...clientErr };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const labels = { minAttendancePercent: "minimum attendance", minHoursPercent: "minimum hours", minQuizAverage: "minimum quiz average" } as const;
    for (const k of Object.keys(labels) as (keyof typeof labels)[]) {
      const m = pctErr(nums[k], labels[k]);
      if (m) errs[k] = m;
    }
    setClientErr(errs);
    if (Object.keys(errs).length) return;
    await run(
      () =>
        api("/api/admin/settings/eligibility", {
          method: "PUT",
          body: { minAttendancePercent: Number(nums.minAttendancePercent), minHoursPercent: Number(nums.minHoursPercent), minQuizAverage: Number(nums.minQuizAverage), ...flags },
        }),
      { success: "Eligibility rules saved", successDescription: "New rules apply to eligibility checks, results and certificates from now on.", refresh: true },
    );
  };

  const numField = (k: keyof typeof nums, label: string, hint: string) => (
    <Field label={label} htmlFor={k} required error={errors[k]} hint={hint}>
      <div className="relative">
        <Input id={k} inputMode="numeric" value={nums[k]} onChange={(e) => setNums((s) => ({ ...s, [k]: e.target.value.replace(/\D/g, "").slice(0, 3) }))} invalid={Boolean(errors[k])} className="pr-8" />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">%</span>
      </div>
    </Field>
  );

  return (
    <form onSubmit={save} noValidate>
      <Card>
        <CardHeader title="Certificate eligibility rules" description="A student must meet every rule below to pass and receive a QR-verified certificate." icon={<Award className="size-5" />} />
        <CardBody className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {numField("minAttendancePercent", "Minimum attendance", "Of working days in the internship window.")}
            {numField("minHoursPercent", "Minimum logged hours", "Logbook hours as a percentage of the domain duration.")}
            {numField("minQuizAverage", "Minimum quiz average", "Average of best attempts across chapter quizzes.")}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["requireAllChapters", "All chapters completed", "Every chapter in the domain must be complete."],
                ["requireProjectApproved", "Live project approved", "The mentor must approve the live project."],
                ["requireReportApproved", "Internship report approved", "The mentor must approve the final report."],
                ["requireMentorRecommendation", "Mentor recommends certificate", "Recorded in the mentor's assessment."],
              ] as const
            ).map(([k, label, desc]) => (
              <div key={k} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
                <Switch checked={flags[k]} onChange={(v) => setFlags((s) => ({ ...s, [k]: v }))} label={<span className="sr-only">{label}</span>} />
              </div>
            ))}
          </div>
        </CardBody>
        <CardFooter>
          <Button type="submit" loading={loading} icon={<Save className="size-4" />}>
            Save rules
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

// ───────────── Internship defaults ─────────────

export function InternshipForm({ initial }: { initial: { defaultWeeks: number; checkInFrom: string; halfDayBelowHours: number } }) {
  const [weeks, setWeeks] = useState(String(initial.defaultWeeks));
  const [checkIn, setCheckIn] = useState(initial.checkInFrom);
  const [halfDay, setHalfDay] = useState(String(initial.halfDayBelowHours));
  const [clientErr, setClientErr] = useState<Record<string, string>>({});
  const { run, loading, fields } = useAction();
  const errors = { ...fields, ...clientErr };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const w = Number(weeks);
    if (!/^\d+$/.test(weeks) || w < 1 || w > 52) errs.defaultWeeks = "Enter 1–52 weeks";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(checkIn)) errs.checkInFrom = "Use HH:MM (24-hour)";
    const h = Number(halfDay);
    if (!halfDay.trim() || !Number.isFinite(h) || h < 0.5 || h > 12) errs.halfDayBelowHours = "Enter 0.5–12 hours";
    setClientErr(errs);
    if (Object.keys(errs).length) return;
    await run(() => api("/api/admin/settings/internship", { method: "PUT", body: { defaultWeeks: w, checkInFrom: checkIn, halfDayBelowHours: h } }), {
      success: "Internship defaults saved",
      refresh: true,
    });
  };

  return (
    <form onSubmit={save} noValidate>
      <Card>
        <CardHeader title="Internship defaults" description="Used when scheduling internships and evaluating daily attendance." icon={<CalendarRange className="size-5" />} />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Default duration (weeks)" htmlFor="defaultWeeks" required error={errors.defaultWeeks} hint="End date = start date + this many weeks (editable per student).">
            <Input id="defaultWeeks" inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value.replace(/\D/g, "").slice(0, 2))} invalid={Boolean(errors.defaultWeeks)} />
          </Field>
          <Field label="Check-in opens at (IST)" htmlFor="checkInFrom" required error={errors.checkInFrom} hint="Students cannot check in before this time.">
            <Input id="checkInFrom" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} invalid={Boolean(errors.checkInFrom)} />
          </Field>
          <Field label="Half day below (hours)" htmlFor="halfDayBelowHours" required error={errors.halfDayBelowHours} hint="Check-in to check-out shorter than this counts as a half day.">
            <Input id="halfDayBelowHours" inputMode="decimal" value={halfDay} onChange={(e) => setHalfDay(e.target.value.replace(/[^\d.]/g, "").slice(0, 4))} invalid={Boolean(errors.halfDayBelowHours)} />
          </Field>
        </CardBody>
        <CardFooter>
          <Button type="submit" loading={loading} icon={<Save className="size-4" />}>
            Save defaults
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

// ───────────── Payment gateway ─────────────

type GatewayPref = "auto" | "razorpay" | "cashfree" | "sandbox";

export function PaymentForm({
  initial,
  status,
  activeGateway,
  envPreference,
}: {
  initial: GatewayPref;
  status: { razorpay: boolean; cashfree: boolean; sandbox: boolean };
  activeGateway: string;
  envPreference: string | null;
}) {
  const [pref, setPref] = useState<GatewayPref>(initial);
  const { run, loading } = useAction();
  const options: { value: GatewayPref; label: string; desc: string; configured: boolean }[] = [
    { value: "auto", label: "Automatic", desc: "Razorpay if configured, otherwise Cashfree, otherwise the sandbox.", configured: true },
    { value: "razorpay", label: "Razorpay", desc: "Requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.", configured: status.razorpay },
    { value: "cashfree", label: "Cashfree", desc: "Requires CASHFREE_APP_ID and CASHFREE_SECRET_KEY.", configured: status.cashfree },
    { value: "sandbox", label: "Sandbox", desc: "Built-in test checkout. Never use in production.", configured: status.sandbox },
  ];
  const chosen = options.find((o) => o.value === pref)!;

  return (
    <Card>
      <CardHeader title="Payment gateway" description="The server picks the gateway for every new order." icon={<CreditCard className="size-5" />} />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((o) => (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                pref === o.value ? "border-brand-400 bg-brand-50/60 ring-1 ring-brand-400" : "border-slate-200 hover:border-slate-300",
              )}
            >
              <input type="radio" name="gateway" className="mt-1 accent-brand-600" checked={pref === o.value} onChange={() => setPref(o.value)} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                  {o.label}
                  {o.value !== "auto" && (o.configured ? <Badge tone="green" dot>Configured</Badge> : <Badge tone="gray" dot>Not configured</Badge>)}
                  {activeGateway.toLowerCase() === o.value && <Badge tone="brand">In use</Badge>}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{o.desc}</span>
              </span>
            </label>
          ))}
        </div>
        {!chosen.configured && (
          <Alert tone="warning" title={`${chosen.label} is not configured`}>
            New orders will fall back to the next available gateway until its API keys are set on the server.
          </Alert>
        )}
        {pref === "auto" && envPreference && (
          <Alert tone="info">
            The server environment prefers <b>{envPreference}</b> (PAYMENT_GATEWAY) when this setting is Automatic.
          </Alert>
        )}
        <p className="text-sm text-slate-500">
          Currently used for new orders: <b className="text-slate-700">{activeGateway}</b>
        </p>
      </CardBody>
      <CardFooter>
        <Button
          loading={loading}
          disabled={pref === initial}
          icon={<Save className="size-4" />}
          onClick={() => run(() => api("/api/admin/settings/payments", { method: "PUT", body: { gateway: pref } }), { success: "Payment gateway preference saved", refresh: true })}
        >
          Save preference
        </Button>
      </CardFooter>
    </Card>
  );
}

// ───────────── Master data (G-4) ─────────────

interface OptionRow {
  id: string;
  type: string;
  value: string;
  label: string;
  active: boolean;
  students: number;
}

const TYPE_META: Record<string, { title: string; description: string; placeholder: string; hint: string }> = {
  SESSION: { title: "Sessions", description: "Academic sessions offered in registration and filters.", placeholder: "2025-29", hint: "Format YYYY-YY" },
  SEMESTER: { title: "Semesters", description: "Semesters eligible for the internship.", placeholder: "5", hint: "Semester number" },
  PROGRAMME: { title: "Programmes", description: "Degree programmes students can select.", placeholder: "BSc (IT)", hint: "Short programme name" },
};

export function MasterOptionsEditor({ options }: { options: OptionRow[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {(["SESSION", "SEMESTER", "PROGRAMME"] as const).map((type) => (
        <OptionList key={type} type={type} rows={options.filter((o) => o.type === type)} />
      ))}
    </div>
  );
}

function OptionList({ type, rows }: { type: string; rows: OptionRow[] }) {
  const meta = TYPE_META[type]!;
  const [order, setOrder] = useState(rows);
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [addErr, setAddErr] = useState<string | null>(null);
  const add = useAction();
  const act = useAction();

  useEffect(() => setOrder(rows), [rows]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    let err: string | null = null;
    if (!v) err = "Enter a value";
    else if (type === "SESSION" && !/^\d{4}-\d{2}$/.test(v)) err = "Use the format YYYY-YY, e.g. 2025-29";
    else if (type === "SEMESTER" && !/^\d{1,2}$/.test(v)) err = "Enter the semester number";
    else if (order.some((o) => o.value.toLowerCase() === v.toLowerCase())) err = "This value already exists";
    setAddErr(err);
    if (err) return;
    const res = await add.run(() => api("/api/admin/settings/master-options", { body: { type, value: v, label: label.trim() || undefined } }), { success: `${meta.title.slice(0, -1)} added`, refresh: true });
    if (res) {
      setValue("");
      setLabel("");
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...order];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    const prev = order;
    setOrder(next);
    const res = await act.run(() => api("/api/admin/settings/master-options", { method: "PUT", body: { type, ids: next.map((o) => o.id) } }), { refresh: true });
    if (!res) setOrder(prev);
  };

  const saveLabel = async (id: string) => {
    if (!editLabel.trim()) return;
    const res = await act.run(() => api(`/api/admin/settings/master-options/${id}`, { method: "PATCH", body: { label: editLabel.trim() } }), { success: "Label updated", refresh: true });
    if (res) setEditing(null);
  };

  return (
    <Card className="flex flex-col">
      <CardHeader title={meta.title} description={meta.description} icon={<ListChecks className="size-5" />} />
      <ul className="flex-1 divide-y divide-slate-100">
        {order.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-500">No options yet. Add the first one below.</li>}
        {order.map((o, i) => (
          <li key={o.id} className={cn("flex items-center gap-2 px-4 py-2.5", !o.active && "bg-slate-50/70")}>
            <div className="flex flex-col">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || act.loading} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label={`Move ${o.label} up`}>
                <ArrowUp className="size-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1 || act.loading} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label={`Move ${o.label} down`}>
                <ArrowDown className="size-3.5" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              {editing === o.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="h-8"
                    maxLength={80}
                    autoFocus
                    aria-label="Label"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveLabel(o.id);
                      }
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                  <Button size="xs" variant="ghost" onClick={() => saveLabel(o.id)} disabled={!editLabel.trim()} aria-label="Save label" icon={<Check className="size-3.5" />} />
                  <Button size="xs" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancel" icon={<X className="size-3.5" />} />
                </div>
              ) : (
                <>
                  <p className={cn("truncate text-sm font-medium", o.active ? "text-slate-900" : "text-slate-500")}>{o.label}</p>
                  <p className="text-xs text-slate-500">
                    <span className="font-mono">{o.value}</span> · {o.students} student{o.students === 1 ? "" : "s"}
                  </p>
                </>
              )}
            </div>
            {editing !== o.id && (
              <Button
                size="xs"
                variant="ghost"
                aria-label={`Edit ${o.label}`}
                icon={<Pencil className="size-3.5" />}
                onClick={() => {
                  setEditing(o.id);
                  setEditLabel(o.label);
                }}
              />
            )}
            <Switch
              checked={o.active}
              disabled={act.loading}
              onChange={(v) => act.run(() => api(`/api/admin/settings/master-options/${o.id}`, { method: "PATCH", body: { active: v } }), { success: v ? "Option activated" : "Option hidden", refresh: true })}
              label={<span className="sr-only">{o.active ? "Active" : "Inactive"}</span>}
            />
          </li>
        ))}
      </ul>
      <form onSubmit={onAdd} noValidate className="space-y-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 rounded-b-2xl">
        <div className="grid grid-cols-2 gap-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={meta.placeholder} aria-label={`New ${meta.title.toLowerCase()} value`} invalid={Boolean(addErr)} maxLength={40} className="h-9" />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" aria-label="Label" maxLength={80} className="h-9" />
        </div>
        {addErr ? <p className="text-xs font-medium text-rose-600">{addErr}</p> : <p className="text-xs text-slate-500">{meta.hint}. Inactive options stay on existing records but are hidden from new selections.</p>}
        <Button type="submit" size="sm" variant="secondary" loading={add.loading} icon={<Plus className="size-4" />}>
          Add
        </Button>
      </form>
    </Card>
  );
}

// ───────────── Admin change password ─────────────

export function ChangePasswordForm({ username }: { username: string }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [clientErr, setClientErr] = useState<Record<string, string>>({});
  const { run, loading, fields } = useAction();
  const errors = { ...fields, ...clientErr };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = "Enter your current password";
    if (newPassword.length < 8) errs.newPassword = "Password must be at least 8 characters";
    else if (newPassword === currentPassword) errs.newPassword = "Choose a password different from the current one";
    if (!errs.newPassword && newPassword !== confirmPassword) errs.confirmPassword = "Passwords do not match";
    setClientErr(errs);
    if (Object.keys(errs).length) return;
    const res = await run(() => api("/api/auth/change-password", { body: { currentPassword, newPassword, confirmPassword } }), {
      success: "Password changed",
      successDescription: "You have been signed out of your other devices.",
    });
    if (res) {
      setCurrent("");
      setNew("");
      setConfirm("");
    }
  };

  return (
    <form onSubmit={save} noValidate className="max-w-xl">
      <Card>
        <CardHeader title="Change password" description={`Signed in as ${username}. Other sessions are signed out after a change.`} icon={<KeyRound className="size-5" />} />
        <CardBody className="space-y-4">
          <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
          <Field label="Current password" htmlFor="currentPassword" required error={errors.currentPassword}>
            <Input id="currentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} invalid={Boolean(errors.currentPassword)} />
          </Field>
          <Field label="New password" htmlFor="newPassword" required error={errors.newPassword} hint="At least 8 characters.">
            <Input id="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} invalid={Boolean(errors.newPassword)} />
          </Field>
          <Field label="Confirm new password" htmlFor="confirmPassword" required error={errors.confirmPassword}>
            <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirm(e.target.value)} invalid={Boolean(errors.confirmPassword)} />
          </Field>
        </CardBody>
        <CardFooter>
          <Button type="submit" loading={loading} icon={<Save className="size-4" />}>
            Change password
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
