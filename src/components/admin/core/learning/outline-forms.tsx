"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { chapterCreateSchema, chapterUpdateSchema, checkFields, moduleCreateSchema, moduleUpdateSchema } from "./schemas";
import { learningHref, secondsToMinutes } from "./shared";
import type { ChapterValue, Filters, ModuleValue } from "./types";

type Size = "xs" | "sm" | "md";

function useLocalErrors<K extends string>() {
  const [local, setLocal] = useState<Record<string, string>>({});
  const clear = (k: K) =>
    setLocal((s) => {
      if (!(k in s)) return s;
      const next = { ...s };
      delete next[k];
      return next;
    });
  return { local, setLocal, clear };
}

// ── Module ──

interface ModuleForm {
  number: string;
  name: string;
  description: string;
}

export function ModuleFormButton({
  domainId,
  module,
  nextNumber = 1,
  filters,
  size = "sm",
  variant,
}: {
  domainId: string;
  module?: ModuleValue;
  nextNumber?: number;
  filters?: Filters;
  size?: Size;
  variant?: "primary" | "outline" | "ghost" | "secondary";
}) {
  const editing = Boolean(module);
  const init = (): ModuleForm => (module ? { number: String(module.number), name: module.name, description: module.description ?? "" } : { number: String(nextNumber), name: "", description: "" });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<ModuleForm>(init);
  const { local, setLocal, clear } = useLocalErrors<keyof ModuleForm>();
  const { run, loading, fields, setFields } = useAction();
  const router = useRouter();
  const err = (k: keyof ModuleForm) => local[k] ?? fields[k];
  const set = (k: keyof ModuleForm, value: string) => {
    setV((s) => ({ ...s, [k]: value }));
    clear(k);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = editing ? v : { ...v, domainId };
    const errs = checkFields(editing ? moduleUpdateSchema : moduleCreateSchema, payload);
    setLocal(errs);
    if (Object.keys(errs).length) return;
    const res = await run(
      () =>
        editing
          ? api<{ id: string }>(`/api/admin/learning/modules/${module!.id}`, { method: "PATCH", body: payload })
          : api<{ id: string }>("/api/admin/learning/modules", { body: payload }),
      { success: editing ? "Module updated" : "Module added", refresh: editing },
    );
    if (!res) return;
    setOpen(false);
    if (!editing) router.push(learningHref({ ...filters, domain: domainId, module: res.id }, `module-${res.id}`));
  };

  return (
    <>
      <Button
        size={size}
        variant={variant ?? (editing ? "ghost" : "primary")}
        icon={editing ? <Pencil className="size-4" /> : <Plus className="size-4" />}
        onClick={() => {
          setV(init());
          setLocal({});
          setFields({});
          setOpen(true);
        }}
      >
        {editing ? "Edit module" : "Add module"}
      </Button>
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title={editing ? `Edit module ${module!.number}` : "Add module"}
        description="Modules group chapters. Students progress through them in number order."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form="module-form" loading={loading}>
              {editing ? "Save changes" : "Add module"}
            </Button>
          </>
        }
      >
        <form id="module-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <Field label="Number" htmlFor="m-number" required error={err("number")}>
            <Input id="m-number" type="number" inputMode="numeric" min={1} step={1} value={v.number} onChange={(e) => set("number", e.target.value)} invalid={Boolean(err("number"))} />
          </Field>
          <Field label="Module name" htmlFor="m-name" required error={err("name")}>
            <Input id="m-name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={150} placeholder="e.g. HTML & CSS Foundations" invalid={Boolean(err("name"))} autoFocus />
          </Field>
          <Field label="Description" htmlFor="m-desc" error={err("description")} className="sm:col-span-2">
            <Textarea id="m-desc" rows={3} value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} invalid={Boolean(err("description"))} />
          </Field>
        </form>
      </Modal>
    </>
  );
}

// ── Chapter ──

interface ChapterForm {
  number: string;
  name: string;
  description: string;
  minWatchMinutes: string;
  minReadMinutes: string;
}

