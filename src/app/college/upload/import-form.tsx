"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { FileInput } from "@/components/ui/file-input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/page";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

const MAX = 10 * 1024 * 1024;

interface Result {
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  warnings: { row: number; message: string }[];
}

export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const { run, loading, fields } = useAction();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res = await run(() => api<Result>("/api/college/students/import", { form }), { refresh: true });
    if (res) {
      setResult(res);
      setFile(null);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="space-y-4">
        <FileInput
          accept=".xlsx,.xls"
          maxBytes={MAX}
          value={file}
          onChange={(f) => {
            setFile(f);
            if (f) setResult(null);
          }}
          label="Choose the student Excel file or drag it here"
          error={fields.file}
          disabled={loading}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={!file} loading={loading} icon={<Upload className="size-4" />}>
            {loading ? "Importing…" : "Import students"}
          </Button>
        </div>
      </form>

      {result && (
        <div className="space-y-4" aria-live="polite">
          <Alert
            tone={result.warnings.length ? "warning" : "success"}
            icon={result.warnings.length ? <AlertTriangle /> : <CheckCircle2 />}
            title={result.totalRows ? "Import completed" : "No student rows were found"}
          >
            {result.totalRows
              ? `${result.imported} new and ${result.updated} updated out of ${result.totalRows} rows.${result.skipped ? ` ${result.skipped} rows were skipped.` : ""}`
              : "Check that the first sheet uses the template header row."}
          </Alert>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Total rows" value={result.totalRows} />
            <Tile label="Imported" value={result.imported} tone="text-emerald-600" />
            <Tile label="Updated" value={result.updated} tone="text-brand-600" />
            <Tile label="Skipped" value={result.skipped} tone={result.skipped ? "text-rose-600" : undefined} />
          </div>
          {result.warnings.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-amber-200">
              <p className="bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">Row-level warnings ({result.warnings.length})</p>
              <div className="max-h-80 overflow-y-auto">
                <WarningsTable warnings={result.warnings} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WarningsTable({ warnings }: { warnings: { row: number; message: string }[] }) {
  return (
    <Table>
      <THead>
        <tr>
          <TH className="w-20">Row</TH>
          <TH>Message</TH>
        </tr>
      </THead>
      <TBody>
        {warnings.map((w, i) => (
          <TR key={i}>
            <TD className="tabular-nums text-slate-500">{w.row}</TD>
            <TD>{w.message}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 text-center">
      <p className={`font-display text-2xl font-bold tabular-nums ${tone ?? "text-slate-900"}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
