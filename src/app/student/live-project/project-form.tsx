"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Send, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { LIMITS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { useT } from "@/components/i18n";
import { ACCEPT } from "@/components/student/utils";

const MAX_PHOTOS = 5;
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ProjectForm({ initialTitle, initialDescription, hasFile, hasPhotos, resubmit }: { initialTitle: string; initialDescription: string; hasFile: boolean; hasPhotos: boolean; resubmit: boolean }) {
  const t = useT();
  const { run, loading, fields } = useAction();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [file, setFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const picker = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const addPhotos = (list: FileList | null) => {
    if (!list) return;
    const next = [...photos];
    let err: string | null = null;
    for (const f of Array.from(list)) {
      if (!IMG_TYPES.includes(f.type)) err = t("project.err.photoType");
      else if (f.size > LIMITS.imageBytes) err = t("project.err.photoSize");
      else if (next.length >= MAX_PHOTOS) err = t("project.err.photoCount", { n: MAX_PHOTOS });
      else next.push(f);
    }
    setPhotos(next);
    setErrors((e) => {
      const { photos: _drop, ...rest } = e;
      return err ? { ...rest, photos: err } : rest;
    });
    if (picker.current) picker.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (title.trim().length < 5) errs.title = t("project.err.titleMin");
    else if (title.trim().length > 150) errs.title = t("project.err.titleMax");
    if (description.trim().length < 20) errs.description = t("project.err.descMin");
    else if (description.trim().length > 3000) errs.description = t("project.err.descMax");
    if (!file && !hasFile) errs.file = t("sub.err.fileRequired");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const form = new FormData();
    form.set("title", title.trim());
    form.set("description", description.trim());
    if (file) form.set("file", file);
    photos.forEach((p) => form.append("photos", p));
    const r = await run(() => api("/api/student/live-project", { form }), { success: resubmit ? t("sub.resubmittedToast") : t("sub.submittedToast"), refresh: true });
    if (r !== undefined) {
      setFile(null);
      setPhotos([]);
    }
  };

  const err = { ...fields, ...errors };
  return (
    <form onSubmit={submit} noValidate className="space-y-4 p-5">
      <Field label={t("project.fieldTitle")} htmlFor="pj-title" required error={err.title}>
        <Input id="pj-title" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} invalid={Boolean(err.title)} disabled={loading} placeholder={t("project.titlePlaceholder")} />
      </Field>
      <Field label={t("project.fieldDesc")} htmlFor="pj-desc" required error={err.description} hint={t("project.descHint", { n: description.trim().length })}>
        <Textarea id="pj-desc" rows={6} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)} invalid={Boolean(err.description)} disabled={loading} placeholder={t("project.descPlaceholder")} />
      </Field>
      <Field label={t("project.fieldReport")} required={!hasFile} error={null} hint={hasFile ? t("project.keepFileHint") : undefined}>
        <FileInput accept={ACCEPT.submission} maxBytes={LIMITS.submissionBytes} value={file} onChange={setFile} error={err.file ?? null} disabled={loading} label={t("sub.chooseFile")} hint={t("asg.fileHint")} />
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700">{t("project.fieldPhotos")}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5">
          {photos.map((p, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[i]} alt={p.name} className="aspect-square w-full rounded-lg border border-slate-200 object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((s) => s.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 rounded-full bg-white p-0.5 text-slate-500 shadow ring-1 ring-slate-200 hover:text-rose-600"
                aria-label={t("project.removePhoto")}
                disabled={loading}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => picker.current?.click()}
              disabled={loading}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-brand-300 hover:text-brand-600"
            >
              <ImagePlus className="size-5" />
              {t("project.addPhoto")}
            </button>
          )}
        </div>
        <input ref={picker} type="file" accept={ACCEPT.image} multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
        {err.photos ? <p className="mt-1 text-xs font-medium text-rose-600">{err.photos}</p> : <p className="mt-1 text-xs text-slate-500">{hasPhotos ? t("project.photosReplaceHint") : t("project.photosHint")}</p>}
      </div>
      <div className="flex justify-end">
        <Button type="submit" icon={<Send className="size-4" />} loading={loading}>
          {resubmit ? t("sub.resubmit") : t("sub.submit")}
        </Button>
      </div>
    </form>
  );
}
