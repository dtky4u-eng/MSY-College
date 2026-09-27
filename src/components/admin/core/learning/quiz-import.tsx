"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, ListChecks, Upload } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { LIMITS } from "@/lib/constants";
import { Button, ButtonLink } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/page";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import { OPTION_LETTERS, plural } from "./shared";

interface PreviewRow {
  row: number;
  text: string;
  options: string[];
  correctIndex: number;
  marks: number;
  explanation: string | null;
}

interface ImportSummary {
  dryRun: boolean;
  mode: "append" | "replace";
  fileName: string;
  totalRows: number;
  validCount: number;
  skipped: number;
  errors: { row: number; message: string }[];
  existingQuestions: number;
  attempts: number;
  preview: PreviewRow[];
  imported: number;
  removed: number;
  quizCreated: boolean;
}

export const TEMPLATE_URL = "/api/admin/learning/quiz-import/template";

/** Import quiz questions for a chapter from Excel: validate & preview first, then commit. */
export function QuizImportButton({
  chapterId,
  chapterName,
  existingQuestions,
  attempts,
  variant = "outline",
  size = "sm",
}: {
  chapterId: string;
  chapterName: string;
  existingQuestions: number;
  attempts: number;
  variant?: "outline" | "primary" | "secondary";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [result, setResult] = useState<ImportSummary | null>(null);
  const { run, loading, fields, setFields, error, setError } = useAction();

  const reset = () => {
    setFile(null);
    setMode("append");
    setResult(null);
    setFields({});
    setError(null);
  };

  const send = async (dryRun: boolean) => {
    if (!file) {
      setFields({ file: "Choose an Excel file to import" });
      return;
    }
    const form = new FormData();
    form.append("chapterId", chapterId);
    form.append("mode", mode);
    form.append("dryRun", dryRun ? "1" : "0");
    form.append("file", file);
    const res = await run(() => api<ImportSummary>("/api/admin/learning/quiz-import", { form }), {
      success: dryRun ? undefined : "Questions imported",
      refresh: !dryRun,
      silentError: true,
    });
    if (res) setResult(res);
  };

  const done = Boolean(result && !result.dryRun);
  const validated = Boolean(result && result.dryRun);

  return (
    <>
      <Button
        size={size}
        variant={variant}
        icon={<FileSpreadsheet className="size-4" />}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Import from Excel
      </Button>
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title="Import questions from Excel"
        description={`Chapter: ${chapterName}`}
        size="xl"
        footer={
          done ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
              {validated ? (
                <Button onClick={() => send(false)} loading={loading} disabled={!result?.validCount} icon={<Upload className="size-4" />} variant={mode === "replace" ? "danger" : "primary"}>
                  {result?.validCount
                    ? mode === "replace"
                      ? `Replace with ${plural(result.validCount, "question")}`
                      : `Import ${plural(result.validCount, "question")}`
                    : "Nothing to import"}
                </Button>
              ) : (
                <Button onClick={() => send(true)} loading={loading} disabled={!file} icon={<ListChecks className="size-4" />}>
                  Validate file
                </Button>
              )}
            </>
          )
        }
      >
        <div className="space-y-5">
          {!done && (
            <>
              <div className="flex flex-col gap-3 rounded-xl border border-brand-100 bg-brand-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-700">
                  <p className="font-medium text-slate-900">Use the question template</p>
                  <p className="mt-0.5 text-slate-600">Columns: Question, Option A–D, Correct (A–D), Marks, Explanation. At least two options per question.</p>
                </div>
                <ButtonLink href={TEMPLATE_URL} external variant="white" size="sm" icon={<Download className="size-4" />} className="shrink-0">
                  Download template
                </ButtonLink>
              </div>

              <FileInput
                accept=".xlsx"
                maxBytes={LIMITS.excelBytes}
                value={file}
                onChange={(f) => {
                  setFile(f);
                  setResult(null);
                  setFields({});
                  setError(null);
                }}
                label="Choose the question Excel file or drag it here"
                error={fields.file}
                disabled={loading}
              />

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">Import mode</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ModeOption
                    checked={mode === "append"}
                    onSelect={() => {
                      setMode("append");
                      setResult(null);
                    }}
                    title="Append"
                    description={existingQuestions ? `Add after the ${plural(existingQuestions, "existing question")}. Questions already in the quiz are skipped.` : "Add the questions to this chapter's quiz."}
                  />
                  <ModeOption
                    checked={mode === "replace"}
                    onSelect={() => {
                      setMode("replace");
                      setResult(null);
                    }}
                    title="Replace"
                    description={existingQuestions ? `Delete the ${plural(existingQuestions, "existing question")} first, then import.` : "Same as append — the quiz has no questions yet."}
                    danger
                  />
                </div>
                {mode === "replace" && attempts > 0 && (
                  <Alert tone="warning" icon={<AlertTriangle />} className="mt-3">
                    Students have made {plural(attempts, "attempt")} on this quiz. Replacing questions changes the quiz for future attempts; past scores are kept.
                  </Alert>
                )}
              </fieldset>
            </>
          )}

          {error && !fields.file && (
            <Alert tone="error" icon={<AlertTriangle />} title="Import failed">
              {error}
            </Alert>
          )}
          {error && fields.file && fields.file !== error && (
            <Alert tone="error" icon={<AlertTriangle />}>
              {error}
            </Alert>
          )}

          {result && <ImportReport result={result} />}
        </div>
      </Modal>
    </>
  );
}

