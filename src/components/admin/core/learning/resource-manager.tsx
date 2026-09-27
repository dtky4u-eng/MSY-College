"use client";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Code2,
  Download,
  ExternalLink,
  File as FileIcon,
  FileText,
  Link2,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Star,
  StickyNote,
  Video,
} from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { LIMITS, RESOURCE_TYPES, RESOURCE_TYPE_LABEL, type ResourceType } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/page";
import { cn } from "@/components/ui/cn";
import { DeleteAction } from "./delete-action";
import { checkFields, resourceCreateSchema, resourceUpdateSchema } from "./schemas";
import { RESOURCE_ACCEPT, humanBytes, plural } from "./shared";
import type { ResourceRow } from "./types";

const TYPE_ICON: Record<ResourceType, React.ComponentType<{ className?: string }>> = {
  VIDEO: Video,
  PDF: FileText,
  NOTES: StickyNote,
  LINK: Link2,
  CODE: Code2,
  OTHER: FileIcon,
};

const TYPE_TONE: Record<ResourceType, string> = {
  VIDEO: "bg-rose-50 text-rose-600",
  PDF: "bg-amber-50 text-amber-600",
  NOTES: "bg-teal-50 text-teal-600",
  LINK: "bg-sky-50 text-sky-600",
  CODE: "bg-violet-50 text-violet-600",
  OTHER: "bg-slate-100 text-slate-600",
};

const URL_PLACEHOLDER: Record<ResourceType, string> = {
  VIDEO: "https://www.youtube.com/watch?v=…",
  PDF: "https://example.com/handout.pdf",
  NOTES: "https://…",
  LINK: "https://developer.mozilla.org/…",
  CODE: "https://github.com/…",
  OTHER: "https://…",
};

export function ResourceManager({ chapterId, resources }: { chapterId: string; resources: ResourceRow[] }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Learning resources</h3>
          <p className="text-sm text-slate-500">
            {resources.length ? `${plural(resources.length, "resource")} · students see them in this order` : "Videos, PDFs, notes, links and code for this chapter"}
          </p>
        </div>
        <ResourceFormButton chapterId={chapterId} nextOrder={resources.length + 1} />
      </div>

      {resources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300">
          <EmptyState
            icon={<Paperclip />}
            title="No resources yet"
            description="Add a lecture video, a PDF handout, notes or reference links. Mark the main lecture as primary."
            action={<ResourceFormButton chapterId={chapterId} nextOrder={1} label="Add the first resource" />}
          />
        </div>
      ) : (
        <ol className="space-y-2.5">
          {resources.map((r, i) => (
            <ResourceItem key={r.id} r={r} chapterId={chapterId} first={i === 0} last={i === resources.length - 1} count={resources.length} />
          ))}
        </ol>
      )}
    </div>
  );
}

