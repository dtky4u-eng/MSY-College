import Link from "next/link";
import { BookOpenCheck, CheckCircle2, ClipboardList, FileCheck2, GraduationCap, RotateCcw, TrendingUp, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireMentor } from "@/lib/auth";
import { learningPercentMany } from "@/lib/student";
import { formatDate, relativeTime } from "@/lib/format";
import { SUBMISSION_KIND } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { Card, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { exhaustedQuizzes } from "./_lib/scope";

export const metadata = { title: "Mentor Dashboard" };

const KIND_LABEL: Record<string, string> = { ASSIGNMENT: "Assignment", PROJECT: "Live project", REPORT: "Internship report" };

export default async function MentorDashboard() {
  const { mentor } = await requireMentor();
  const mine = { mentorId: mentor.id };

  const [assigned, active, completed, pendingReviews, pendingAssessments, students, recent, oldestPending, exhausted] = await Promise.all([
    prisma.student.count({ where: mine }),
    prisma.student.count({ where: { ...mine, status: "ACTIVE" } }),
    prisma.student.count({ where: { ...mine, status: "COMPLETED" } }),
    prisma.submission.count({ where: { status: "PENDING", kind: { in: [...SUBMISSION_KIND] }, student: mine } }),
    prisma.student.count({ where: { ...mine, status: { in: ["ACTIVE", "COMPLETED"] }, assessment: { is: null } } }),
    prisma.student.findMany({ where: { ...mine, status: { not: "BLOCKED" } }, select: { id: true, domainId: true } }),
    prisma.student.findMany({
      where: mine,
      orderBy: [{ mentorAssignedAt: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: { college: { select: { name: true } } },
    }),
    prisma.submission.findMany({
      where: { status: "PENDING", student: mine },
      orderBy: { submittedAt: "asc" },
      take: 5,
      include: { student: { select: { name: true } }, assignment: { select: { title: true } } },
    }),
    exhaustedQuizzes(mentor),
  ]);

  const progress = await learningPercentMany([...students, ...recent.map((r) => ({ id: r.id, domainId: r.domainId }))]);
  const avg = students.length ? Math.round((students.reduce((a, s) => a + (progress.get(s.id) ?? 0), 0) / students.length) * 10) / 10 : 0;

  return (
    <>
      <PageHeader
        title={`Welcome, ${mentor.name}`}
        description={`${mentor.domain.name} mentor · review work, assess students and manage your domain's learning content.`}
        actions={<ButtonLink href="/mentor/reviews" icon={<FileCheck2 className="size-4" />}>Review submissions</ButtonLink>}
      />

      <StatGrid>
        <StatCard label="Assigned students" value={assigned} icon={<Users />} href="/mentor/students" />
        <StatCard label="Active internships" value={active} icon={<GraduationCap />} tone="green" href="/mentor/students?status=ACTIVE" />
        <StatCard label="Completed" value={completed} icon={<CheckCircle2 />} tone="violet" href="/mentor/students?status=COMPLETED" />
        <StatCard label="Average progress" value={`${avg}%`} icon={<TrendingUp />} tone="teal" hint="Learning progress of your students" />
      </StatGrid>
      <StatGrid className="mt-3 sm:mt-4 lg:grid-cols-3">
        <StatCard label="Pending reviews" value={pendingReviews} icon={<ClipboardList />} tone="amber" hint="Assignments, projects and reports" href="/mentor/reviews" />
        <StatCard label="Pending assessments" value={pendingAssessments} icon={<BookOpenCheck />} tone="blue" hint="Active or completed without assessment" href="/mentor/assessments?filter=pending" />
        <StatCard label="Quiz attempts exhausted" value={exhausted.length} icon={<RotateCcw />} tone="red" hint="Need a reattempt grant" href="/mentor/quiz-reattempts" />
      </StatGrid>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Oldest pending reviews" description="Submissions waiting the longest" actions={<ButtonLink href="/mentor/reviews" size="sm" variant="outline">Open queue</ButtonLink>} />
          {oldestPending.length === 0 ? (
            <EmptyState icon={<CheckCircle2 />} title="All caught up" description="There are no submissions waiting for your review." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {oldestPending.map((s) => (
                <li key={s.id}>
                  <Link href={`/mentor/reviews/${s.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{s.assignment?.title ?? s.title ?? KIND_LABEL[s.kind]}</p>
                      <p className="text-xs text-slate-500">{s.student.name} · {KIND_LABEL[s.kind] ?? s.kind}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">{relativeTime(s.submittedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Quiz attempts exhausted" description="Students who used every attempt without passing" actions={<ButtonLink href="/mentor/quiz-reattempts" size="sm" variant="outline">Grant reattempts</ButtonLink>} />
          {exhausted.length === 0 ? (
            <EmptyState icon={<RotateCcw />} title="No blocked quizzes" description="No assigned student is currently stuck on a quiz." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {exhausted.slice(0, 5).map((e) => (
                <li key={`${e.student.id}-${e.quiz.id}`} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{e.student.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      M{e.chapter.moduleNumber}.{e.chapter.number} {e.chapter.name} · best {e.info.bestPercent ?? 0}% (pass {e.info.passingScore}%)
                    </p>
                  </div>
                  <ButtonLink href={`/mentor/quiz-reattempts?student=${e.student.id}`} size="xs" variant="secondary">Grant</ButtonLink>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recently assigned students" actions={<ButtonLink href="/mentor/students" size="sm" variant="outline">View all</ButtonLink>} />
        <Table>
          <THead>
            <tr>
              <TH>Student</TH>
              <TH>College</TH>
              <TH>Assigned</TH>
              <TH>Progress</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <TBody>
            {recent.length === 0 && <EmptyRow colSpan={5}>No students have been assigned to you yet.</EmptyRow>}
            {recent.map((s) => (
              <TR key={s.id}>
                <TD>
                  <Link href={`/mentor/students/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700">{s.name}</Link>
                  <div className="text-xs text-slate-500">{s.portalRegNo ?? s.registrationNumber}</div>
                </TD>
                <TD className="text-slate-600">{s.college.name}</TD>
                <TD className="whitespace-nowrap text-slate-500">{formatDate(s.mentorAssignedAt)}</TD>
                <TD className="min-w-36"><ProgressBar value={progress.get(s.id) ?? 0} size="sm" showLabel /></TD>
                <TD>
                  <StatusBadge status={s.status} />
                  {s.resultStatus && <Badge className="ml-1" tone={s.resultStatus === "PASS" ? "green" : "red"}>{s.resultStatus === "PASS" ? "Passed" : "Failed"}</Badge>}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