function ModeOption({ checked, onSelect, title, description, danger }: { checked: boolean; onSelect: () => void; title: string; description: string; danger?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "rounded-xl border p-3 text-left transition-colors",
        checked ? (danger ? "border-rose-300 bg-rose-50/60 ring-1 ring-rose-200" : "border-brand-300 bg-brand-50/60 ring-1 ring-brand-200") : "border-slate-200 bg-white hover:border-slate-300",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className={cn("flex size-4 items-center justify-center rounded-full border", checked ? (danger ? "border-rose-500" : "border-brand-600") : "border-slate-300")}>
          {checked && <span className={cn("size-2 rounded-full", danger ? "bg-rose-500" : "bg-brand-600")} />}
        </span>
        {title}
      </span>
      <span className="mt-1 block text-xs text-slate-600">{description}</span>
    </button>
  );
}

function ImportReport({ result }: { result: ImportSummary }) {
  const committed = !result.dryRun;
  return (
    <div className="space-y-4" aria-live="polite">
      {committed ? (
        <Alert tone="success" icon={<CheckCircle2 />} title={`${plural(result.imported, "question")} imported`}>
          {[
            result.quizCreated && "A new quiz was created for this chapter with default settings (60% to pass, 3 attempts).",
            result.removed > 0 && `${plural(result.removed, "existing question")} replaced.`,
            result.skipped > 0 && `${plural(result.skipped, "row")} skipped — see the reasons below.`,
          ]
            .filter(Boolean)
            .join(" ") || "All rows were imported."}
        </Alert>
      ) : result.validCount ? (
        <Alert tone={result.skipped ? "warning" : "success"} icon={result.skipped ? <AlertTriangle /> : <CheckCircle2 />} title="File validated">
          {result.skipped
            ? `${plural(result.validCount, "question")} ready to import. ${plural(result.skipped, "row")} will be skipped — fix them in the file and validate again, or continue without them.`
            : `All ${plural(result.validCount, "question")} are valid and ready to import.`}
        </Alert>
      ) : (
        <Alert tone="error" icon={<AlertTriangle />} title="No valid questions">
          Every row has a problem. Fix the rows listed below and validate the file again.
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Tile label="Rows in file" value={result.totalRows} />
        <Tile label={committed ? "Imported" : "Valid"} value={committed ? result.imported : result.validCount} tone="text-emerald-600" />
        <Tile label="Skipped" value={result.skipped} tone={result.skipped ? "text-rose-600" : undefined} />
      </div>

      {result.errors.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-amber-200">
          <p className="bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">Skipped rows ({result.errors.length})</p>
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <THead>
                <tr>
                  <TH className="w-20">Row</TH>
                  <TH>Reason</TH>
                </tr>
              </THead>
              <TBody>
                {result.errors.map((e, i) => (
                  <TR key={`${e.row}-${i}`}>
                    <TD className="text-slate-500 tabular-nums">{e.row}</TD>
                    <TD className="whitespace-normal">{e.message}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </div>
      )}

      {!committed && result.preview.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <p className="bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">
            Preview {result.validCount > result.preview.length ? `(first ${result.preview.length} of ${result.validCount})` : `(${result.validCount})`}
          </p>
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <THead>
                <tr>
                  <TH className="w-16">Row</TH>
                  <TH>Question</TH>
                  <TH>Correct answer</TH>
                  <TH className="w-20 text-right">Marks</TH>
                </tr>
              </THead>
              <TBody>
                {result.preview.map((q) => (
                  <TR key={q.row}>
                    <TD className="align-top text-slate-500 tabular-nums">{q.row}</TD>
                    <TD className="min-w-[220px] align-top whitespace-normal">
                      <p className="font-medium text-slate-900">{q.text}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{plural(q.options.length, "option")}</p>
                    </TD>
                    <TD className="min-w-[160px] align-top whitespace-normal">
                      <span className="font-semibold text-emerald-700">{OPTION_LETTERS[q.correctIndex]}.</span> {q.options[q.correctIndex]}
                    </TD>
                    <TD className="text-right align-top tabular-nums">{q.marks}</TD>
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
      <p className={cn("font-display text-2xl font-bold tabular-nums", tone ?? "text-slate-900")}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
