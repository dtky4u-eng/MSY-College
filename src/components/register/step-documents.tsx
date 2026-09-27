"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, FileText, ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/client/api";
import { LIMITS } from "@/lib/constants";
import { useT } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { FileInput } from "@/components/ui/file-input";
import type { RegFile, RegState } from "./types";
import { errText, humanSize } from "./util";

type Kind = "photo" | "admitCard";

export const fileUrlFor = (kind: Kind, f: RegFile | null) =>
  f ? `/api/register/file/${kind === "photo" ? "photo" : "admit-card"}?v=${encodeURIComponent(f.uploadedAt)}` : null;

function DocCard({
  kind,
  title,
  hint,
  accept,
  maxBytes,
  file,
  onUploaded,
  onError,
}: {
  kind: Kind;
  title: string;
  hint: string;
  accept: string;
  maxBytes: number;
  file: RegFile | null;
  onUploaded: (s: RegState) => void;
  onError: (e: unknown) => boolean;
}) {
  const t = useT();
  const [replacing, setReplacing] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = fileUrlFor(kind, file);
  const isImage = file?.mime.startsWith("image/");

  const upload = async (f: File | null) => {
    setPending(f);
    setError(null);
    if (!f) return;
    setBusy(true);
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", f);
    try {
      const res = await api<{ state: RegState }>("/api/register/documents", { form });
      setReplacing(false);
      setPending(null);
      onUploaded(res.state);
    } catch (e) {
      if (!onError(e)) setError(errText(e, t));
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  const showPicker = !file || replacing;

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            {kind === "photo" ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {title}
              <span className="ml-0.5 text-rose-500">*</span>
            </p>
            <p className="text-xs text-slate-500">{hint}</p>
          </div>
        </div>
        {file && !replacing && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 className="size-3.5" /> {t("reg.docs.uploaded")}
          </span>
        )}
      </div>

      {file && !replacing && url && (
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={title} className={kind === "photo" ? "h-20 w-16 rounded-md object-cover ring-1 ring-slate-200" : "size-16 rounded-md object-cover ring-1 ring-slate-200"} />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-md bg-rose-50 text-rose-600 ring-1 ring-rose-100">
              <FileText className="size-7" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
            <p className="text-xs text-slate-500">{humanSize(file.size)}</p>
            <div className="mt-1.5 flex flex-wrap gap-3">
              <a href={url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
                <ExternalLink className="size-3.5" /> {t("reg.docs.view")}
              </a>
              <button type="button" onClick={() => setReplacing(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900">
                <RefreshCw className="size-3.5" /> {t("reg.docs.replace")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPicker && (
        <div className="relative">
          <FileInput accept={accept} maxBytes={maxBytes} value={pending} onChange={upload} label={t("reg.docs.choose")} hint={hint} disabled={busy} preview={kind === "photo"} error={error} />
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-white/80 text-sm font-medium text-brand-700">
              <Loader2 className="size-4 animate-spin" /> {t("reg.docs.uploading")}
            </div>
          )}
          {replacing && !busy && (
            <button type="button" onClick={() => setReplacing(false)} className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-800">
              {t("reg.docs.cancel")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function StepDocuments({ state, onSaved, onNext, onBack, onError }: { state: RegState; onSaved: (s: RegState) => void; onNext: () => void; onBack: () => void; onError: (e: unknown) => boolean }) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const both = Boolean(state.student.photo && state.student.admitCard);
  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-5 sm:px-8">
        <h2 className="text-xl font-bold text-slate-900">{t("reg.docs.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("reg.docs.desc")}</p>
      </div>
      <div className="space-y-4 px-5 py-6 sm:px-8">
        {error && !both && <Alert tone="error">{error}</Alert>}
        <DocCard
          kind="photo"
          title={t("reg.docs.photo")}
          hint={t("reg.docs.photoHint")}
          accept=".jpg,.jpeg,.png,.webp"
          maxBytes={LIMITS.imageBytes}
          file={state.student.photo}
          onUploaded={onSaved}
          onError={onError}
        />
        <DocCard
          kind="admitCard"
          title={t("reg.docs.admit")}
          hint={t("reg.docs.admitHint")}
          accept=".pdf,.jpg,.jpeg,.png"
          maxBytes={LIMITS.documentBytes}
          file={state.student.admitCard}
          onUploaded={onSaved}
          onError={onError}
        />
      </div>
      <div className="flex flex-col-reverse gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Button variant="ghost" onClick={onBack} icon={<ArrowLeft className="size-4" />}>
          {t("reg.back")}
        </Button>
        <Button size="lg" className="w-full sm:w-auto" onClick={() => (both ? onNext() : setError(t("reg.docs.missing")))} icon={<ArrowRight className="size-4" />}>
          {t("reg.continue")}
        </Button>
      </div>
    </Card>
  );
}
