import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Clock,
  FileText,
  FolderKanban,
  ListChecks,
  Mail,
  Megaphone,
  NotebookPen,
  Phone,
  Timer,
  UserRound,
  Video,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { studentProgress, type EligibilityCheck } from "@/lib/student";
import { getEligibilityRules } from "@/lib/settings";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page";
import { Avatar } from "@/components/ui/avatar";
import { StateBanner } from "@/components/student/state-banner";
import { LiveClassList } from "@/components/student/live-classes";
import { studentPage } from "./_lib/server";
import { upcomingClasses } from "./_lib/live";

export const metadata = { title: "Dashboard" };

type Activity = { at: Date; icon: "att" | "log" | "sub" | "quiz"; title: string; detail: string; href: string };

export default async function StudentDashboard() {
  const { student, state, t } = await studentPage();
  const [progress, announcements, attendance, logs, subs, attempts, classes] = await Promise.all([
    studentProgress(student.id),
    student.userId
      ? prisma.notification.findMany({ where: { userId: student.userId, kind: "MESSAGE" }, orderBy: { createdAt: "desc" }, take: 5 })
      : Promise.resolve([]),
    prisma.attendance.findMany({ where: { studentId: student.id }, orderBy: { date: "desc" }, take: 5 }),
    prisma.logbookEntry.findMany({ where: { studentId: student.id }, orderBy: { date: "desc" }, take: 5 }),
    prisma.submission.findMany({ where: { studentId: student.id }, orderBy: { updatedAt: "desc" }, take: 5, include: { assignment: { select: { title: true } } } }),
    prisma.quizAttempt.findMany({ where: { studentId: student.id, submittedAt: { not: null } }, orderBy: { submittedAt: "desc" }, take: 5, include: { quiz: { select: { title: true, chapterId: true } } } }),
    state === "ACTIVE" ? upcomingClasses(student, 5) : Promise.resolve([]),
  ]);
  const rules = await getEligibilityRules();

  const kindLabel = (k: string) => t(`sub.kind.${k}`);
  const activity: Activity[] = [
    ...attendance.map((a) => ({
      at: a.checkOut ?? a.checkIn ?? new Date(a.date + "T12:00:00+05:30"),
      icon: "att" as const,
      title: t("act.attendance", { status: t(`att.${a.status}`) }),
      detail: formatDate(a.date),
      href: "/student/attendance",
    })),
    ...logs.map((l) => ({ at: l.updatedAt, icon: "log" as const, title: t("act.logbook", { hours: l.hours }), detail: `${formatDate(l.date)} · ${l.activity.slice(0, 80)}`, href: "/student/logbook" })),
    ...subs.map((s) => ({
      at: s.updatedAt,
      icon: "sub" as const,
      title: t("act.submission", { kind: kindLabel(s.kind), status: t(`sub.${s.status}`) }),
      detail: s.assignment?.title ?? s.title ?? kindLabel(s.kind),
      href: s.kind === "ASSIGNMENT" ? "/student/assignments" : s.kind === "PROJECT" ? "/student/live-project" : "/student/report",
    })),
    ...attempts.map((q) => ({
      at: q.submittedAt!,
      icon: "quiz" as const,
      title: q.passed ? t("act.quizPassed", { pct: q.percent }) : t("act.quizFailed", { pct: q.percent }),
      detail: q.quiz.title,
      href: `/student/learning/${q.quiz.chapterId}`,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  const actIcon = { att: CalendarCheck, log: NotebookPen, sub: FileText, quiz: ListChecks };
  const actTone = { att: "bg-emerald-50 text-emerald-600", log: "bg-sky-50 text-sky-600", sub: "bg-violet-50 text-violet-600", quiz: "bg-amber-50 text-amber-600" };
  const p = progress;
  const firstName = student.name.split(/\s+/)[0];

  // Localised eligibility checklist (labels from lib/student are English).
  const eligLabel = (c: EligibilityCheck) => {
    switch (c.key) {
      case "attendance":
        return t("elig.attendance", { n: rules.minAttendancePercent });
      case "hours":
        return t("elig.hours", { n: Math.round((p.durationHours * rules.minHoursPercent) / 100) });
      case "quiz":
        return t("elig.quiz", { n: rules.minQuizAverage });
      case "chapters":
      case "project":
      case "report":
      case "assessment":
        return t(`elig.${c.key}`);
      default:
        return c.label;
    }
  };
  const eligDetail = (c: EligibilityCheck) => {
    switch (c.key) {
      case "hours":
        return t("elig.hoursDetail", { n: p.loggedHours });
      case "quiz":
        return p.quizzes.total ? c.detail : t("elig.noQuizzes");
      case "project":
      case "report": {
        const st = c.key === "project" ? p.project.status : p.report.status;
        return st ? t(`sub.${st}`) : t("sub.notSubmitted");
      }
      case "assessment":
        return p.assessment.submitted ? (p.assessment.recommend ? t("elig.recommended") : t("elig.notRecommended")) : t("elig.assessmentPending");
      default:
        return c.detail;
    }
  };

  return (
    <>
      <StateBanner state={state} student={student} />

      {/* Hero */}
      <section className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-500 p-5 text-white shadow-card sm:p-7">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-brand-100">{t("dash.greeting")}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{t("dash.hello", { name: firstName ?? student.name })}</h1>
            <p className="mt-1 text-sm text-brand-100">{student.domain?.name ?? t("dash.noDomain")}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-white/15 px-2.5 py-1 font-semibold ring-1 ring-white/25">{t(`state.${state}`)}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/20">
                {t("dash.start")}: {formatDate(student.internshipStart)}
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/20">
                {t("dash.end")}: {formatDate(student.internshipEnd)}
              </span>
              {student.portalRegNo && <span className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/20">{student.portalRegNo}</span>}
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-white p-4 text-slate-900 shadow-pop">
            <ProgressRing value={p.overallPercent} size={92} sub={t("dash.overall")} />
            <div className="text-sm">
              <p className="font-semibold">{t("dash.overallProgress")}</p>
              <p className="mt-1 text-slate-500">{t("dash.hoursRemaining", { n: p.hoursRemaining })}</p>
              <p className="text-slate-500">{t("dash.hoursOf", { done: p.loggedHours, total: p.durationHours })}</p>
            </div>
          </div>
        </div>
      </section>

      <StatGrid className="mb-6">
        <StatCard label={t("dash.courseProgress")} value={`${p.learning.percent}%`} hint={t("dash.chaptersDone", { done: p.learning.completed, total: p.learning.total })} icon={<BookOpen />} href="/student/learning" />
        <StatCard label={t("dash.hoursLogged")} value={`${p.loggedHours}h`} hint={t("dash.hoursRemaining", { n: p.hoursRemaining })} icon={<Clock />} tone="blue" href="/student/logbook" />
        <StatCard label={t("dash.attendance")} value={`${p.attendance.percent}%`} hint={t("dash.attendanceHint", { present: p.attendance.present, days: p.attendance.workingDays })} icon={<CalendarCheck />} tone="green" href="/student/attendance" />
        <StatCard label={t("dash.learningHours")} value={`${p.learningHours}h`} hint={t("dash.learningHoursHint")} icon={<Timer />} tone="violet" />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-6 xl:col-span-2">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <SummaryCard href="/student/learning" icon={<BookOpen className="size-5" />} title={t("nav.learning")} value={`${p.learning.completed}/${p.learning.total}`} sub={t("dash.chaptersCompleted")}>
              <ProgressBar value={p.learning.percent} showLabel />
            </SummaryCard>
            <SummaryCard href="/student/learning" icon={<ListChecks className="size-5" />} title={t("dash.quizzes")} value={`${p.quizzes.passed}/${p.quizzes.total}`} sub={t("dash.quizzesPassed")}>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone="brand">{t("dash.quizAverage", { pct: p.quizzes.average })}</Badge>
                {p.quizzes.exhausted > 0 && <Badge tone="red">{t("dash.quizExhausted", { n: p.quizzes.exhausted })}</Badge>}
              </div>
            </SummaryCard>
            <SummaryCard href="/student/logbook" icon={<NotebookPen className="size-5" />} title={t("nav.logbook")} value={t("dash.entries", { n: p.logbook.entries })} sub={t("dash.hoursOf", { done: p.logbook.hours, total: p.durationHours })}>
              <ProgressBar value={(p.logbook.hours / Math.max(1, p.durationHours)) * 100} tone="green" showLabel />
            </SummaryCard>
            <SummaryCard href="/student/attendance" icon={<CalendarCheck className="size-5" />} title={t("nav.attendance")} value={`${p.attendance.percent}%`} sub={t("dash.workingDays", { n: p.attendance.workingDays })}>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge tone="green">{t("att.PRESENT")}: {p.attendance.present}</Badge>
                <Badge tone="amber">{t("att.HALF_DAY")}: {p.attendance.halfDay}</Badge>
                <Badge tone="red">{t("att.ABSENT")}: {p.attendance.absent}</Badge>
                <Badge tone="blue">{t("att.LEAVE")}: {p.attendance.leave}</Badge>
              </div>
            </SummaryCard>
            <SummaryCard href="/student/assignments" icon={<ClipboardList className="size-5" />} title={t("nav.assignments")} value={`${p.assignments.submitted}/${p.assignments.total}`} sub={t("dash.assignmentsSubmitted")}>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge tone="green">{t("sub.APPROVED")}: {p.assignments.approved}</Badge>
                <Badge tone="amber">{t("sub.PENDING")}: {p.assignments.pending}</Badge>
              </div>
            </SummaryCard>
            <SummaryCard href="/student/live-project" icon={<FolderKanban className="size-5" />} title={t("nav.liveProject")} value={p.project.status ? t(`sub.${p.project.status}`) : t("sub.notSubmitted")} sub={p.project.title ?? t("dash.projectHint")}>
              {p.project.status && <StatusBadge status={p.project.status} label={t(`sub.${p.project.status}`)} />}
            </SummaryCard>
            <SummaryCard href="/student/report" icon={<FileText className="size-5" />} title={t("nav.report")} value={p.report.status ? t(`sub.${p.report.status}`) : t("sub.notSubmitted")} sub={t("dash.reportHint")}>
              {p.report.status && <StatusBadge status={p.report.status} label={t(`sub.${p.report.status}`)} />}
            </SummaryCard>
            <SummaryCard href="/student/downloads" icon={<Award className="size-5" />} title={t("dash.certificate")} value={p.eligibility.eligible ? t("dash.eligible") : t("dash.notEligible")} sub={t("dash.checksMet", { met: p.eligibility.checks.filter((c) => c.met).length, total: p.eligibility.checks.length })}>
              <ProgressBar value={(p.eligibility.checks.filter((c) => c.met).length / Math.max(1, p.eligibility.checks.length)) * 100} tone={p.eligibility.eligible ? "green" : "amber"} />
            </SummaryCard>
          </div>

          {/* Upcoming live classes */}
          <Card>
            <CardHeader icon={<Video className="size-5" />} title={t("live.upcomingTitle")} description={t("live.upcomingDesc")} />
            {state === "ACTIVE" ? (
              <LiveClassList initial={classes} />
            ) : (
              <EmptyState icon={<Video />} title={t("live.emptyTitle")} description={t("live.inactiveDesc")} className="py-10" />
            )}
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader icon={<Clock className="size-5" />} title={t("dash.recentActivity")} />
            {activity.length === 0 ? (
              <EmptyState icon={<Clock />} title={t("dash.noActivity")} description={t("dash.noActivityDesc")} className="py-10" />
            ) : (
              <ol className="relative px-5 py-4">
                {activity.map((a, i) => {
                  const I = actIcon[a.icon];
                  return (
                    <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                      {i < activity.length - 1 && <span className="absolute top-9 bottom-0 left-[17px] w-px bg-slate-200" aria-hidden />}
                      <span className={`relative flex size-9 shrink-0 items-center justify-center rounded-full ${actTone[a.icon]}`}>
                        <I className="size-4" />
                      </span>
                      <Link href={a.href} className="min-w-0 flex-1 rounded-lg hover:bg-slate-50">
                        <p className="text-sm font-medium text-slate-900">{a.title}</p>
                        <p className="truncate text-xs text-slate-500">{a.detail}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400" title={formatDateTime(a.at)}>
                          {relativeTime(a.at)}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* Eligibility */}
          <Card>
            <CardHeader
              icon={<Award className="size-5" />}
              title={t("dash.eligibilityTitle")}
              description={p.eligibility.eligible ? t("dash.eligibleDesc") : t("dash.notEligibleDesc")}
            />
            <ul className="divide-y divide-slate-100">
              {p.eligibility.checks.map((c) => (
                <li key={c.key} className="flex items-start gap-3 px-5 py-3">
                  {c.met ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" /> : <CircleDashed className="mt-0.5 size-5 shrink-0 text-slate-300" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{eligLabel(c)}</p>
                    <p className="text-xs text-slate-500">{eligDetail(c)}</p>
                  </div>
                  <Badge tone={c.met ? "green" : "gray"}>{c.met ? t("dash.met") : t("dash.pending")}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          {/* Mentor */}
          <Card>
            <CardHeader icon={<UserRound className="size-5" />} title={t("dash.mentor")} />
            <CardBody>
              {student.mentor ? (
                <div className="flex items-start gap-3">
                  <Avatar name={student.mentor.name} src={student.mentor.photoUrl} size={48} />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{student.mentor.name}</p>
                    <p className="text-xs text-slate-500">{student.mentor.designation ?? t("dash.mentorRole", { domain: student.domain?.name ?? "" })}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      {student.mentor.email && (
                        <a href={`mailto:${student.mentor.email}`} className="flex items-center gap-2 text-brand-600 hover:underline">
                          <Mail className="size-4" /> <span className="truncate">{student.mentor.email}</span>
                        </a>
                      )}
                      {student.mentor.mobile && (
                        <a href={`tel:${student.mentor.mobile}`} className="flex items-center gap-2 text-slate-700 hover:text-brand-600">
                          <Phone className="size-4" /> {student.mentor.mobile}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">{t("dash.noMentor")}</p>
              )}
            </CardBody>
          </Card>

          {/* Announcements */}
          <Card>
            <CardHeader icon={<Megaphone className="size-5" />} title={t("dash.announcements")} />
            {announcements.length === 0 ? (
              <EmptyState icon={<Megaphone />} title={t("dash.noAnnouncements")} className="py-8" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {announcements.map((n) => (
                  <li key={n.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" aria-label={t("dash.unread")} />}
                    </div>
                    <p className="mt-0.5 text-sm whitespace-pre-line text-slate-600">{n.body}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function SummaryCard({ href, icon, title, value, sub, children }: { href: string; icon: React.ReactNode; title: string; value: string; sub: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="group block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition hover:border-brand-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>
          <p className="text-sm font-semibold text-slate-700">{title}</p>
        </div>
        <ArrowRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
      </div>
      <p className="mt-3 font-display text-xl font-bold text-slate-900">{value}</p>
      <p className="mb-3 truncate text-xs text-slate-500">{sub}</p>
      {children}
    </Link>
  );
}
