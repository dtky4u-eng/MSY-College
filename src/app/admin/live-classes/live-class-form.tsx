"use client";
import { useMemo, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { toISTInput } from "@/components/admin/ops/datetime";

export interface DomainTree {
  id: string;
  name: string;
  modules: { id: string; number: number; name: string; chapters: { id: string; number: number; name: string }[] }[];
}

export interface LiveClassValue {
  id: string;
  title: string;
  description: string | null;
  domainId: string;
  moduleId: string | null;
  chapterId: string | null;
  meetingLink: string;
  startsAt: string; // ISO
  trainer: string;
  durationMinutes: number;
  popupMinutes: number;
}

export function NewLiveClassButton({ domains }: { domains: DomainTree[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={<CalendarPlus className="size-4" />} onClick={() => setOpen(true)} disabled={domains.length === 0}>
        Schedule class
      </Button>
      {open && <LiveClassForm domains={domains} onClose={() => setOpen(false)} />}
    </>
  );
}

function validUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function LiveClassForm({ domains, value, onClose }: { domains: DomainTree[]; value?: LiveClassValue; onClose: () => void }) {
  const { run, loading, fields } = useAction();
  const [f, setF] = useState({
    title: value?.title ?? "",
    description: value?.description ?? "",
    domainId: value?.domainId ?? "",
    moduleId: value?.moduleId ?? "",
    chapterId: value?.chapterId ?? "",
    meetingLink: value?.meetingLink ?? "",
    startsAt: value ? toISTInput(value.startsAt) : "",
    trainer: value?.trainer ?? "",
    durationMinutes: String(value?.durationMinutes ?? 60),
    popupMinutes: String(value?.popupMinutes ?? 10),
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const domain = useMemo(() => domains.find((d) => d.id === f.domainId), [domains, f.domainId]);
  const mod = useMemo(() => domain?.modules.find((m) => m.id === f.moduleId), [domain, f.moduleId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n: Record<string, string> = {};
    if (f.title.trim().length < 3) n.title = "Title must be at least 3 characters";
    if (!f.domainId) n.domainId = "Select a domain";
    if (!f.meetingLink.trim()) n.meetingLink = "Enter the meeting link";
    else if (!validUrl(f.meetingLink.trim())) n.meetingLink = "Enter a valid meeting URL starting with https://";
    if (!f.startsAt) n.startsAt = "Select the date and time";
    else if (!value && new Date(`${f.startsAt}:00+05:30`).getTime() < Date.now()) n.startsAt = "Choose a future date and time";
    if (f.trainer.trim().length < 2) n.trainer = "Enter the trainer's name";
    const dur = Number(f.durationMinutes);
    if (!Number.isInteger(dur) || dur < 15 || dur > 480) n.durationMinutes = "Enter 15–480 minutes";
    const pop = Number(f.popupMinutes);
    if (!Number.isInteger(pop) || pop < 0 || pop > 120) n.popupMinutes = "Enter 0–120 minutes";
    setErrs(n);
    if (Object.keys(n).length) return;
    const body = { ...f, durationMinutes: dur, popupMinutes: pop, moduleId: f.moduleId || null, chapterId: f.chapterId || null };
    const res = await run<{ notified: number }>(() => api(value ? `/api/admin/live-classes/${value.id}` : "/api/admin/live-classes", { method: value ? "PATCH" : "POST", body }), {
      success: value ? "Live class updated" : "Live class scheduled",
      refresh: true,
    });
    if (res) onClose();
  };
  const e = { ...fields, ...errs };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={value ? "Edit live class" : "Schedule a live class"}
      description={value ? "Students are notified if the time or link changes." : "Paid students of the selected domain are notified as soon as the class is scheduled."}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="live-class-form" loading={loading}>
            {value ? "Save changes" : "Schedule class"}
          </Button>
        </>
      }
    >
      <form id="live-class-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Title" htmlFor="lc-title" required error={e.title}>
          <Input id="lc-title" value={f.title} onChange={(ev) => set("title", ev.target.value)} maxLength={150} invalid={Boolean(e.title)} placeholder="e.g. React hooks — live Q&A" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Domain" htmlFor="lc-domain" required error={e.domainId}>
            <Select
              id="lc-domain"
              value={f.domainId}
              invalid={Boolean(e.domainId)}
              onChange={(ev) => setF((s) => ({ ...s, domainId: ev.target.value, moduleId: "", chapterId: "" }))}
            >
              <option value="">Select domain</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Module" htmlFor="lc-module" error={e.moduleId} hint="Optional">
            <Select id="lc-module" value={f.moduleId} disabled={!domain || domain.modules.length === 0} onChange={(ev) => setF((s) => ({ ...s, moduleId: ev.target.value, chapterId: "" }))}>
              <option value="">{domain && domain.modules.length === 0 ? "No modules" : "Whole domain"}</option>
              {domain?.modules.map((m) => (
                <option key={m.id} value={m.id}>
                  Module {m.number}: {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Chapter" htmlFor="lc-chapter" error={e.chapterId} hint="Optional">
            <Select id="lc-chapter" value={f.chapterId} disabled={!mod || mod.chapters.length === 0} onChange={(ev) => set("chapterId", ev.target.value)}>
              <option value="">{mod ? "Whole module" : "Select a module first"}</option>
              {mod?.chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.number}. {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Meeting link" htmlFor="lc-link" required error={e.meetingLink}>
          <Input id="lc-link" type="url" value={f.meetingLink} onChange={(ev) => set("meetingLink", ev.target.value)} maxLength={500} invalid={Boolean(e.meetingLink)} placeholder="https://meet.google.com/abc-defg-hij" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date & time (IST)" htmlFor="lc-start" required error={e.startsAt}>
            <Input id="lc-start" type="datetime-local" value={f.startsAt} onChange={(ev) => set("startsAt", ev.target.value)} invalid={Boolean(e.startsAt)} />
          </Field>
          <Field label="Trainer" htmlFor="lc-trainer" required error={e.trainer}>
            <Input id="lc-trainer" value={f.trainer} onChange={(ev) => set("trainer", ev.target.value)} maxLength={100} invalid={Boolean(e.trainer)} placeholder="Trainer name" />
          </Field>
          <Field label="Duration (minutes)" htmlFor="lc-dur" required error={e.durationMinutes}>
            <Input id="lc-dur" type="number" min={15} max={480} step={5} value={f.durationMinutes} onChange={(ev) => set("durationMinutes", ev.target.value)} invalid={Boolean(e.durationMinutes)} />
          </Field>
          <Field label="Popup lead time (minutes)" htmlFor="lc-pop" required error={e.popupMinutes} hint="Students see a reminder popup this long before the start.">
            <Input id="lc-pop" type="number" min={0} max={120} value={f.popupMinutes} onChange={(ev) => set("popupMinutes", ev.target.value)} invalid={Boolean(e.popupMinutes)} />
          </Field>
        </div>
        <Field label="Description" htmlFor="lc-desc" error={e.description}>
          <Textarea id="lc-desc" rows={3} value={f.description} onChange={(ev) => set("description", ev.target.value)} maxLength={2000} placeholder="Optional agenda or preparation notes" />
        </Field>
      </form>
    </Modal>
  );
}
