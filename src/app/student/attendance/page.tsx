import Link from "next/link";
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, History, Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { attendanceStats } from "@/lib/student";
import { getInternshipSettings } from "@/lib/settings";
import { formatDate, formatTime, istWeekday, toISTDateString, workingDaysBetween } from "@/lib/format";
import { pagination } from "@/lib/http";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { DateFilter, FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { StateBanner } from "@/components/student/state-banner";
import { cn } from "@/components/ui/cn";
import { formatDuration } from "@/components/student/utils";
import { checkDateInWindow, internshipWindow, stateBlockMessage, studentPage } from "../_lib/server";
import { TodayCard } from "./today-card";

export const metadata = { title: "Attendance" };

const STATUS_CELL: Record<string, string> = {
  PRESENT: "bg-emerald-500 text-white",
  HALF_DAY: "bg-amber-400 text-white",
  ABSENT: "bg-rose-500 text-white",
  LEAVE: "bg-sky-500 text-white",
  NOT_MARKED: "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200",
};

type SP = Record<string, string | undefined>;

export default async function AttendancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { student, state, t } = await studentPage();
  const [rows, settings] = await Promise.all([
    prisma.attendance.findMany({ where: { studentId: student.id }, orderBy: { date: "desc" } }),
    getInternshipSettings(),
  ]);
  const stats = await attendanceStats(student.id, student.internshipStart, student.internshipEnd, { rows });
  const { today, start, end } = internshipWindow(student);
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const todayRow = byDate.get(today) ?? null;

  // Can the student mark attendance today?
  let blockReason: string | null = null;
  if (state !== "ACTIVE") blockReason = stateBlockMessage(state, t, student.blockedReason);
  else blockReason = checkDateInWindow(today, student, t);

  // ── Calendar month ──
  const monthParam = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const [y, m] = monthParam.split("-").map(Number) as [number, number];
  const first = `${monthParam}-01`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (istWeekday(first) + 6) % 7; // Monday-first grid
  const prevMonth = toISTDateString(new Date(Date.UTC(y, m - 2, 15)));
  const nextMonth = toISTDateString(new Date(Date.UTC(y, m, 15)));
  const minMonth = start ? start.slice(0, 7) : today.slice(0, 7);
  const maxMonth = (end && end < today ? end : today).slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat(t("locale"), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  const weekdayNames = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(t("locale"), { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i))));
  const cells: { ymd: string; day: number; status: string | null; inWindow: boolean; sunday: boolean; future: boolean }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${monthParam}-${String(d).padStart(2, "0")}`;
    const inWindow = Boolean(start && ymd >= start && (!end || ymd <= end));
    const sunday = istWeekday(ymd) === 0;
    const future = ymd > today;
    const row = byDate.get(ymd);
    cells.push({ ymd, day: d, status: row?.status ?? (inWindow && !sunday && !future && ymd !== today ? "NOT_MARKED" : null), inWindow, sunday, future });
  }

  // ── History ──
  const upTo = end && end < today ? end : today;
  const historyDays = start ? workingDaysBetween(start, upTo) : [];
  const allDates = [...new Set([...historyDays, ...rows.map((r) => r.date)])].sort().reverse();
  const q = (sp.q ?? "").trim().toLowerCase();
  const filtered = allDates
    .map((d) => {
      const r = byDate.get(d);
      return { date: d, status: r?.status ?? "NOT_MARKED", checkIn: r?.checkIn ?? null, checkOut: r?.checkOut ?? null, remarks: r?.remarks ?? null, learningSeconds: r?.learningSeconds ?? 0 };
    })
    .filter((r) => (!sp.from || r.date >= sp.from) && (!sp.to || r.date <= sp.to))
    .filter((r) => !sp.status || r.status === sp.status)
    .filter((r) => !q || r.date.includes(q) || formatDate(r.date).toLowerCase().includes(q) || (r.remarks ?? "").toLowerCase().includes(q) || t(`att.${r.status}`).toLowerCase().includes(q));
  const pg = pagination(sp, 15);
  const pageRows = filtered.slice(pg.skip, pg.skip + pg.take);
  const statusOptions = ["PRESENT", "HALF_DAY", "ABSENT", "LEAVE", "NOT_MARKED"].map((s) => ({ value: s, label: t(`att.${s}`) }));

  return (
    <>
      <PageHeader title={t("att.title")} description={t("att.subtitle")} />
      <StateBanner state={state} student={student} context="attendance" />

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <TodayCard
            today={today}
            row={todayRow ? { checkIn: todayRow.checkIn?.toISOString() ?? null, checkOut: todayRow.checkOut?.toISOString() ?? null, status: todayRow.status, learningSeconds: todayRow.learningSeconds } : null}
            blockReason={blockReason}
            locked={state === "COMPLETED"}
            halfDayBelowHours={settings.halfDayBelowHours}
            checkInFrom={settings.checkInFrom}
          />
        </div>
        <div className="lg:col-span-2">
          <StatGrid className="lg:grid-cols-3">
            <StatCard label={t("att.percent")} value={`${stats.percent}%`} hint={<ProgressBar value={stats.percent} size="sm" tone={stats.percent >= 75 ? "green" : "amber"} />} icon={<CalendarCheck />} tone="green" />
            <StatCard label={t("att.PRESENT")} value={stats.present} icon={<span className="size-2.5 rounded-full bg-emerald-500" />} tone="green" />
            <StatCard label={t("att.HALF_DAY")} value={stats.halfDay} icon={<span className="size-2.5 rounded-full bg-amber-400" />} tone="amber" />
            <StatCard label={t("att.ABSENT")} value={stats.absent} icon={<span className="size-2.5 rounded-full bg-rose-500" />} tone="red" />
            <StatCard label={t("att.LEAVE")} value={stats.leave} icon={<span className="size-2.5 rounded-full bg-sky-500" />} tone="blue" />
            <StatCard label={t("att.NOT_MARKED")} value={stats.notMarked} hint={t("att.workingDaysHint", { n: stats.workingDays, total: stats.totalDays })} icon={<span className="size-2.5 rounded-full bg-slate-300" />} tone="gray" />
          </StatGrid>
        </div>
      </div>

      {/* Calendar */}
      <Card className="mb-6">
        <CardHeader
          icon={<CalendarDays className="size-5" />}
          title={t("att.calendar")}
          description={monthLabel}
          actions={
            <div className="flex items-center gap-1">
              <MonthLink href={`?month=${prevMonth.slice(0, 7)}`} disabled={monthParam <= minMonth} label={t("att.prevMonth")}>
                <ChevronLeft className="size-4" />
              </MonthLink>
              <Link href="?" className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-sm leading-8 font-medium text-slate-700 hover:bg-slate-50">
                {t("att.thisMonth")}
              </Link>
              <MonthLink href={`?month=${nextMonth.slice(0, 7)}`} disabled={monthParam >= maxMonth} label={t("att.nextMonth")}>
                <ChevronRight className="size-4" />
              </MonthLink>
            </div>
          }
        />
        <div className="p-4 sm:p-5">
          {!start ? (
            <EmptyState icon={<CalendarDays />} title={t("att.noWindow")} description={t("att.noWindowDesc")} className="py-8" />
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold tracking-wide text-slate-400 uppercase sm:gap-2">
                {weekdayNames.map((w) => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-2">
                {Array.from({ length: lead }).map((_, i) => (
                  <div key={`l${i}`} />
                ))}
                {cells.map((c) => (
                  <div
                    key={c.ymd}
                    title={`${formatDate(c.ymd)}${c.status ? ` · ${t(`att.${c.status}`)}` : c.sunday ? ` · ${t("att.sunday")}` : ""}`}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-semibold tabular-nums sm:rounded-xl",
                      c.status ? STATUS_CELL[c.status] : c.inWindow && c.sunday ? "bg-slate-50 text-slate-300" : c.inWindow ? "border border-dashed border-slate-200 bg-white text-slate-400" : "text-slate-300",
                      c.ymd === today && "outline-2 outline-offset-1 outline-brand-500",
                    )}
                  >
                    {c.day}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
                {(["PRESENT", "HALF_DAY", "ABSENT", "LEAVE", "NOT_MARKED"] as const).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5">
                    <span className={cn("size-3 rounded", STATUS_CELL[s])} /> {t(`att.${s}`)}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded bg-slate-50 ring-1 ring-slate-200" /> {t("att.sunday")}
                </span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* History */}
      <Card>
        <CardHeader icon={<History className="size-5" />} title={t("att.history")} description={t("att.historyDesc")} actions={state === "COMPLETED" ? <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500"><Lock className="size-3.5" /> {t("att.lockedShort")}</span> : null} />
        <FilterBar>
          <SearchInput placeholder={t("att.searchPlaceholder")} />
          <FilterSelect param="status" options={statusOptions} placeholder={t("att.allStatuses")} label={t("att.status")} />
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            {t("att.from")} <DateFilter param="from" label={t("att.from")} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            {t("att.to")} <DateFilter param="to" label={t("att.to")} />
          </label>
        </FilterBar>
        <Table>
          <THead>
            <tr>
              <TH>{t("att.date")}</TH>
              <TH>{t("att.status")}</TH>
              <TH>{t("att.checkIn")}</TH>
              <TH>{t("att.checkOut")}</TH>
              <TH>{t("att.duration")}</TH>
              <TH>{t("att.learning")}</TH>
              <TH>{t("att.remarks")}</TH>
            </tr>
          </THead>
          <TBody>
            {pageRows.length === 0 ? (
              <EmptyRow colSpan={7}>{t("att.noHistory")}</EmptyRow>
            ) : (
              pageRows.map((r) => (
                <TR key={r.date}>
                  <TD className="whitespace-nowrap font-medium text-slate-900">
                    {formatDate(r.date)}
                    <span className="ml-1.5 text-xs font-normal text-slate-400">{new Intl.DateTimeFormat(t("locale"), { weekday: "short", timeZone: "Asia/Kolkata" }).format(new Date(r.date + "T12:00:00+05:30"))}</span>
                  </TD>
                  <TD>
                    <StatusBadge status={r.status} label={t(`att.${r.status}`)} />
                  </TD>
                  <TD className="whitespace-nowrap">{r.checkIn ? formatTime(r.checkIn) : "—"}</TD>
                  <TD className="whitespace-nowrap">{r.checkOut ? formatTime(r.checkOut) : "—"}</TD>
                  <TD className="whitespace-nowrap">{r.checkIn && r.checkOut ? formatDuration((r.checkOut.getTime() - r.checkIn.getTime()) / 1000) : "—"}</TD>
                  <TD className="whitespace-nowrap">{r.learningSeconds ? formatDuration(r.learningSeconds) : "—"}</TD>
                  <TD className="max-w-[260px] truncate text-slate-500">{r.remarks ?? "—"}</TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
        <Pagination page={pg.page} pageSize={pg.pageSize} total={filtered.length} />
      </Card>
      <p className="mt-3 text-xs text-slate-500">{t("att.rulesNote", { hours: settings.halfDayBelowHours, time: settings.checkInFrom })}</p>
    </>
  );
}

function MonthLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  if (disabled)
    return (
      <span aria-disabled className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-300">
        {children}
      </span>
    );
  return (
    <Link href={href} aria-label={label} className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50">
      {children}
    </Link>
  );
}
