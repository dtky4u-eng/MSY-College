"use client";
import { useRef, useState } from "react";
import { FileUp, FileCheck2, X } from "lucide-react";
import { cn } from "./cn";

function human(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Drag-and-drop file picker with client-side type/size checks (the server re-validates).
 * `accept` is an input accept string, e.g. ".pdf,.jpg,.png".
 */
export function FileInput({
  accept,
  maxBytes,
  value,
  onChange,
  label = "Choose a file or drag it here",
  hint,
  error,
  disabled,
  preview,
  className,
}: {
  accept: string;
  maxBytes: number;
  value: File | null;
  onChange: (f: File | null) => void;
  label?: string;
  hint?: string;
  error?: string | null;
  disabled?: boolean;
  preview?: boolean; // show image preview
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const exts = accept.split(",").map((s) => s.trim().toLowerCase());

  const pick = (f: File | undefined | null) => {
    setLocalErr(null);
    if (!f) return onChange(null);
    const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
    if (!exts.includes(ext) && !(ext === ".jpeg" && exts.includes(".jpg"))) {
      setLocalErr(`Allowed types: ${exts.join(", ").toUpperCase()}`);
      return;
    }
    if (f.size > maxBytes) {
      setLocalErr(`File must be ${human(maxBytes)} or smaller (this one is ${human(f.size)})`);
      return;
    }
    onChange(f);
  };

  const err = localErr ?? error;
  const isImage = value && value.type.startsWith("image/");
  return (
    <div className={className}>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          {preview && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={URL.createObjectURL(value)} alt="" className="size-12 rounded-lg object-cover" />
          ) : (
            <FileCheck2 className="size-8 shrink-0 text-emerald-600" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{value.name}</p>
            <p className="text-xs text-slate-500">{human(value.size)}</p>
          </div>
          {!disabled && (
            <button type="button" onClick={() => pick(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-rose-600" aria-label="Remove file">
              <X className="size-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => ref.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors disabled:opacity-60",
            drag ? "border-brand-400 bg-brand-50" : err ? "border-rose-300 bg-rose-50/40" : "border-slate-300 bg-slate-50/60 hover:border-brand-300 hover:bg-brand-50/40",
          )}
        >
          <FileUp className="size-6 text-brand-500" />
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <span className="text-xs text-slate-500">{hint ?? `${exts.join(", ").toUpperCase()} · max ${human(maxBytes)}`}</span>
        </button>
      )}
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {err && <p className="mt-1 text-xs font-medium text-rose-600">{err}</p>}
    </div>
  );
}
