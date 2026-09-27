import { BookMarked, Clock, NotebookPen, Target } from "lucide-react";
import { prisma } from "@/lib/db";
import { pagination } from "@/lib/http";
import { formatDate } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { ProgressBar } from "@/components/ui/progress";
import { Pagination } from "@/components/ui/filters";
import { StateBanner } from "@/components/student/state-banner";
import { internshipWindow, studentPage } from "../_lib/server";
import { LogbookForm, EditEntryButton } from "./logbook-form";

export const metadata = { title: "Log Book" };

export default async function LogbookPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { student, state, t } = await studentPage();
  const pg = pagination(sp, 20);
  const [entries, total, agg] = await Promise.all([
    prisma.logbookEntry.findMany({ where: { studentId: student.id }, orderBy: { date: "desc" }, skip: pg.skip, take: pg.take }),
    prisma.logbookEntry.count({ where: { studentId: student.id } }),
    prisma.logbookEntry.aggregate({ where: { studentId: student.id }, _sum: { hours: true } }),
  ]);
  const hours = Math.round((agg._sum.hours ?? 0) * 10) / 10;
  const duration = student.domain?.durationHours ?? 120;
  const pct = Math.min(100, (hours / Math.max(1, duration)) * 100);
  const { today, start, end } = internshipWindow(student);
  const maxDate = end && end < today ? end : today;
  const editable = state === "ACTIVE";
  const todayDone = await prisma.logbookEntry.findUnique({ where: { studentId_date: { studentId: student.id, date: today } }, select: { id: true } });

  return (
    <>
      <PageHeader title={t("log.title")} description={t("log.subtitle")} />
      <StateBanner state={state} student={student} context="logbook" />

      <StatGrid className="mb-6 lg:grid-cols-3">
        <StatCard label={t("log.totalHours")} value={`${hours}h`} hint={t("log.ofTarget", { n: duration })} icon={<Clock />} />
        <StatCard label={t("log.entries")} value={total} icon={<BookMarked />} tone="blue" />
        <StatCard label={t("log.remaining")} value={`${Math.max(0, Math.round((duration - hours) * 10) / 10)}h`} icon={<Target />} tone="amber" />
      </StatGrid>
      <Card className="mb-6 p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">{t("log.progress")}</span>
          <span className="font-semibold text-slate-900 tabular-nums">
            {hours} / {duration}h
          </span>
        </div>
        <ProgressBar value={pct} tone={pct >= 100 ? "green" : "brand"} showLabel />
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        {editable && start && (
          <div className="lg:col-span-2">
            <Card className="lg:sticky lg:top-24">
              <CardHeader icon={<NotebookPen className="size-5" />} title={t("log.newEntry")} description={todayDone ? t("log.todayDone") : t("log.newEntryDesc")} />
              <LogbookForm minDate={start} maxDate={maxDate} defaultDate={todayDone ? "" : maxDate} />
            </Card>
          </div>
        )}
        <div className={editable && start ? "lg:col-span-3" : "lg:col-span-5"}>
          <Card>
            <CardHeader title={t("log.entriesTitle")} description={t("log.entriesDesc")} />
            {entries.length === 0 ? (
              <EmptyState icon={<NotebookPen />} title={t("log.emptyTitle")} description={editable ? t("log.emptyDesc") : t("log.emptyReadonly")} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {entries.map((e) => (
                  <li key={e.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatDate(e.date, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-xs text-slate-500">{t("log.hoursValue", { n: e.hours })}</p>
                      </div>
                      {editable && (
                        <EditEntryButton entry={{ id: e.id, date: e.date, hours: e.hours, activity: e.activity, skills: e.skills }} minDate={start ?? e.date} maxDate={maxDate} />
                      )}
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-line text-slate-700">{e.activity}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {e.skills
                        .split(/[,;\n]/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((s, i) => (
                          <span key={i} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                            {s}
                          </span>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {total > pg.pageSize && <Pagination page={pg.page} pageSize={pg.pageSize} total={total} />}
          </Card>
        </div>
      </div>
    </>
  );
}
