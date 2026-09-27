"use client";
import { useState } from "react";
import { Pencil, Save } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useT } from "@/components/i18n";
import type { TFn } from "@/lib/i18n";

interface Values {
  date: string;
  hours: string;
  activity: string;
  skills: string;
}

function validateEntry(v: Values, t: TFn, minDate: string, maxDate: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) e.date = t("err.invalidDate");
  else if (v.date > maxDate) e.date = t("err.futureDate");
  else if (v.date < minDate) e.date = t("err.beforeStart");
  const h = Number(v.hours);
  if (!v.hours || isNaN(h) || h < 0.5 || h > 12) e.hours = t("log.err.hours");
  else if (!Number.isInteger(h * 2)) e.hours = t("log.err.hoursStep");
  if (v.activity.trim().length < 10) e.activity = t("log.err.activityMin");
  else if (v.activity.trim().length > 2000) e.activity = t("log.err.activityMax");
  if (v.skills.trim().length < 2) e.skills = t("log.err.skillsMin");
  else if (v.skills.trim().length > 500) e.skills = t("log.err.skillsMax");
  return e;
}

function EntryFields({ v, set, errors, minDate, maxDate, disabled }: { v: Values; set: (p: Partial<Values>) => void; errors: Record<string, string>; minDate: string; maxDate: string; disabled?: boolean }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("log.date")} htmlFor="lb-date" required error={errors.date}>
          <Input id="lb-date" type="date" min={minDate} max={maxDate} value={v.date} onChange={(e) => set({ date: e.target.value })} invalid={Boolean(errors.date)} disabled={disabled} required />
        </Field>
        <Field label={t("log.hours")} htmlFor="lb-hours" required error={errors.hours} hint={t("log.hoursHint")}>
          <Input id="lb-hours" type="number" inputMode="decimal" min={0.5} max={12} step={0.5} value={v.hours} onChange={(e) => set({ hours: e.target.value })} invalid={Boolean(errors.hours)} disabled={disabled} required />
        </Field>
      </div>
      <Field label={t("log.activity")} htmlFor="lb-activity" required error={errors.activity} hint={t("log.activityHint", { n: v.activity.trim().length })}>
        <Textarea id="lb-activity" rows={5} maxLength={2000} value={v.activity} onChange={(e) => set({ activity: e.target.value })} invalid={Boolean(errors.activity)} disabled={disabled} placeholder={t("log.activityPlaceholder")} required />
      </Field>
      <Field label={t("log.skills")} htmlFor="lb-skills" required error={errors.skills} hint={t("log.skillsHint")}>
        <Input id="lb-skills" maxLength={500} value={v.skills} onChange={(e) => set({ skills: e.target.value })} invalid={Boolean(errors.skills)} disabled={disabled} placeholder={t("log.skillsPlaceholder")} required />
      </Field>
    </div>
  );
}

export function LogbookForm({ minDate, maxDate, defaultDate }: { minDate: string; maxDate: string; defaultDate: string }) {
  const t = useT();
  const { run, loading, fields } = useAction();
  const empty: Values = { date: defaultDate, hours: "4", activity: "", skills: "" };
  const [v, setV] = useState<Values>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (p: Partial<Values>) => setV((s) => ({ ...s, ...p }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateEntry(v, t, minDate, maxDate);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const r = await run(() => api("/api/student/logbook", { body: { ...v, hours: Number(v.hours) } }), { success: t("log.savedToast"), refresh: true });
    if (r !== undefined) setV({ ...empty, date: "" });
  };

  return (
    <form onSubmit={submit} noValidate className="p-5">
      <EntryFields v={v} set={set} errors={{ ...fields, ...errors }} minDate={minDate} maxDate={maxDate} disabled={loading} />
      <div className="mt-5 flex justify-end">
        <Button type="submit" icon={<Save className="size-4" />} loading={loading}>
          {t("log.save")}
        </Button>
      </div>
    </form>
  );
}

export function EditEntryButton({ entry, minDate, maxDate }: { entry: { id: string; date: string; hours: number; activity: string; skills: string }; minDate: string; maxDate: string }) {
  const t = useT();
  const { run, loading, fields } = useAction();
  const [open, setOpen] = useState(false);
  const initial: Values = { date: entry.date, hours: String(entry.hours), activity: entry.activity, skills: entry.skills };
  const [v, setV] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (p: Partial<Values>) => setV((s) => ({ ...s, ...p }));

  const save = async () => {
    const errs = validateEntry(v, t, minDate < entry.date ? minDate : entry.date, maxDate);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const r = await run(() => api(`/api/student/logbook/${entry.id}`, { method: "PATCH", body: { ...v, hours: Number(v.hours) } }), { success: t("log.updatedToast"), refresh: true });
    if (r !== undefined) setOpen(false);
  };

  return (
    <>
      <Button
        size="xs"
        variant="ghost"
        icon={<Pencil className="size-3.5" />}
        onClick={() => {
          setV(initial);
          setErrors({});
          setOpen(true);
        }}
      >
        {t("action.edit")}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("log.editTitle")}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              {t("action.cancel")}
            </Button>
            <Button onClick={save} loading={loading} icon={<Save className="size-4" />}>
              {t("action.save")}
            </Button>
          </>
        }
      >
        <EntryFields v={v} set={set} errors={{ ...fields, ...errors }} minDate={minDate} maxDate={maxDate} disabled={loading} />
      </Modal>
    </>
  );
}
