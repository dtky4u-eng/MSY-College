"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CheckCircle2, Plus, Save, Trash2, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Switch } from "@/components/ui/field";
import { Alert } from "@/components/ui/page";
import { ConfirmDialog } from "@/components/ui/modal";
import { cn } from "@/components/ui/cn";

export interface QuestionDraft {
  key: string;
  id: string | null;
  text: string;
  options: string[];
  correctIndex: number;
  marks: string;
  explanation: string;
}

export interface QuizDraft {
  id: string | null;
  title: string;
  description: string;
  passingScore: string;
  attemptsAllowed: string;
  timeLimitMinutes: string;
  randomize: boolean;
  showResult: boolean;
  questions: QuestionDraft[];
}

let seq = 0;
const blankQuestion = (): QuestionDraft => ({ key: `new-${Date.now()}-${seq++}`, id: null, text: "", options: ["", "", "", ""], correctIndex: 0, marks: "1", explanation: "" });

function validateDraft(d: QuizDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.title.trim().length < 3) e.title = "Title must be at least 3 characters";
  const ps = Number(d.passingScore);
  if (d.passingScore === "" || !Number.isInteger(ps) || ps < 0 || ps > 100) e.passingScore = "Passing score must be between 0 and 100";
  const at = Number(d.attemptsAllowed);
  if (!Number.isInteger(at) || at < 1 || at > 20) e.attemptsAllowed = "Allow between 1 and 20 attempts";
  if (d.timeLimitMinutes) {
    const t = Number(d.timeLimitMinutes);
    if (!Number.isInteger(t) || t < 1 || t > 300) e.timeLimitMinutes = "Time limit must be 1–300 minutes";
  }
  if (!d.questions.length) e.questions = "Add at least one question";
  d.questions.forEach((q, i) => {
    if (q.text.trim().length < 3) e[`questions.${i}.text`] = "Question text must be at least 3 characters";
    if (q.options.length < 2 || q.options.length > 6) e[`questions.${i}.options`] = "Use 2 to 6 options";
    else if (q.options.some((o) => !o.trim())) e[`questions.${i}.options`] = "Options cannot be empty";
    else if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) e[`questions.${i}.options`] = "Options must be different from each other";
    if (q.correctIndex < 0 || q.correctIndex >= q.options.length) e[`questions.${i}.correctIndex`] = "Choose the correct answer";
    const mk = Number(q.marks);
    if (!Number.isInteger(mk) || mk < 1 || mk > 100) e[`questions.${i}.marks`] = "Marks must be a whole number of at least 1";
  });
  return e;
}

