"use client";
import { useState } from "react";
import { EyeOff, Pencil, Trash2, Upload } from "lucide-react";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { toISTInput } from "@/components/admin/ops/datetime";

export interface RoutineValue {
  id: string;
  title: string;
  description: string | null;
  domainId: string | null;
  publishAt: string;
  active: boolean;
  fileName: string;
}

type Opt = { value: string; label: string };
const MAX = 10 * 1024 * 1024;

export function NewRoutineButton({ domains }: { domains: Opt[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={<Upload className="size-4" />} onClick={() => setOpen(true)}>
        Upload routine
      </Button>
      {open && <RoutineForm domains={domains} onClose={() => setOpen(false)} />}
    </>
  );
}

export function RoutineForm({ domains, value, onClose }: { domains: Opt[]; value?: RoutineValue; onClose: () => void }) {
  const { run, loading, fields } = useAction();
  const [title, setTitle] = useState(value?.title ?? "");
  const [description, setDescription] = useState(value?.description ?? "");
  const [domainId, setDomainId] = useState(value?.domainId ?? "");
  const [publishAt, setPublishAt] = useState(value ? toISTInput(value.publishAt) : toISTInput(new Date()));
  const [active, setActive] = useState(value?.active ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n: Record<string, string> = {};
    if (title.trim().length < 3) n.title = "Title must be at least 3 characters";
    if (!publishAt) n.publishAt = "Select the publish date and time";
    if (!value && !file) n.file = "Attach a PDF, JPG, PNG or WEBP file";
    setErrs(n);
    if (Object.keys(n).length) return;
    const form = new FormData();
    form.set("title", title.trim());
    form.set("description", description.trim());
    form.set("domainId", domainId);
    form.set("publishAt", publishAt);
    form.set("active", String(active));
    if (file) form.set("file", file);
    const ok = await run(() => api(value ? `/api/admin/routines/${value.id}` : "/api/admin/routines", { method: value ? "PATCH" : "POST", form }), {
      success: value ? "Routine updated" : "Routine uploaded",
      refresh: true,
    });
    if (ok) onClose();
  };
  const e = { ...fields, ...errs };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={value ? "Edit routine" : "Upload routine"}
      description="Students see active routines of their domain (or all domains) from the publish time onwards."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="routine-form" loading={loading}>
            {value ? "Save changes" : "Upload"}
          </Button>
        </>
      }
    >
      <form id="routine-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Title" htmlFor="rt-title" required error={e.title}>
          <Input id="rt-title" value={title} onChange={(ev) => setTitle(ev.target.value)} maxLength={150} invalid={Boolean(e.title)} placeholder="e.g. Weekly routine — October 2026" />
        </Field>
        <Field label="Description" htmlFor="rt-desc" error={e.description}>
          <Textarea id="rt-desc" rows={2} value={description} onChange={(ev) => setDescription(ev.target.value)} maxLength={1000} placeholder="Optional" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Domain" htmlFor="rt-domain" error={e.domainId} hint="Leave as “All domains” to show it to every student.">
            <Select id="rt-domain" value={domainId} onChange={(ev) => setDomainId(ev.target.value)}>
              <option value="">All domains</option>
              {domains.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Publish date & time (IST)" htmlFor="rt-publish" required error={e.publishAt}>
            <Input id="rt-publish" type="datetime-local" value={publishAt} onChange={(ev) => setPublishAt(ev.target.value)} invalid={Boolean(e.publishAt)} />
          </Field>
        </div>
        <Field label={value ? "Replace file" : "Routine file"} required={!value} error={e.file}>
          {value && !file && <p className="mb-2 text-xs text-slate-500">Current file: {value.fileName}. Choose a new file only if you want to replace it.</p>}
          <FileInput accept=".pdf,.jpg,.jpeg,.png,.webp" maxBytes={MAX} value={file} onChange={setFile} preview hint="PDF, JPG, PNG or WEBP · max 10 MB" />
        </Field>
        <Switch checked={active} onChange={setActive} label={active ? "Active — visible to students" : "Hidden — not visible to students"} />
      </form>
    </Modal>
  );
}

export function RoutineActions({ value, domains }: { value: RoutineValue; domains: Opt[] }) {
  const [mode, setMode] = useState<"none" | "edit" | "delete">("none");
  const del = useAction();
  const toggle = useAction();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Switch
        checked={value.active}
        disabled={toggle.loading}
        onChange={(v) => toggle.run(() => api(`/api/admin/routines/${value.id}`, { method: "PUT", body: { active: v } }), { success: v ? "Routine is now visible" : "Routine hidden", refresh: true })}
        label={<span className="text-xs text-slate-600">{value.active ? "Active" : <span className="inline-flex items-center gap-1"><EyeOff className="size-3" /> Hidden</span>}</span>}
      />
      <div className="flex gap-1.5">
        <Button size="xs" variant="outline" icon={<Pencil className="size-3.5" />} onClick={() => setMode("edit")}>
          Edit
        </Button>
        <Button size="xs" variant="ghost" className="text-rose-600 hover:bg-rose-50" icon={<Trash2 className="size-3.5" />} onClick={() => setMode("delete")} aria-label={`Delete ${value.title}`}>
          Delete
        </Button>
      </div>
      {mode === "edit" && <RoutineForm domains={domains} value={value} onClose={() => setMode("none")} />}
      <ConfirmDialog
        open={mode === "delete"}
        onClose={() => setMode("none")}
        tone="danger"
        confirmLabel="Delete routine"
        loading={del.loading}
        title="Delete this routine?"
        description={value.title}
        onConfirm={async () => {
          const ok = await del.run(() => api(`/api/admin/routines/${value.id}`, { method: "DELETE" }), { success: "Routine deleted", refresh: true });
          if (ok) setMode("none");
        }}
      >
        <p className="text-sm text-slate-600">The routine and its file are permanently removed. Students will no longer be able to download it.</p>
      </ConfirmDialog>
    </div>
  );
}
