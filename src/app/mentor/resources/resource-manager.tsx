"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Code2, Download, ExternalLink, FileText, FileVideo, Link2, Paperclip, Pencil, Plus, Star, StickyNote, Trash2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { RESOURCE_TYPES, RESOURCE_TYPE_LABEL, type ResourceType } from "@/lib/constants";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";

export interface ResourceRow {
  id: string;
  title: string;
  type: string;
  url: string | null;
  content: string | null;
  sortOrder: number;
  primary: boolean;
  downloadable: boolean;
  file: { url: string; name: string; size: number } | null;
}

const MAX = 50 * 1024 * 1024;
const ACCEPT: Record<ResourceType, string> = {
  VIDEO: ".mp4",
  PDF: ".pdf",
  NOTES: "",
  LINK: "",
  CODE: ".zip,.txt",
  OTHER: ".pdf,.doc,.docx,.ppt,.pptx,.zip,.txt,.mp4,.jpg,.jpeg,.png,.webp,.xlsx",
};
const ICON: Record<string, React.ReactNode> = {
  VIDEO: <FileVideo className="size-5" />,
  PDF: <FileText className="size-5" />,
  NOTES: <StickyNote className="size-5" />,
  LINK: <Link2 className="size-5" />,
  CODE: <Code2 className="size-5" />,
  OTHER: <Paperclip className="size-5" />,
};