function ResourceItem({ r, chapterId, first, last, count }: { r: ResourceRow; chapterId: string; first: boolean; last: boolean; count: number }) {
  const Icon = TYPE_ICON[r.type] ?? FileIcon;
  const move = useAction();
  const [dir, setDir] = useState<"up" | "down" | null>(null);

  const doMove = async (direction: "up" | "down") => {
    setDir(direction);
    await move.run(() => api(`/api/admin/learning/resources/${r.id}/move`, { body: { direction } }), { refresh: true });
    setDir(null);
  };

  const words = r.content ? r.content.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <li className={cn("flex flex-col gap-3 rounded-xl border bg-white p-3 sm:flex-row sm:items-center", r.primary ? "border-brand-200 ring-1 ring-brand-100" : "border-slate-200")}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          <button
            type="button"
            onClick={() => doMove("up")}
            disabled={first || move.loading}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label={`Move ${r.title} up`}
            title="Move up"
          >
            {dir === "up" ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
          <span className="text-[11px] font-semibold text-slate-400 tabular-nums" aria-label={`Position ${r.sortOrder} of ${count}`}>
            {r.sortOrder}
          </span>
          <button
            type="button"
            onClick={() => doMove("down")}
            disabled={last || move.loading}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label={`Move ${r.title} down`}
            title="Move down"
          >
            {dir === "down" ? <Loader2 className="size-4 animate-spin" /> : <ArrowDown className="size-4" />}
          </button>
        </div>
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", TYPE_TONE[r.type])}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{r.title}</p>
            {r.primary && (
              <Badge tone="brand">
                <Star className="size-3 fill-current" /> Primary
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <Badge tone="gray">{RESOURCE_TYPE_LABEL[r.type]}</Badge>
            <span>{r.downloadable ? "Downloadable" : "View only"}</span>
            <span aria-hidden>·</span>
            <span>Updated {formatDateTime(r.updatedAt)}</span>
          </div>
          <div className="mt-1.5 min-w-0 text-xs">
            {r.file ? (
              <a href={r.file.href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 font-medium text-brand-600 hover:underline">
                <Paperclip className="size-3.5 shrink-0" />
                <span className="truncate">{r.file.name}</span>
                <span className="shrink-0 text-slate-400">({humanBytes(r.file.size)})</span>
              </a>
            ) : r.url ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 font-medium text-brand-600 hover:underline">
                <ExternalLink className="size-3.5 shrink-0" />
                <span className="truncate">{r.url}</span>
              </a>
            ) : null}
            {r.type === "NOTES" && r.content && <p className="mt-1 line-clamp-2 text-slate-500">{plural(words, "word")} · {r.content.slice(0, 180)}</p>}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-1.5 border-t border-slate-100 pt-2 sm:border-0 sm:pt-0">
        {r.file && (
          <a href={r.file.downloadHref} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label={`Download ${r.file.name}`} title="Download file">
            <Download className="size-4" />
          </a>
        )}
        <ResourceFormButton chapterId={chapterId} resource={r} nextOrder={count} />
        <DeleteAction
          url={`/api/admin/learning/resources/${r.id}`}
          title="Delete resource?"
          description={`“${r.title}” will be removed from this chapter${r.file ? " and its uploaded file deleted" : ""}.`}
          success="Resource deleted"
          iconOnly
          variant="ghost"
        />
      </div>
    </li>
  );
}

interface FormState {
  type: ResourceType;
  title: string;
  source: "url" | "file" | "";
  url: string;
  content: string;
  sortOrder: string;
  primary: boolean;
  downloadable: boolean;
}

function initial(r: ResourceRow | undefined, nextOrder: number): FormState {
  if (r) {
    return {
      type: r.type,
      title: r.title,
      source: r.file ? "file" : r.url ? "url" : "",
      url: r.url ?? "",
      content: r.content ?? "",
      sortOrder: String(r.sortOrder),
      primary: r.primary,
      downloadable: r.downloadable,
    };
  }
  return { type: "VIDEO", title: "", source: "url", url: "", content: "", sortOrder: String(nextOrder), primary: false, downloadable: true };
}

function sourceOptions(type: ResourceType): { value: FormState["source"]; label: string }[] {
  if (type === "LINK") return [];
  if (type === "NOTES")
    return [
      { value: "", label: "No attachment" },
      { value: "file", label: "Attach file" },
      { value: "url", label: "Add link" },
    ];
  return [
    { value: "url", label: type === "VIDEO" ? "Video URL" : "External URL" },
    { value: "file", label: "Upload file" },
  ];
}

export function ResourceFormButton({ chapterId, resource, nextOrder, label }: { chapterId: string; resource?: ResourceRow; nextOrder: number; label?: string }) {
  const editing = Boolean(resource);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<FormState>(() => initial(resource, nextOrder));
  const [file, setFile] = useState<File | null>(null);
  const [local, setLocal] = useState<Record<string, string>>({});
  const { run, loading, fields, setFields } = useAction();
  const err = (k: string) => local[k] ?? fields[k];

  const set = <K extends keyof FormState>(k: K, value: FormState[K]) => {
    setV((s) => ({ ...s, [k]: value }));
    setLocal((s) => {
      const next = { ...s };
      delete next[k];
      return next;
    });
  };

  const changeType = (type: ResourceType) => {
    setV((s) => {
      const opts = sourceOptions(type).map((o) => o.value);
      let source = s.source;
      if (type === "LINK") source = "url";
      else if (!opts.includes(source)) source = opts[0] ?? "";
      return { ...s, type, source };
    });
    setFile(null);
    setLocal({});
  };

  const openForm = () => {
    setV(initial(resource, nextOrder));
    setFile(null);
    setLocal({});
    setFields({});
    setOpen(true);
  };

  const effectiveSource = v.type === "LINK" ? "url" : v.source;
  const keepsExistingFile = editing && Boolean(resource!.file) && !file && effectiveSource === "file";
  const accept = RESOURCE_ACCEPT[v.type] ?? "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      type: v.type,
      title: v.title,
      source: effectiveSource || undefined,
      url: effectiveSource === "url" ? v.url : "",
      content: v.type === "NOTES" ? v.content : "",
      sortOrder: v.sortOrder,
      primary: v.primary,
      downloadable: v.downloadable,
    };
    const errs = checkFields(editing ? resourceUpdateSchema : resourceCreateSchema, editing ? payload : { ...payload, chapterId });
    if (effectiveSource === "file" && !file && !(editing && resource!.file)) errs.file = "Choose a file to upload";
    setLocal(errs);
    if (Object.keys(errs).length) return;

    const form = new FormData();
    if (!editing) form.append("chapterId", chapterId);
    form.append("type", payload.type);
    form.append("title", payload.title);
    form.append("source", payload.source ?? "");
    form.append("url", payload.url);
    form.append("content", payload.content);
    form.append("sortOrder", payload.sortOrder);
    form.append("primary", String(payload.primary));
    form.append("downloadable", String(payload.downloadable));
    if (file && effectiveSource === "file") form.append("file", file);

    const res = await run(
      () => (editing ? api(`/api/admin/learning/resources/${resource!.id}`, { method: "PATCH", form }) : api("/api/admin/learning/resources", { form })),
      { success: editing ? "Resource updated" : "Resource added", refresh: true },
    );
    if (res) setOpen(false);
  };

  const opts = sourceOptions(v.type);

  return (
    <>
      {editing ? (
        <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={openForm} aria-label={`Edit ${resource!.title}`} title="Edit resource" />
      ) : (
        <Button size="sm" icon={<Plus className="size-4" />} onClick={openForm}>
          {label ?? "Add resource"}
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title={editing ? "Edit resource" : "Add resource"}
        description="Resources appear in the chapter in the order shown here."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form="resource-form" loading={loading}>
              {loading && file ? "Uploading…" : editing ? "Save changes" : "Add resource"}
            </Button>
          </>
        }
      >
        <form id="resource-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <Field label="Type" htmlFor="r-type" required error={err("type")}>
            <Select id="r-type" value={v.type} onChange={(e) => changeType(e.target.value as ResourceType)}>
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RESOURCE_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title" htmlFor="r-title" required error={err("title")}>
            <Input id="r-title" value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={200} placeholder="e.g. Lecture: Introduction to Flexbox" invalid={Boolean(err("title"))} />
          </Field>

          {v.type === "NOTES" && (
            <Field label="Notes" htmlFor="r-content" required error={err("content")} hint="Plain text; line breaks are preserved." className="sm:col-span-2">
              <Textarea id="r-content" rows={9} value={v.content} onChange={(e) => set("content", e.target.value)} maxLength={50000} invalid={Boolean(err("content"))} />
            </Field>
          )}

          {opts.length > 0 && (
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-sm font-medium text-slate-700">{v.type === "NOTES" ? "Attachment" : "Source"}</legend>
              <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup">
                {opts.map((o) => (
                  <button
                    key={o.value || "none"}
                    type="button"
                    role="radio"
                    aria-checked={v.source === o.value}
                    onClick={() => {
                      set("source", o.value);
                      setLocal({});
                    }}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      v.source === o.value ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {effectiveSource === "url" && (
            <Field label="URL" htmlFor="r-url" required error={err("url")} className="sm:col-span-2" hint={v.type === "VIDEO" ? "YouTube, Vimeo or any direct video link." : undefined}>
              <Input id="r-url" type="url" inputMode="url" value={v.url} onChange={(e) => set("url", e.target.value)} placeholder={URL_PLACEHOLDER[v.type]} maxLength={2000} invalid={Boolean(err("url"))} />
            </Field>
          )}

          {effectiveSource === "file" && (
            <div className="space-y-2 sm:col-span-2">
              {keepsExistingFile && resource?.file && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                  <Paperclip className="size-4 shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{resource.file.name}</p>
                    <p className="text-xs text-slate-500">Current file · {humanBytes(resource.file.size)} · upload a new file below to replace it</p>
                  </div>
                </div>
              )}
              <FileInput
                accept={accept}
                maxBytes={LIMITS.resourceBytes}
                value={file}
                onChange={(f) => {
                  setFile(f);
                  setLocal((s) => {
                    const next = { ...s };
                    delete next.file;
                    return next;
                  });
                }}
                label={editing && resource?.file ? "Choose a replacement file" : "Choose a file or drag it here"}
                error={err("file")}
                disabled={loading}
              />
            </div>
          )}

          <Field label="Position" htmlFor="r-order" required error={err("sortOrder")} hint="1 = shown first">
            <Input id="r-order" type="number" inputMode="numeric" min={1} step={1} value={v.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} invalid={Boolean(err("sortOrder"))} />
          </Field>
          <div className="flex flex-col justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <Switch checked={v.primary} onChange={(x) => set("primary", x)} label={<span><b className="font-medium text-slate-900">Primary resource</b> — the main lecture (only one per chapter)</span>} />
            <Switch checked={v.downloadable} onChange={(x) => set("downloadable", x)} label={<span><b className="font-medium text-slate-900">Downloadable</b> — students may download the file</span>} />
          </div>
        </form>
      </Modal>
    </>
  );
}