export function ChapterFormButton({
  moduleId,
  domainId,
  chapter,
  nextNumber = 1,
  filters,
  size = "sm",
  variant,
  label,
}: {
  moduleId: string;
  domainId: string;
  chapter?: ChapterValue;
  nextNumber?: number;
  filters?: Filters;
  size?: Size;
  variant?: "primary" | "outline" | "ghost" | "secondary";
  label?: string;
}) {
  const editing = Boolean(chapter);
  const init = (): ChapterForm =>
    chapter
      ? {
          number: String(chapter.number),
          name: chapter.name,
          description: chapter.description ?? "",
          minWatchMinutes: String(secondsToMinutes(chapter.minWatchSeconds)),
          minReadMinutes: String(secondsToMinutes(chapter.minReadSeconds)),
        }
      : { number: String(nextNumber), name: "", description: "", minWatchMinutes: "0", minReadMinutes: "0" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<ChapterForm>(init);
  const { local, setLocal, clear } = useLocalErrors<keyof ChapterForm>();
  const { run, loading, fields, setFields } = useAction();
  const router = useRouter();
  const err = (k: keyof ChapterForm) => local[k] ?? fields[k];
  const set = (k: keyof ChapterForm, value: string) => {
    setV((s) => ({ ...s, [k]: value }));
    clear(k);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = editing ? v : { ...v, moduleId };
    const errs = checkFields(editing ? chapterUpdateSchema : chapterCreateSchema, payload);
    setLocal(errs);
    if (Object.keys(errs).length) return;
    const res = await run(
      () =>
        editing
          ? api<{ id: string }>(`/api/admin/learning/chapters/${chapter!.id}`, { method: "PATCH", body: payload })
          : api<{ id: string }>("/api/admin/learning/chapters", { body: payload }),
      { success: editing ? "Chapter updated" : "Chapter added", refresh: editing },
    );
    if (!res) return;
    setOpen(false);
    if (!editing) router.push(learningHref({ ...filters, domain: domainId, module: moduleId, chapter: res.id }, "workspace"));
  };

  return (
    <>
      <Button
        size={size}
        variant={variant ?? (editing ? "outline" : "secondary")}
        icon={editing ? <Pencil className="size-4" /> : <Plus className="size-4" />}
        onClick={() => {
          setV(init());
          setLocal({});
          setFields({});
          setOpen(true);
        }}
      >
        {label ?? (editing ? "Edit chapter" : "Add chapter")}
      </Button>
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title={editing ? `Edit chapter ${chapter!.number}` : "Add chapter"}
        description="Students must meet the minimum watch and reading times before completing the chapter."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form="chapter-form" loading={loading}>
              {editing ? "Save changes" : "Add chapter"}
            </Button>
          </>
        }
      >
        <form id="chapter-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <Field label="Number" htmlFor="c-number" required error={err("number")}>
            <Input id="c-number" type="number" inputMode="numeric" min={1} step={1} value={v.number} onChange={(e) => set("number", e.target.value)} invalid={Boolean(err("number"))} />
          </Field>
          <Field label="Chapter name" htmlFor="c-name" required error={err("name")}>
            <Input id="c-name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={150} placeholder="e.g. Semantic HTML" invalid={Boolean(err("name"))} autoFocus />
          </Field>
          <Field label="Description" htmlFor="c-desc" error={err("description")} className="sm:col-span-2">
            <Textarea id="c-desc" rows={3} value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} invalid={Boolean(err("description"))} />
          </Field>
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
            <Field label="Minimum watch time (minutes)" htmlFor="c-watch" error={err("minWatchMinutes")} hint="0 means no requirement.">
              <Input id="c-watch" type="number" inputMode="decimal" min={0} max={600} step="any" value={v.minWatchMinutes} onChange={(e) => set("minWatchMinutes", e.target.value)} invalid={Boolean(err("minWatchMinutes"))} />
            </Field>
            <Field label="Minimum reading time (minutes)" htmlFor="c-read" error={err("minReadMinutes")} hint="0 means no requirement.">
              <Input id="c-read" type="number" inputMode="decimal" min={0} max={600} step="any" value={v.minReadMinutes} onChange={(e) => set("minReadMinutes", e.target.value)} invalid={Boolean(err("minReadMinutes"))} />
            </Field>
          </div>
        </form>
      </Modal>
    </>
  );
}
