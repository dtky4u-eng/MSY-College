"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Circle, ClipboardList, Loader2, Pencil, Plus, Settings2, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/page";
import { cn } from "@/components/ui/cn";
import { DeleteAction } from "./delete-action";
import { QuizImportButton } from "./quiz-import";
import { checkFields, questionCreateSchema, questionUpdateSchema, quizSchema } from "./schemas";
import { OPTION_LETTERS, plural } from "./shared";
import type { QuestionRow, QuizValue } from "./types";

// ── Quiz settings ──

interface SettingsForm {
  title: string;
  description: string;
  passingScore: string;
  attemptsAllowed: string;
  timeLimitMinutes: string;
  randomize: boolean;
  showResult: boolean;
}

export function QuizSettingsButton({ chapterId, chapterName, quiz, size = "sm", variant }: { chapterId: string; chapterName: string; quiz?: QuizValue | null; size?: "sm" | "md"; variant?: "primary" | "outline" }) {
  const editing = Boolean(quiz);
  const init = (): SettingsForm =>
    quiz
      ? {
          title: quiz.title,
          description: quiz.description ?? "",
          passingScore: String(quiz.passingScore),
          attemptsAllowed: String(quiz.attemptsAllowed),
          timeLimitMinutes: quiz.timeLimitMinutes ? String(quiz.timeLimitMinutes) : "",
          randomize: quiz.randomize,
          showResult: quiz.showResult,
        }
      : { title: `${chapterName} Quiz`.slice(0, 150), description: "", passingScore: "60", attemptsAllowed: "3", timeLimitMinutes: "", randomize: false, showResult: true };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<SettingsForm>(init);
  const [local, setLocal] = useState<Record<string, string>>({});
  const { run, loading, fields, setFields } = useAction();
  const err = (k: keyof SettingsForm) => local[k] ?? fields[k];
  const set = <K extends keyof SettingsForm>(k: K, value: SettingsForm[K]) => {
    setV((s) => ({ ...s, [k]: value }));
    setLocal((s) => {
      const next = { ...s };
      delete next[k];
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...v, chapterId };
    const errs = checkFields(quizSchema, payload);
    setLocal(errs);
    if (Object.keys(errs).length) return;
    const res = await run(() => api("/api/admin/learning/quizzes", { method: "PUT", body: payload }), { success: editing ? "Quiz settings saved" : "Quiz created", refresh: true });
    if (res) setOpen(false);
  };

  return (
    <>
      <Button
        size={size}
        variant={variant ?? (editing ? "outline" : "primary")}
        icon={editing ? <Settings2 className="size-4" /> : <Plus className="size-4" />}
        onClick={() => {
          setV(init());
          setLocal({});
          setFields({});
          setOpen(true);
        }}
      >
        {editing ? "Settings" : "Create quiz"}
      </Button>
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title={editing ? "Quiz settings" : "Create quiz"}
        description="Students take this quiz after completing the chapter's learning requirements."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form="quiz-form" loading={loading}>
              {editing ? "Save settings" : "Create quiz"}
            </Button>
          </>
        }
      >
        <form id="quiz-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-3">
          <Field label="Quiz title" htmlFor="qz-title" required error={err("title")} className="sm:col-span-3">
            <Input id="qz-title" value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={150} invalid={Boolean(err("title"))} />
          </Field>
          <Field label="Instructions" htmlFor="qz-desc" error={err("description")} className="sm:col-span-3">
            <Textarea id="qz-desc" rows={3} value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} placeholder="Shown to students before they start" invalid={Boolean(err("description"))} />
          </Field>
          <Field label="Passing score (%)" htmlFor="qz-pass" required error={err("passingScore")}>
            <Input id="qz-pass" type="number" inputMode="numeric" min={0} max={100} step={1} value={v.passingScore} onChange={(e) => set("passingScore", e.target.value)} invalid={Boolean(err("passingScore"))} />
          </Field>
          <Field label="Attempts allowed" htmlFor="qz-attempts" required error={err("attemptsAllowed")}>
            <Input id="qz-attempts" type="number" inputMode="numeric" min={1} max={20} step={1} value={v.attemptsAllowed} onChange={(e) => set("attemptsAllowed", e.target.value)} invalid={Boolean(err("attemptsAllowed"))} />
          </Field>
          <Field label="Time limit (minutes)" htmlFor="qz-time" error={err("timeLimitMinutes")} hint="Leave empty for no time limit">
            <Input id="qz-time" type="number" inputMode="numeric" min={1} max={600} step={1} value={v.timeLimitMinutes} onChange={(e) => set("timeLimitMinutes", e.target.value)} placeholder="Untimed" invalid={Boolean(err("timeLimitMinutes"))} />
          </Field>
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:col-span-3">
            <Switch checked={v.randomize} onChange={(x) => set("randomize", x)} label={<span><b className="font-medium text-slate-900">Randomize question order</b> for each attempt</span>} />
            <Switch checked={v.showResult} onChange={(x) => set("showResult", x)} label={<span><b className="font-medium text-slate-900">Show results</b> — correct answers and explanations after submission</span>} />
          </div>
        </form>
      </Modal>
    </>
  );
}

