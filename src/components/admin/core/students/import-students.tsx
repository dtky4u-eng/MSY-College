"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { LIMITS } from "@/lib/constants";
import { Button, ButtonLink } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Select } from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { Alert } from "@/components/ui/page";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface Result {
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  warnings: { row: number; message: string }[];
  college: { id: string; name: string };
}

/** "Import Excel" button + modal: map an uploaded student sheet to a selected college (FR-ADM-6). */
export function ImportStudentsButton({ colleges, defaultCollegeId }: { colleges: { value: string; label: string }[]; defaultCollegeId?: string }) {
  const [open, setOpen] = useState(false);
  const [collegeId, setCollegeId] = useState(defaultCollegeId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [localErr, setLocalErr] = useState<Record<string, string>>({});
  const { run, loading, fields } = useAction();
  const err = { ...fields, ...localErr };

  const close = () => {
    if (loading) return;
    setOpen(false);
    setFile(null);
    setResult(null);
    setLocalErr({});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (!collegeId) v.collegeId = "Select the college these students belong to";
    if (!file) v.file = "Choose an Excel file to upload";
    setLocalErr(v);
    if (Object.keys(v).length || !file) return;
    const form = new FormData();
    form.append("collegeId", collegeId);
    form.append("file", file);
    const res = await run(() => api<Result>("/api/admin/students/import", { form }), { refresh: true });
    if (res) {
      setResult(res);
      setFile(null);
    }
  };

  return (
    <>
      <Button variant="outline" icon={<FileSpreadsheet className="size-4" />} onClick={() => setOpen(true)}>
        Import Excel
      </Button>
      <Modal
        open={open}
        onClose={close}
        size="lg"
        title="Import students from Excel"
        description="Rows are added to the selected college. Existing registration numbers of that college are updated unless the student has confirmed registration."
        footer={
          result ? (
            <>
              <Button variant="outline" onClick={() => setResult(null)}>
                Import another file
              </Button>
              <Button onClick={close}>Done</Button>
            </>
          ) : (
            <>
              <ButtonLink href="/api/admin/students/template" external variant="ghost" icon={<Download className="size-4" />} className="mr-auto">
                Download template
              </ButtonLink>
              <Button variant="outline" onClick={close} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" form="import-students-form" loading={loading} icon={<Upload className="size-4" />}>
                {loading ? "Importing…" : "Import students"}
              </Button>
            </>
          )
        }
      >
        {result ? (
          <ImportSummary result={result} />
        ) : (
          <form id="import-students-form" onSubmit={submit} className="space-y-4" noValidate>
            <Field label="College" htmlFor="import-college" required error={err.collegeId}>
              <Select
                id="import-college"
                value={collegeId}
                invalid={Boolean(err.collegeId)}
                onChange={(e) => {
                  setCollegeId(e.target.value);
                  setLocalErr((s) => ({ ...s, collegeId: "" }));
                }}
                disabled={loading}
              >
                <option value="">Select a college…</option>
                {colleges.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Student Excel file" required>
              <FileInput
                accept=".xlsx,.xls"
                maxBytes={LIMITS.excelBytes}
                value={file}
                onChange={(f) => {
                  setFile(f);
                  setLocalErr((s) => ({ ...s, file: "" }));
                }}
                label="Choose the student Excel file or drag it here"
                error={err.file || null}
                disabled={loading}
              />
            </Field>
            <Alert tone="info">
              Keep the template header row unchanged. <b>Registration Number</b> and <b>Student Name</b> are required; mobile numbers must be 10 digits and dates use
              YYYY-MM-DD. Legacy .xls workbooks may need to be re-saved as .xlsx.
            </Alert>
          </form>
        )}
      </Modal>
    </>
  );
}

function ImportSummary({ result }: { result: Result }) {
  const warn = result.warnings.length > 0;
  return (
    <div className="space-y-4" aria-live="polite">
      <Alert tone={warn ? "warning" : "success"} icon={warn ? <AlertTriangle /> : <CheckCircle2 />} title={result.totalRows ? `Import completed for ${result.college.name}` : "No student rows were found"}>
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
      {warn && (
        <div className="overflow-hidden rounded-xl border border-amber-200">
          <p className="bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">Row warnings ({result.warnings.length})</p>
          <div className="max-h-72 overflow-y-auto">
            <Table>
              <THead>
                <tr>
                  <TH className="w-20">Row</TH>
                  <TH>Message</TH>
                </tr>
              </THead>
              <TBody>
                {result.warnings.map((w, i) => (
                  <TR key={i}>
                    <TD className="text-slate-500 tabular-nums">{w.row}</TD>
                    <TD>{w.message}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </div>
      )}
    </div>
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
