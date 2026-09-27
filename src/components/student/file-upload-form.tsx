"use client";
// Single-file submission form (assignments, internship report) with client-side type/size checks.
import { useState } from "react";
import { Upload } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";
import { useT } from "@/components/i18n";

export function FileUploadForm({
  endpoint,
  accept,
  maxBytes,
  resubmit,
  hint,
  successMessage,
  confirmLateMessage,
}: {
  endpoint: string;
  accept: string;
  maxBytes: number;
  resubmit?: boolean;
  hint?: string;
  successMessage?: string;
  confirmLateMessage?: string | null;
}) {
  const t = useT();
  const { run, loading, fields } = useAction();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError(t("sub.err.fileRequired"));
      return;
    }
    setError(null);
    const form = new FormData();
    form.set("file", file);
    const r = await run(() => api(endpoint, { form }), { success: successMessage ?? (resubmit ? t("sub.resubmittedToast") : t("sub.submittedToast")), refresh: true });
    if (r !== undefined) setFile(null);
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <FileInput
        accept={accept}
        maxBytes={maxBytes}
        value={file}
        onChange={(f) => {
          setFile(f);
          setError(null);
        }}
        label={resubmit ? t("sub.chooseNewFile") : t("sub.chooseFile")}
        hint={hint}
        error={error ?? fields.file ?? null}
        disabled={loading}
      />
      {confirmLateMessage && <p className="text-xs font-medium text-amber-700">{confirmLateMessage}</p>}
      <div className="flex justify-end">
        <Button type="submit" icon={<Upload className="size-4" />} loading={loading} disabled={!file}>
          {resubmit ? t("sub.resubmit") : t("sub.submit")}
        </Button>
      </div>
    </form>
  );
}
