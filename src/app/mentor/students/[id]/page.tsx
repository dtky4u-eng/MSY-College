import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CalendarCheck, CheckCircle2, Circle, Eye, FileCheck2, FileText, Lock, NotebookPen, TrendingUp, UserRound } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireMentor } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { learningTree, studentProgress, ACCESS_STATE_LABEL } from "@/lib/student";
import { documentAvailability } from "@/lib/pdf/documents";
import { DOCUMENT_LABEL, DOCUMENT_TYPES, SUBMISSION_STATUS_LABEL, type SubmissionStatus } from "@/lib/constants";
import { formatDate, formatTime, toISTDateString } from "@/lib/format";
import { PageHeader, DetailList, Alert } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { ButtonLink } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { AttendanceCalendar } from "@/components/mentor/attendance-calendar";
import { LeaveManager } from "./leave-manager";

export const metadata = { title: "Student Details" };

const KIND_LABEL: Record<string, string> = { ASSIGNMENT: "Assignment", PROJECT: "Live project", REPORT: "Internship report" };

export default async function MentorStudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { mentor } = await requireMentor();
  const s = await prisma.student.findFirst({ where: { id, mentorId: mentor.id }, include: { college: { select: { name: true } }, domain: true } });
  if (!s) notFound();

  const [progress, tree, attendance, logbook, submissions, docs] = await Promise.all([
    studentProgress(s.id),
    learningTree(s.id, s.domainId),
    prisma.attendance.findMany({ where: { studentId: s.id }, orderBy: { date: "desc" } }),
    prisma.logbookEntry.findMany({ where: { studentId: s.id }, orderBy: { date: "desc" }, take: 60 }),
    prisma.submission.findMany({ where: { studentId: s.id }, orderBy: { submittedAt: "desc" }, include: { assignment: { select: { title: true, maxMarks: true } } } }),
    documentAvailability(s.id),
  ]);
  const today = toISTDateString();
  const start = s.internshipStart ? toISTDateString(s.internshipStart) : null;
  const end = s.internshipEnd ? toISTDateString(s.internshipEnd) : null;
  const leaves = attendance
    .filter((a) => a.status === "LEAVE")
    .map((a) => ({ date: a.date, remarks: a.remarks, byMentor: Boolean(a.markedById), revocable: Boolean(a.markedById) && !a.checkIn }));

  return (
    <>
      <PageHeader title={s.name} description={`${s.college.name} · ${s.portalRegNo ?? s.registrationNumber}`} back={{ href: "/mentor/students", label: "Assigned students" }} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody className="flex flex-wrap items-center gap-5">
            <Avatar name={s.name} src={fileUrl(s.photoFileId)} size={72} />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold text-slate-900">{s.name}</p>
              <p className="text-sm text-slate-500">{[s.programme, s.majorSubject, s.semester && `Semester ${s.semester}`].filter(Boolean).join(" · ") || "—"}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusBadge status={s.status} />
                <Badge tone="brand">{ACCESS_STATE_LABEL[progress.accessState]}</Badge>
                {s.resultStatus && <StatusBadge status={s.resultStatus} />}
              </div>
            </div>
            <ProgressRing value={progress.overallPercent} sub="overall" />
          </CardBody>
          <CardBody className="border-t border-slate-100">
            <DetailList
              cols={3}
              items={[
                ["Email", s.email],
                ["Mobile", s.mobile],
                ["Session", s.session],
                ["Internship start", formatDate(s.internshipStart)],
                ["Internship end", formatDate(s.internshipEnd)],
                ["Assigned on", formatDate(s.mentorAssignedAt)],
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Progress summary" icon={<TrendingUp className="size-5" />} />
          <CardBody className="space-y-4">
            <Meter label="Learning" value={progress.learning.percent} detail={`${progress.learning.completed}/${progress.learning.total} chapters`} />
            <Meter label="Hours logged" value={Math.min(100, (progress.loggedHours / Math.max(1, progress.durationHours)) * 100)} detail={`${progress.loggedHours}/${progress.durationHours}h`} />
            <Meter label="Attendance" value={progress.attendance.percent} detail={`${progress.attendance.percent}%`} />
            <Meter label="Quiz average" value={progress.quizzes.average} detail={`${progress.quizzes.passed}/${progress.quizzes.total} passed`} />
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Assessment</span>
              {progress.assessment.submitted ? <Badge tone="green">Submitted · {progress.assessment.score}%</Badge> : <Badge tone="amber">Pending</Badge>}
            </div>
            <ButtonLink href={`/mentor/assessments/${s.id}`} variant="secondary" size="sm" className="w-full">
              {progress.assessment.submitted ? "View assessment" : "Assess student"}
            </ButtonLink>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Learning progress" icon={<BookOpen className="size-5" />} description={`${tree.completed} of ${tree.total} chapters completed`} />
        {tree.modules.length === 0 ? (
          <CardBody><p className="text-sm text-slate-500">No learning modules have been set up for this domain yet.</p></CardBody>
        ) : (
          <div className="divide-y divide-slate-100">
            {tree.modules.map((m) => (
              <details key={m.id} className="group" open={m.unlocked && m.completed < m.chapters.length}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                  <span className="text-sm font-semibold text-slate-800">Module {m.number}: {m.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{m.completed}/{m.chapters.length}</span>
                    <ProgressBar value={m.chapters.length ? (m.completed / m.chapters.length) * 100 : 0} size="sm" className="w-24" />
                  </span>
                </summary>
                <ul className="pb-2">
                  {m.chapters.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2 pl-9 text-sm">
                      <span className="flex items-center gap-2 text-slate-700">
                        {c.completed ? <CheckCircle2 className="size-4 text-emerald-500" /> : c.unlocked ? <Circle className="size-4 text-brand-400" /> : <Lock className="size-4 text-slate-300" />}
                        {m.number}.{c.number} {c.name}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {c.quiz && (
                          <Badge tone={c.quiz.passed ? "green" : c.quiz.attemptsRemaining === 0 && c.quiz.attemptsUsed > 0 ? "red" : "gray"}>
                            Quiz {c.quiz.bestPercent !== null ? `${c.quiz.bestPercent}%` : "not attempted"} · {c.quiz.attemptsUsed}/{c.quiz.attemptsAllowed + c.quiz.extraAttempts} attempts
                          </Badge>
                        )}
                        {c.completedVia && <span>via {c.completedVia.toLowerCase()}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Attendance" icon={<CalendarCheck className="size-5" />} description={`${progress.attendance.percent}% · ${progress.attendance.present} present, ${progress.attendance.halfDay} half day, ${progress.attendance.absent} absent, ${progress.attendance.leave} leave`} />
          <CardBody>
            {start && end ? <AttendanceCalendar start={start} end={end} today={today} rows={attendance.map((a) => ({ date: a.date, status: a.status, remarks: a.remarks }))} /> : <p className="text-sm text-slate-500">The internship has not been scheduled yet.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Approved leave" description="Approve leave for a date in the internship window" />
          <CardBody>
            {start ? (
              <LeaveManager studentId={s.id} min={start} max={end ?? undefined} locked={s.status === "COMPLETED" || s.status === "BLOCKED"} leaves={leaves} />
            ) : (
              <p className="text-sm text-slate-500">Leave can be approved once the internship start date is set.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent attendance" description="Latest marked days with check-in and check-out" icon={<CalendarCheck className="size-5" />} />
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Status</TH>
                <TH>Check in</TH>
                <TH>Check out</TH>
                <TH>Remarks</TH>
              </tr>
            </THead>
            <TBody>
              {attendance.length === 0 && <EmptyRow colSpan={5}>No attendance recorded yet</EmptyRow>}
              {attendance.slice(0, 60).map((a) => (
                <TR key={a.id}>
                  <TD className="whitespace-nowrap">{formatDate(a.date)}</TD>
                  <TD><StatusBadge status={a.status} /></TD>
                  <TD className="text-slate-500">{a.checkIn ? formatTime(a.checkIn) : "—"}</TD>
                  <TD className="text-slate-500">{a.checkOut ? formatTime(a.checkOut) : "—"}</TD>
                  <TD className="text-slate-500">{a.remarks ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Logbook" icon={<NotebookPen className="size-5" />} description={`${progress.logbook.entries} entries · ${progress.logbook.hours}h`} />
          <div className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
            {logbook.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">No logbook entries yet</p>}
            {logbook.map((l) => (
              <div key={l.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-900">{formatDate(l.date)}</span>
                  <Badge tone="brand">{l.hours}h</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{l.activity}</p>
                {l.skills && <p className="mt-0.5 text-xs text-slate-500">Skills: {l.skills}</p>}
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Submissions" icon={<FileCheck2 className="size-5" />} />
            <ul className="divide-y divide-slate-100">
              {submissions.length === 0 && <li className="px-5 py-10 text-center text-sm text-slate-500">No submissions yet</li>}
              {submissions.map((sub) => (
                <li key={sub.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{sub.assignment?.title ?? sub.title ?? KIND_LABEL[sub.kind]}</p>
                    <p className="text-xs text-slate-500">
                      {KIND_LABEL[sub.kind]} · {formatDate(sub.submittedAt)}
                      {sub.marks !== null && sub.assignment && ` · ${sub.marks}/${sub.assignment.maxMarks}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={sub.status} label={SUBMISSION_STATUS_LABEL[sub.status as SubmissionStatus]} />
                    <Link href={`/mentor/reviews/${sub.id}`} className="text-xs font-medium text-brand-600 hover:text-brand-700">{sub.status === "PENDING" ? "Review" : "Open"}</Link>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Documents" icon={<FileText className="size-5" />} />
            <ul className="divide-y divide-slate-100">
              {DOCUMENT_TYPES.map((t) => (
                <li key={t} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                  <span className="text-slate-700">{DOCUMENT_LABEL[t]}</span>
                  {docs[t].available ? (
                    <ButtonLink external href={`/api/documents/${s.id}/${t.toLowerCase()}?inline=1`} target="_blank" rel="noopener" size="xs" variant="outline" icon={<Eye className="size-3.5" />}>
                      View
                    </ButtonLink>
                  ) : (
                    <span className="text-xs text-slate-400" title={docs[t].reason}>Not available</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {s.status === "BLOCKED" && (
        <Alert tone="error" className="mt-6" icon={<UserRound />} title="Internship blocked">
          {s.blockedReason ?? "This student's internship is blocked."}
        </Alert>
      )}
    </>
  );
}

function Meter({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="text-xs text-slate-500">{detail}</span>
      </div>
      <ProgressBar value={value} size="sm" />
    </div>
  );
}
