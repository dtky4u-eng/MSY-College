// Selected chapter: details, and its Resources / Quiz tabs (server component with client islands).
import { AlertTriangle, BookOpenCheck, ClipboardList, Clock, Eye, Shuffle, Target, Timer, Users, Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState } from "@/components/ui/page";
import { LinkTabs } from "@/components/ui/tabs";
import { DeleteAction } from "./delete-action";
import { ChapterFormButton } from "./outline-forms";
import { ResourceManager } from "./resource-manager";
import { QuestionList, QuizDeleteButton, QuizSettingsButton } from "./quiz-panel";
import { QuizImportButton } from "./quiz-import";
import { learningHref, minutesLabel, plural, type LearningTab } from "./shared";
import type { ChapterValue, Filters, ModuleValue, QuestionRow, QuizStats, QuizValue, ResourceRow } from "./types";

export function ChapterWorkspace({
  domainId,
  module,
  chapter,
  learners,
  resources,
  quiz,
  questions,
  stats,
  tab,
  filters,
}: {
  domainId: string;
  module: ModuleValue;
  chapter: ChapterValue;
  learners: number;
  resources: ResourceRow[];
  quiz: QuizValue | null;
  questions: QuestionRow[];
  stats: QuizStats;
  tab: LearningTab;
  filters: Filters;
}) {
  return (
    <Card id="workspace" className="scroll-mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">
            Module {module.number} · {module.name}
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
            <span className="mr-1.5 text-slate-400 tabular-nums">
              {module.number}.{chapter.number}
            </span>
            {chapter.name}
          </h2>
          {chapter.description && <p className="mt-1.5 max-w-3xl text-sm whitespace-pre-line text-slate-600">{chapter.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Chip icon={<Clock className="size-3.5" />} label="Min. watch time" value={minutesLabel(chapter.minWatchSeconds)} />
            <Chip icon={<BookOpenCheck className="size-3.5" />} label="Min. reading time" value={minutesLabel(chapter.minReadSeconds)} />
            <Chip icon={<Users className="size-3.5" />} label="Learners started" value={String(learners)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ChapterFormButton moduleId={module.id} domainId={domainId} chapter={chapter} filters={filters} />
          <DeleteAction
            url={`/api/admin/learning/chapters/${chapter.id}`}
            title={`Delete chapter ${module.number}.${chapter.number}?`}
            description={`“${chapter.name}”, its ${plural(resources.length, "resource")} and its quiz will be permanently deleted.`}
            success="Chapter deleted"
            redirectTo={learningHref({ ...filters, domain: domainId, module: module.id })}
          />
        </div>
      </div>

      <LinkTabs
        className="mt-4 px-3"
        items={[
          { key: "resources", label: "Resources", count: resources.length },
          { key: "quiz", label: "Quiz", count: questions.length },
        ]}
      />

      <div className="p-5">
        {tab === "resources" ? (
          <ResourceManager chapterId={chapter.id} resources={resources} />
        ) : quiz ? (
          <div className="space-y-5">
            <QuizSummary quiz={quiz} chapterName={chapter.name} questions={questions} stats={stats} />
            {stats.attempts > 0 && (
              <Alert tone="warning" icon={<AlertTriangle />}>
                Students have made {plural(stats.attempts, "attempt")} on this quiz. Changes to questions and settings apply to future attempts; recorded scores are not recalculated.
              </Alert>
            )}
            <QuestionList quiz={quiz} questions={questions} chapterId={chapter.id} chapterName={chapter.name} attempts={stats.attempts} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300">
            <EmptyState
              icon={<ClipboardList />}
              title="No quiz for this chapter"
              description="Create a quiz and add questions, or import questions from Excel — a quiz with default settings is created automatically."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <QuizSettingsButton chapterId={chapter.id} chapterName={chapter.name} size="md" />
                  <QuizImportButton chapterId={chapter.id} chapterName={chapter.name} existingQuestions={0} attempts={0} size="md" />
                </div>
              }
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function Chip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
      {icon}
      <span>{label}:</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </span>
  );
}

function QuizSummary({ quiz, chapterName, questions, stats }: { quiz: QuizValue; chapterName: string; questions: QuestionRow[]; stats: QuizStats }) {
  const passRate = stats.submitted ? Math.round((stats.passed / stats.submitted) * 100) : null;
  const facts: [React.ReactNode, string, string][] = [
    [<Target key="t" className="size-3.5" />, "Pass mark", `${quiz.passingScore}%`],
    [<Repeat key="r" className="size-3.5" />, "Attempts", String(quiz.attemptsAllowed)],
    [<Timer key="tm" className="size-3.5" />, "Time limit", quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "Untimed"],
    [<Shuffle key="s" className="size-3.5" />, "Order", quiz.randomize ? "Randomized" : "Fixed"],
    [<Eye key="e" className="size-3.5" />, "Results", quiz.showResult ? "Shown" : "Hidden"],
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">{quiz.title}</h3>
            {questions.length === 0 && <Badge tone="amber">No questions</Badge>}
          </div>
          {quiz.description && <p className="mt-1 text-sm whitespace-pre-line text-slate-600">{quiz.description}</p>}
          <p className="mt-1 text-xs text-slate-500">
            {plural(stats.submitted, "submitted attempt")}
            {passRate !== null && ` · ${passRate}% passed`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuizSettingsButton chapterId={quiz.chapterId} chapterName={chapterName} quiz={quiz} />
          <QuizDeleteButton quizId={quiz.id} attempts={stats.attempts} questions={questions.length} />
        </div>
      </div>
      <dl className="mt-3 flex flex-wrap gap-2">
        {facts.map(([icon, label, value]) => (
          <div key={label} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
            <span className="text-slate-400">{icon}</span>
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-semibold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