export function ResourceManager({ chapter, resources }: { chapter: { id: string; title: string; module: string }; resources: ResourceRow[] }) {
  const [editing, setEditing] = useState<ResourceRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<ResourceRow | null>(null);
  const reorder = useAction();
  const del = useAction();

  const move = async (index: number, dir: -1 | 1) => {
    const ids = resources.map((r) => r.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    await reorder.run(() => api("/api/mentor/resources/reorder", { body: { chapterId: chapter.id, ids } }), { refresh: true });
  };

  return (
    <Card>
      <CardHeader
        title={chapter.title}
        description={chapter.module}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
            Add resource
          </Button>
        }
      />
      {resources.length === 0 ? (
        <EmptyState icon={<Paperclip />} title="No resources yet" description="Add a lecture video, PDF, notes, links or source code for this chapter." action={<Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Add the first resource</Button>} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {resources.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{ICON[r.type] ?? ICON.OTHER}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-slate-900">{r.title}</p>
                  {r.primary && (
                    <Badge tone="amber">
                      <Star className="size-3" /> Primary
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>#{r.sortOrder}</span>
                  <span>{RESOURCE_TYPE_LABEL[r.type as ResourceType] ?? r.type}</span>
                  <span>{r.downloadable ? "Downloadable" : "View only"}</span>
                  {r.file && (
                    <a href={r.file.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700">
                      <Download className="size-3" /> {r.file.name}
                    </a>
                  )}
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-64 items-center gap-1 truncate font-medium text-brand-600 hover:text-brand-700">
                      <ExternalLink className="size-3 shrink-0" /> <span className="truncate">{r.url}</span>
                    </a>
                  )}
                  {r.type === "NOTES" && r.content && <span className="truncate">{r.content.length.toLocaleString("en-IN")} characters</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="xs" variant="ghost" aria-label="Move up" disabled={i === 0 || reorder.loading} onClick={() => move(i, -1)}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button size="xs" variant="ghost" aria-label="Move down" disabled={i === resources.length - 1 || reorder.loading} onClick={() => move(i, 1)}>
                  <ArrowDown className="size-4" />
                </Button>
                <Button size="xs" variant="outline" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(r)}>
                  Edit
                </Button>
                <Button size="xs" variant="ghost" aria-label={`Delete ${r.title}`} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setDeleting(r)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ResourceForm
          chapterId={chapter.id}
          initial={editing === "new" ? null : editing}
          nextOrder={resources.length ? Math.max(...resources.map((r) => r.sortOrder)) + 1 : 1}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        tone="danger"
        loading={del.loading}
        title="Delete resource?"
        description={deleting ? `“${deleting.title}” and its uploaded file will be permanently removed.` : undefined}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return;
          const res = await del.run(() => api(`/api/mentor/resources/${deleting.id}`, { method: "DELETE" }), { success: "Resource deleted", refresh: true });
          if (res) setDeleting(null);
        }}
      />
    </Card>
  );
}

function ResourceForm({ chapterId, initial, nextOrder, onClose }: { chapterId: string; initial: ResourceRow | null; nextOrder: number; onClose: () => void }) {
  const [v, setV] = useState({
    title: initial?.title ?? "",
    type: (initial?.type as ResourceType) ?? "VIDEO",
    sortOrder: String(initial?.sortOrder ?? nextOrder),
    primary: initial?.primary ?? false,
    downloadable: initial?.downloadable ?? true,
    url: initial?.url ?? "",
    content: initial?.content ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, loading, fields } = useAction();
  const err = { ...errors, ...fields };
  const takesFile = ACCEPT[v.type] !== "";
  const takesUrl = v.type !== "PDF" && v.type !== "NOTES";
  const hasExisting = Boolean(initial?.file) && !removeFile && takesFile;

  const check = () => {
    const e: Record<string, string> = {};
    if (v.title.trim().length < 2) e.title = "Title must be at least 2 characters";
    const n = Number(v.sortOrder);
    if (!Number.isInteger(n) || n < 1) e.sortOrder = "Sort order must be a whole number of at least 1";
    if (v.url.trim() && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(v.url.trim())) e.url = "Enter a valid URL starting with http:// or https://";
    const hasFile = Boolean(file) || hasExisting;
    if (v.type === "PDF" && !hasFile) e.file = "Upload the PDF file";
    if (v.type === "NOTES" && !v.content.trim()) e.content = "Enter the notes content";
    if (v.type === "LINK" && !v.url.trim()) e.url = "Enter the link URL";
    if ((v.type === "VIDEO" || v.type === "CODE" || v.type === "OTHER") && !hasFile && !v.url.trim()) e[v.type === "VIDEO" ? "url" : "file"] = v.type === "VIDEO" ? "Add a video URL or upload an MP4 file" : "Upload a file or add a URL";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!check()) return;
    const form = new FormData();
    form.append("chapterId", chapterId);
    form.append("title", v.title.trim());
    form.append("type", v.type);
    form.append("sortOrder", v.sortOrder);
    form.append("primary", String(v.primary));
    form.append("downloadable", String(v.downloadable));
    if (takesUrl) form.append("url", v.url.trim());
    if (v.type === "NOTES") form.append("content", v.content);
    if (file && takesFile) form.append("file", file);
    if (initial && (removeFile || !takesFile)) form.append("removeFile", "true");
    const res = await run(
      () => (initial ? api(`/api/mentor/resources/${initial.id}`, { method: "PATCH", form }) : api("/api/mentor/resources", { form })),
      { success: initial ? "Resource updated" : "Resource added", refresh: true },
    );
    if (res) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={initial ? "Edit resource" : "Add resource"}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" form="resource-form" loading={loading}>{initial ? "Save changes" : "Add resource"}</Button>
        </>
      }
    >
      <form id="resource-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Title" htmlFor="rs-title" error={err.title} required className="sm:col-span-2">
          <Input id="rs-title" value={v.title} maxLength={160} onChange={(e) => setV({ ...v, title: e.target.value })} invalid={Boolean(err.title)} />
        </Field>
        <Field label="Type" htmlFor="rs-type" error={err.type} required>
          <Select id="rs-type" value={v.type} onChange={(e) => { setV({ ...v, type: e.target.value as ResourceType }); setFile(null); }}>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>{RESOURCE_TYPE_LABEL[t]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Sort order" htmlFor="rs-sort" error={err.sortOrder} required hint="1 appears first">
          <Input id="rs-sort" type="number" min={1} step={1} value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: e.target.value })} invalid={Boolean(err.sortOrder)} />
        </Field>
        {takesUrl && (
          <Field label={v.type === "VIDEO" ? "Video URL (YouTube or hosted)" : "URL"} htmlFor="rs-url" error={err.url} required={v.type === "LINK"} className="sm:col-span-2">
            <Input id="rs-url" type="url" inputMode="url" placeholder="https://" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} invalid={Boolean(err.url)} />
          </Field>
        )}
        {v.type === "NOTES" && (
          <Field label="Notes content" htmlFor="rs-content" error={err.content} required className="sm:col-span-2">
            <Textarea id="rs-content" rows={10} value={v.content} maxLength={50000} onChange={(e) => setV({ ...v, content: e.target.value })} invalid={Boolean(err.content)} />
          </Field>
        )}
        {takesFile && (
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium text-slate-700">
              File{v.type === "PDF" && <span className="ml-0.5 text-rose-500">*</span>}
            </p>
            {hasExisting && !file && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="truncate text-slate-700">Current: {initial!.file!.name}</span>
                <Button size="xs" variant="ghost" className="text-rose-600" onClick={() => setRemoveFile(true)}>Remove</Button>
              </div>
            )}
            <FileInput accept={ACCEPT[v.type]} maxBytes={MAX} value={file} onChange={setFile} error={err.file} label={hasExisting ? "Upload a replacement file" : "Choose a file or drag it here"} />
          </div>
        )}
        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:gap-6">
          <Checkbox label="Primary resource for this chapter" checked={v.primary} onChange={(e) => setV({ ...v, primary: e.target.checked })} />
          <Checkbox label="Allow students to download" checked={v.downloadable} onChange={(e) => setV({ ...v, downloadable: e.target.checked })} />
        </div>
        {v.primary && <p className="-mt-2 text-xs text-slate-500 sm:col-span-2">Only one resource per chapter can be primary; any other primary resource will be unset.</p>}
      </form>
    </Modal>
  );
}