export function QuizEditor({ chapterId, initial, attempts }: { chapterId: string; initial: QuizDraft; attempts: number }) {
  const router = useRouter();
  const [d, setD] = useState<QuizDraft>(initial.questions.length ? initial : { ...initial, questions: [blankQuestion()] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useAction();
  const del = useAction();
  const err = { ...errors, ...save.fields };
  const totalMarks = d.questions.reduce((a, q) => a + (Number(q.marks) || 0), 0);

  const setQ = (i: number, patch: Partial<QuestionDraft>) => setD((s) => ({ ...s, questions: s.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) }));
  const moveQ = (i: number, dir: -1 | 1) =>
    setD((s) => {
      const qs = [...s.questions];
      const j = i + dir;
      if (j < 0 || j >= qs.length) return s;
      [qs[i], qs[j]] = [qs[j]!, qs[i]!];
      return { ...s, questions: qs };
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ve = validateDraft(d);
    setErrors(ve);
    if (Object.keys(ve).length) return;
    const body = {
      chapterId,
      title: d.title.trim(),
      description: d.description.trim() || null,
      passingScore: Number(d.passingScore),
      attemptsAllowed: Number(d.attemptsAllowed),
      timeLimitMinutes: d.timeLimitMinutes ? Number(d.timeLimitMinutes) : null,
      randomize: d.randomize,
      showResult: d.showResult,
      questions: d.questions.map((q) => ({ id: q.id, text: q.text.trim(), options: q.options.map((o) => o.trim()), correctIndex: q.correctIndex, marks: Number(q.marks), explanation: q.explanation.trim() || null })),
    };
    const res = await save.run(() => api<{ id: string; created: boolean }>("/api/mentor/quizzes", { body }), { success: d.id ? "Quiz saved" : "Quiz created" });
    if (res) {
      router.push("/mentor/quizzes");
      router.refresh();
    }
  };

  const errorCount = Object.keys(err).length;

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {attempts > 0 && (
        <Alert tone="warning" title={`${attempts} student attempt${attempts === 1 ? "" : "s"} recorded`}>
          Changes apply to future attempts. Removing questions does not change scores already awarded.
        </Alert>
      )}
      <Card>
        <CardHeader title="Quiz settings" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Title" htmlFor="qz-title" error={err.title} required className="sm:col-span-2 lg:col-span-4">
            <Input id="qz-title" value={d.title} maxLength={160} onChange={(e) => setD({ ...d, title: e.target.value })} invalid={Boolean(err.title)} />
          </Field>
          <Field label="Description" htmlFor="qz-desc" error={err.description} className="sm:col-span-2 lg:col-span-4">
            <Textarea id="qz-desc" rows={2} value={d.description} maxLength={2000} onChange={(e) => setD({ ...d, description: e.target.value })} />
          </Field>
          <Field label="Passing score (%)" htmlFor="qz-pass" error={err.passingScore} required>
            <Input id="qz-pass" type="number" min={0} max={100} value={d.passingScore} onChange={(e) => setD({ ...d, passingScore: e.target.value })} invalid={Boolean(err.passingScore)} />
          </Field>
          <Field label="Attempts allowed" htmlFor="qz-att" error={err.attemptsAllowed} required>
            <Input id="qz-att" type="number" min={1} max={20} value={d.attemptsAllowed} onChange={(e) => setD({ ...d, attemptsAllowed: e.target.value })} invalid={Boolean(err.attemptsAllowed)} />
          </Field>
          <Field label="Time limit (minutes)" htmlFor="qz-time" error={err.timeLimitMinutes} hint="Leave empty for no limit">
            <Input id="qz-time" type="number" min={1} max={300} value={d.timeLimitMinutes} onChange={(e) => setD({ ...d, timeLimitMinutes: e.target.value })} invalid={Boolean(err.timeLimitMinutes)} />
          </Field>
          <div className="flex flex-col justify-end gap-3 pb-1">
            <Switch checked={d.randomize} onChange={(v) => setD({ ...d, randomize: v })} label="Randomize question order" />
            <Switch checked={d.showResult} onChange={(v) => setD({ ...d, showResult: v })} label="Show result to students" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Questions" description={`${d.questions.length} question${d.questions.length === 1 ? "" : "s"} · ${totalMarks} total marks`} actions={<Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setD({ ...d, questions: [...d.questions, blankQuestion()] })}>Add question</Button>} />
        {err.questions && <p className="px-5 pt-3 text-sm font-medium text-rose-600">{err.questions}</p>}
        <ol className="divide-y divide-slate-100">
          {d.questions.map((q, i) => (
            <li key={q.key} className="space-y-3 px-5 py-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">Question {i + 1}</span>
                <div className="flex items-center gap-1">
                  <Button size="xs" variant="ghost" aria-label="Move question up" disabled={i === 0} onClick={() => moveQ(i, -1)}><ArrowUp className="size-4" /></Button>
                  <Button size="xs" variant="ghost" aria-label="Move question down" disabled={i === d.questions.length - 1} onClick={() => moveQ(i, 1)}><ArrowDown className="size-4" /></Button>
                  <Button size="xs" variant="ghost" aria-label="Remove question" className="text-rose-600 hover:bg-rose-50" disabled={d.questions.length === 1} onClick={() => setD({ ...d, questions: d.questions.filter((_, j) => j !== i) })}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <Field label="Question" htmlFor={`q-${q.key}`} error={err[`questions.${i}.text`]} required>
                <Textarea id={`q-${q.key}`} rows={2} value={q.text} maxLength={2000} onChange={(e) => setQ(i, { text: e.target.value })} invalid={Boolean(err[`questions.${i}.text`])} />
              </Field>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-slate-700">Options <span className="font-normal text-slate-500">— select the correct answer</span></legend>
                <div className="space-y-2">
                  {q.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <label className={cn("flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border", q.correctIndex === oi ? "border-emerald-400 bg-emerald-50 text-emerald-600" : "border-slate-300 text-slate-300 hover:border-slate-400")}>
                        <input type="radio" name={`correct-${q.key}`} className="sr-only" checked={q.correctIndex === oi} onChange={() => setQ(i, { correctIndex: oi })} aria-label={`Mark option ${oi + 1} as correct`} />
                        <CheckCircle2 className="size-5" />
                      </label>
                      <Input value={o} maxLength={500} placeholder={`Option ${oi + 1}`} onChange={(e) => setQ(i, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} aria-label={`Option ${oi + 1}`} />
                      <Button
                        size="xs"
                        variant="ghost"
                        aria-label={`Remove option ${oi + 1}`}
                        disabled={q.options.length <= 2}
                        onClick={() => setQ(i, { options: q.options.filter((_, k) => k !== oi), correctIndex: q.correctIndex === oi ? 0 : q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex })}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                {(err[`questions.${i}.options`] || err[`questions.${i}.correctIndex`]) && <p className="mt-1 text-xs font-medium text-rose-600">{err[`questions.${i}.options`] ?? err[`questions.${i}.correctIndex`]}</p>}
                {q.options.length < 6 && (
                  <Button size="xs" variant="ghost" className="mt-2" icon={<Plus className="size-3.5" />} onClick={() => setQ(i, { options: [...q.options, ""] })}>Add option</Button>
                )}
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                <Field label="Marks" htmlFor={`m-${q.key}`} error={err[`questions.${i}.marks`]} required>
                  <Input id={`m-${q.key}`} type="number" min={1} max={100} value={q.marks} onChange={(e) => setQ(i, { marks: e.target.value })} invalid={Boolean(err[`questions.${i}.marks`])} />
                </Field>
                <Field label="Explanation (optional)" htmlFor={`x-${q.key}`} hint="Shown with the result when results are visible">
                  <Input id={`x-${q.key}`} value={q.explanation} maxLength={2000} onChange={(e) => setQ(i, { explanation: e.target.value })} />
                </Field>
              </div>
            </li>
          ))}
        </ol>
        <CardFooter className="justify-between">
          <div>
            {d.id && (
              <Button variant="ghost" className="text-rose-600 hover:bg-rose-50" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>
                Delete quiz
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {errorCount > 0 && <span className="text-sm text-rose-600">Fix {errorCount} error{errorCount === 1 ? "" : "s"} above</span>}
            <Button type="submit" loading={save.loading} icon={<Save className="size-4" />}>
              {d.id ? "Save quiz" : "Create quiz"}
            </Button>
          </div>
        </CardFooter>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        tone="danger"
        loading={del.loading}
        title="Delete this quiz?"
        description={`The quiz, its questions${attempts ? `, ${attempts} student attempt${attempts === 1 ? "" : "s"}` : ""} and any reattempt grants will be permanently deleted. Chapters already completed stay completed.`}
        confirmLabel="Delete quiz"
        onConfirm={async () => {
          const res = await del.run(() => api(`/api/mentor/quizzes/${d.id}`, { method: "DELETE" }), { success: "Quiz deleted" });
          if (res) {
            router.push("/mentor/quizzes");
            router.refresh();
          }
        }}
      />
    </form>
  );
}
