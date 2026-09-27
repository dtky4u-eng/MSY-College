import Link from "next/link";
import { BookOpen, CheckCircle2, ChevronRight, Eye, ListChecks, Lock, PlayCircle, Timer } from "lucide-react";
import { learningTree } from "@/lib/student";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { cn } from "@/components/ui/cn";
import { StateBanner } from "@/components/student/state-banner";
import { formatDuration } from "@/components/student/utils";
import { hoursFromSeconds } from "@/lib/format";
import { studentPage } from "../_lib/server";

export const metadata = { title: "Learning Modules" };

export default async function LearningPage() {
  const { student, state, t } = await studentPage();
  const tree = await learningTree(student.id, student.domainId);
  const chapters = tree.modules.flatMap((m) => m.chapters);
  const current = chapters.find((c) => c.unlocked && !c.completed) ?? null;

  return (
    <>
      <PageHeader title={t("learn.title")} description={t("learn.subtitle", { domain: student.domain?.name ?? "—" })} />
      <StateBanner state={state} student={student} context="learning" />

      {tree.total === 0 ? (
        <Card>
          <EmptyState icon={<BookOpen />} title={t("learn.emptyTitle")} description={t("learn.emptyDesc")} />
        </Card>
      ) : (
        <>
          <Card className="mb-6 p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <ProgressRing value={tree.percent} size={88} sub={t("learn.complete")} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{t("learn.progressTitle", { done: tree.completed, total: tree.total })}</p>
                <p className="mt-0.5 text-sm text-slate-500">{t("learn.learningTime", { h: hoursFromSeconds(student.learningSeconds) })}</p>
                <ProgressBar value={tree.percent} className="mt-3" />
              </div>
              {current && (
                <Link
                  href={`/student/learning/${current.id}`}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
                >
                  <PlayCircle className="size-5" /> {current.watchSeconds + current.readSeconds > 0 ? t("learn.continue") : t("learn.start")}
                </Link>
              )}
            </div>
            <p className="mt-4 text-xs text-slate-500">{t("learn.sequentialNote")}</p>
          </Card>

          <div className="space-y-5">
            {tree.modules.map((m) => {
              const pct = m.chapters.length ? Math.round((m.completed / m.chapters.length) * 100) : 0;
              return (
                <Card key={m.id} className={cn(!m.unlocked && "opacity-80")}>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl font-display text-base font-bold", m.unlocked ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400")}>
                        {m.unlocked ? m.number : <Lock className="size-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{t("learn.module", { n: m.number })}</p>
                        <h2 className="text-base font-semibold text-slate-900">{m.name}</h2>
                        {m.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{m.description}</p>}
                      </div>
                    </div>
                    <div className="w-full sm:w-44">
                      <p className="mb-1 text-right text-xs text-slate-500">{t("learn.chaptersOf", { done: m.completed, total: m.chapters.length })}</p>
                      <ProgressBar value={pct} size="sm" tone={pct === 100 ? "green" : "brand"} />
                    </div>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {m.chapters.map((c) => {
                      const locked = !c.unlocked;
                      const body = (
                        <div className={cn("flex items-center gap-3 px-5 py-3.5", !locked && "hover:bg-slate-50")}>
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-full",
                              c.completed ? "bg-emerald-50 text-emerald-600" : locked ? "bg-slate-100 text-slate-400" : "bg-brand-600 text-white",
                            )}
                            aria-hidden
                          >
                            {c.completed ? <CheckCircle2 className="size-5" /> : locked ? <Lock className="size-4" /> : <PlayCircle className="size-5" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={cn("truncate text-sm font-medium", locked ? "text-slate-500" : "text-slate-900")}>
                              {m.number}.{c.number} {c.name}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                              {c.minWatchSeconds > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <PlayCircle className="size-3.5" /> {formatDuration(Math.min(c.watchSeconds, c.minWatchSeconds))}/{formatDuration(c.minWatchSeconds)}
                                </span>
                              )}
                              {c.minReadSeconds > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <Eye className="size-3.5" /> {formatDuration(Math.min(c.readSeconds, c.minReadSeconds))}/{formatDuration(c.minReadSeconds)}
                                </span>
                              )}
                              {c.quiz && (
                                <span className="inline-flex items-center gap-1">
                                  <ListChecks className="size-3.5" /> {c.quiz.bestPercent !== null ? t("learn.bestScore", { pct: c.quiz.bestPercent }) : t("learn.quizCount", { n: c.quiz.questionCount })}
                                  {c.quiz.timeLimitMinutes ? (
                                    <span className="inline-flex items-center gap-0.5">
                                      · <Timer className="size-3" /> {c.quiz.timeLimitMinutes}m
                                    </span>
                                  ) : null}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="hidden shrink-0 sm:block">
                            {c.completed ? (
                              <Badge tone="green">{t("learn.completed")}</Badge>
                            ) : locked ? (
                              <Badge tone="gray">{t("learn.locked")}</Badge>
                            ) : c.quiz && !c.quiz.passed && c.quiz.attemptsRemaining === 0 && !c.quiz.openAttemptId && c.quiz.attemptsUsed > 0 ? (
                              <Badge tone="red">{t("quiz.exhaustedShort")}</Badge>
                            ) : (
                              <Badge tone="brand" dot>
                                {t("learn.inProgress")}
                              </Badge>
                            )}
                          </div>
                          {!locked && <ChevronRight className="size-4 shrink-0 text-slate-300" />}
                        </div>
                      );
                      return (
                        <li key={c.id}>
                          {locked ? (
                            <div aria-disabled title={t("learn.lockedHint")}>
                              {body}
                            </div>
                          ) : (
                            <Link href={`/student/learning/${c.id}`}>{body}</Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