// ── Question editor ──

interface QuestionForm {
  text: string;
  options: string[];
  correctIndex: number;
  marks: string;
  explanation: string;
}

export function QuestionFormButton({ quizId, question, label, size = "sm" }: { quizId: string; question?: QuestionRow; label?: string; size?: "sm" | "md" }) {
  const editing = Boolean(question);
  const init = (): QuestionForm =>
    question
      ? { text: question.text, options: question.options.length >= 2 ? [...question.options] : [...question.options, "", ""].slice(0, 2), correctIndex: question.correctIndex, marks: String(question.marks), explanation: question.explanation ?? "" }
      : { text: "", options: ["", "", "", ""], correctIndex: -1, marks: "1", explanation: "" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<QuestionForm>(init);
  const [local, setLocal] = useState<Record<string, string>>({});
  const { run, loading, fields, setFields } = useAction();
  const err = (k: string) => local[k] ?? fields[k];
  const clear = (...keys: string[]) =>
    setLocal((s) => {
      const next = { ...s };
      keys.forEach((k) => delete next[k]);
      return next;
    });

  const setOption = (i: number, text: string) => {
    setV((s) => ({ ...s, options: s.options.map((o, j) => (j === i ? text : o)) }));
    clear(`options.${i}`, "options");
  };
  const addOption = () => setV((s) => (s.options.length >= 6 ? s : { ...s, options: [...s.options, ""] }));
  const removeOption = (i: number) => {
    setV((s) => {
      if (s.options.length <= 2) return s;
      const options = s.options.filter((_, j) => j !== i);
      const correctIndex = s.correctIndex === i ? -1 : s.correctIndex > i ? s.correctIndex - 1 : s.correctIndex;
      return { ...s, options, correctIndex };
    });
    setLocal({});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Drop trailing empty options so "A, B filled; C, D empty" is valid.
    let options = v.options.map((o) => o.trim());
    while (options.length > 2 && !options[options.length - 1]) options = options.slice(0, -1);
    const payload = { text: v.text, options, correctIndex: v.correctIndex, marks: v.marks, explanation: v.explanation };
    const errs = checkFields(editing ? questionUpdateSchema : questionCreateSchema, editing ? payload : { ...payload, quizId });
    if (v.correctIndex < 0) errs.correctIndex = "Choose the correct answer";
    else if (!options[v.correctIndex]) errs.correctIndex = "The correct answer cannot be an empty option";
    setLocal(errs);
    if (Object.keys(errs).length) return;
    const res = await run(
      () => (editing ? api(`/api/admin/learning/questions/${question!.id}`, { method: "PATCH", body: payload }) : api("/api/admin/learning/questions", { body: { ...payload, quizId } })),
      { success: editing ? "Question updated" : "Question added", refresh: true },
    );
    if (!res) return;
    if (editing) setOpen(false);
    else {
      setV({ text: "", options: ["", "", "", ""], correctIndex: -1, marks: v.marks, explanation: "" });
      setOpen(false);
    }
  };

  return (
    <>
      {editing ? (
        <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} aria-label="Edit question" title="Edit question" onClick={() => { setV(init()); setLocal({}); setFields({}); setOpen(true); }} />
      ) : (
        <Button size={size} icon={<Plus className="size-4" />} onClick={() => { setV(init()); setLocal({}); setFields({}); setOpen(true); }}>
          {label ?? "Add question"}
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title={editing ? "Edit question" : "Add question"}
        description="Multiple choice with a single correct answer."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form="question-form" loading={loading}>
              {editing ? "Save question" : "Add question"}
            </Button>
          </>
        }
      >
        <form id="question-form" onSubmit={submit} noValidate className="space-y-4">
          <Field label="Question" htmlFor="qn-text" required error={err("text")}>
            <Textarea id="qn-text" rows={3} value={v.text} onChange={(e) => { setV((s) => ({ ...s, text: e.target.value })); clear("text"); }} maxLength={1000} invalid={Boolean(err("text"))} autoFocus />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-700">
              Options <span className="text-rose-500">*</span>
              <span className="ml-2 font-normal text-slate-500">Select the correct answer</span>
            </legend>
            <div className="space-y-2" role="radiogroup" aria-label="Correct answer">
              {v.options.map((o, i) => {
                const optErr = err(`options.${i}`);
                const correct = v.correctIndex === i;
                return (
                  <div key={i}>
                    <div className={cn("flex items-center gap-2 rounded-xl border p-1.5 pl-2 transition-colors", correct ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 bg-white")}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={correct}
                        aria-label={`Mark option ${OPTION_LETTERS[i]} as correct`}
                        onClick={() => {
                          setV((s) => ({ ...s, correctIndex: i }));
                          clear("correctIndex");
                        }}
                        className={cn("shrink-0 rounded-full", correct ? "text-emerald-600" : "text-slate-300 hover:text-slate-500")}
                      >
                        {correct ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
                      </button>
                      <span className="w-5 shrink-0 text-center text-sm font-semibold text-slate-500">{OPTION_LETTERS[i]}</span>
                      <Input
                        value={o}
                        onChange={(e) => setOption(i, e.target.value)}
                        maxLength={300}
                        placeholder={i < 2 ? `Option ${OPTION_LETTERS[i]} (required)` : `Option ${OPTION_LETTERS[i]} (optional)`}
                        aria-label={`Option ${OPTION_LETTERS[i]}`}
                        invalid={Boolean(optErr)}
                        className="h-9"
                      />
                      <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => removeOption(i)} disabled={v.options.length <= 2} aria-label={`Remove option ${OPTION_LETTERS[i]}`} title="Remove option" />
                    </div>
                    {optErr && <p className="mt-1 pl-14 text-xs font-medium text-rose-600">{optErr}</p>}
                  </div>
                );
              })}
            </div>
            {(err("correctIndex") || err("options")) && <p className="mt-1.5 text-xs font-medium text-rose-600">{err("options") ?? err("correctIndex")}</p>}
            <Button size="xs" variant="ghost" className="mt-2" icon={<Plus className="size-3.5" />} onClick={addOption} disabled={v.options.length >= 6}>
              {v.options.length >= 6 ? "Maximum 6 options" : "Add option"}
            </Button>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <Field label="Marks" htmlFor="qn-marks" required error={err("marks")}>
              <Input id="qn-marks" type="number" inputMode="numeric" min={1} max={100} step={1} value={v.marks} onChange={(e) => { setV((s) => ({ ...s, marks: e.target.value })); clear("marks"); }} invalid={Boolean(err("marks"))} />
            </Field>
            <Field label="Explanation" htmlFor="qn-expl" error={err("explanation")} hint="Optional — shown with the result when results are visible.">
              <Textarea id="qn-expl" rows={2} value={v.explanation} onChange={(e) => { setV((s) => ({ ...s, explanation: e.target.value })); clear("explanation"); }} maxLength={1000} invalid={Boolean(err("explanation"))} />
            </Field>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ── Question list ──

export function QuestionList({ quiz, questions, chapterId, chapterName, attempts }: { quiz: QuizValue; questions: QuestionRow[]; chapterId: string; chapterName: string; attempts: number }) {
  const totalMarks = questions.reduce((a, q) => a + q.marks, 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Questions</h3>
          <p className="text-sm text-slate-500">{questions.length ? `${plural(questions.length, "question")} · ${plural(totalMarks, "mark")} in total` : "No questions yet"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuizImportButton chapterId={chapterId} chapterName={chapterName} existingQuestions={questions.length} attempts={attempts} />
          <QuestionFormButton quizId={quiz.id} />
        </div>
      </div>
      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300">
          <EmptyState
            icon={<ClipboardList />}
            title="This quiz has no questions"
            description="Students cannot take the quiz until it has at least one question. Add questions one by one or import them from Excel."
            action={<QuestionFormButton quizId={quiz.id} label="Add the first question" />}
          />
        </div>
      ) : (
        <ol className="space-y-2.5">
          {questions.map((q, i) => (
            <QuestionItem key={q.id} q={q} index={i} quizId={quiz.id} first={i === 0} last={i === questions.length - 1} />
          ))}
        </ol>
      )}
    </div>
  );
}

function QuestionItem({ q, index, quizId, first, last }: { q: QuestionRow; index: number; quizId: string; first: boolean; last: boolean }) {
  const move = useAction();
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const doMove = async (direction: "up" | "down") => {
    setDir(direction);
    await move.run(() => api(`/api/admin/learning/questions/${q.id}/move`, { body: { direction } }), { refresh: true });
    setDir(null);
  };
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <button type="button" onClick={() => doMove("up")} disabled={first || move.loading} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent" aria-label={`Move question ${index + 1} up`} title="Move up">
            {dir === "up" ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
          <span className="flex size-7 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 tabular-nums">{index + 1}</span>
          <button type="button" onClick={() => doMove("down")} disabled={last || move.loading} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent" aria-label={`Move question ${index + 1} down`} title="Move down">
            {dir === "down" ? <Loader2 className="size-4 animate-spin" /> : <ArrowDown className="size-4" />}
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium break-words whitespace-pre-line text-slate-900">{q.text}</p>
            <div className="-mt-1 -mr-1 flex shrink-0 items-center">
              <Badge tone="gray" className="mr-1">{plural(q.marks, "mark")}</Badge>
              <QuestionFormButton quizId={quizId} question={q} />
              <DeleteAction url={`/api/admin/learning/questions/${q.id}`} title="Delete question?" description={`Question ${index + 1} will be removed from the quiz.`} success="Question deleted" iconOnly variant="ghost" />
            </div>
          </div>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {q.options.map((o, i) => {
              const correct = i === q.correctIndex;
              return (
                <li key={i} className={cn("flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-sm", correct ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200" : "bg-slate-50 text-slate-700")}>
                  <span className={cn("font-semibold", correct ? "text-emerald-700" : "text-slate-400")}>{OPTION_LETTERS[i]}</span>
                  <span className="min-w-0 flex-1 break-words">{o}</span>
                  {correct && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Correct answer" />}
                </li>
              );
            })}
          </ul>
          {q.explanation && <p className="mt-2 text-xs text-slate-500"><span className="font-medium text-slate-600">Explanation:</span> {q.explanation}</p>}
        </div>
      </div>
    </li>
  );
}

// ── Quiz header actions ──

export function QuizDeleteButton({ quizId, attempts, questions }: { quizId: string; attempts: number; questions: number }) {
  return (
    <DeleteAction
      url={`/api/admin/learning/quizzes/${quizId}`}
      title="Delete quiz?"
      description={`The quiz and its ${plural(questions, "question")} will be permanently removed.`}
      label="Delete quiz"
      success="Quiz deleted"
    >
      {attempts > 0 && <p className="text-sm text-amber-700">Students have already attempted this quiz, so it cannot be deleted.</p>}
    </DeleteAction>
  );
}
