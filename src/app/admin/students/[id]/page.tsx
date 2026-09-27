import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  AlertOctagon,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Eye,
  FileText,
  GraduationCap,
  IdCard,
  KeyRound,
  Receipt,
  ShieldCheck,
  Sparkles,
  UserCog,
  UserRound,
  XCircle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { parseJson } from "@/lib/json";
import { ACCESS_STATE_LABEL, studentProgress } from "@/lib/student";
import { documentAvailability } from "@/lib/pdf/documents";
import { getInternshipSettings } from "@/lib/settings";
import { DOCUMENT_LABEL, DOCUMENT_TYPES, GENDERS, SUBMISSION_STATUS_LABEL, type SubmissionStatus } from "@/lib/constants";
import { formatDate, formatDateTime, formatINR, relativeTime, toISTDateString } from "@/lib/format";
import { PageHeader, DetailList, Alert, EmptyState } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { ButtonLink } from "@/components/ui/button";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { loadMasterOptions, withCurrent, REG_STEP_LABEL } from "@/components/admin/core/students/server";
import { EditDetailsButton } from "@/components/admin/core/students/details-form";
import { PhotoManager } from "@/components/admin/core/students/photo-manager";
import { StatusManager } from "@/components/admin/core/students/status-manager";
import { DatesManager } from "@/components/admin/core/students/dates-manager";
import { MentorManager } from "@/components/admin/core/students/mentor-manager";
import { PasswordManager } from "@/components/admin/core/students/password-manager";
import { RegistrationManager } from "@/components/admin/core/students/registration-manager";

export const metadata = { title: "Student Details" };

const AUDIT_LABEL: Record<string, string> = {
  STUDENT_UPDATE: "Details updated",
  STUDENT_STATUS: "Status changed",
  STUDENT_CREATE: "Student created",
  PASSWORD_CHANGE: "Password changed",
  PASSWORD_RESET: "Password reset",
  INTERNSHIP_START: "Internship scheduled",
  MENTOR_ASSIGN: "Mentor assignment",
  PAYMENT_MARK_PAID: "Payment marked paid",
  PAYMENT_EDIT: "Payment edited",
  QUIZ_REATTEMPT: "Quiz reattempt granted",
  RESULT_PUBLISH: "Result published",
  ATTENDANCE_MARK: "Attendance marked",
};

function auditSummary(action: string, raw: string): string {
  const d = parseJson<Record<string, unknown>>(raw, {});
  if (action === "STUDENT_STATUS") return `${d.from ?? "—"} → ${d.to ?? "—"}${d.reason ? ` · ${String(d.reason)}` : ""}`;
  if (action === "INTERNSHIP_START") return `${d.startDate ? formatDate(String(d.startDate)) : "—"} to ${d.endDate ? formatDate(String(d.endDate)) : "—"}${d.bulk ? " (bulk)" : ""}`;
  if (action === "MENTOR_ASSIGN") return d.to ? `Assigned ${d.mentorName ?? "mentor"}${d.auto ? " automatically" : ""}` : "Mentor unassigned";
  if (d.action === "UNLOCK_REGISTRATION") return `Registration unlocked · ${String(d.reason ?? "")}`;
  if (d.action === "LOCK_REGISTRATION") return `Registration locked · ${String(d.reason ?? "")}`;
  if (d.changes && typeof d.changes === "object") {
    const keys = Object.keys(d.changes as object);
    return keys.length ? `Changed: ${keys.join(", ")}` : "No changes";
  }
  if (d.reason) return String(d.reason);
  return "";
}

export default async function AdminStudentDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole("ADMIN");
  const { id } = await params;
  const s = await prisma.student.findUnique({
    where: { id },
    include: {
      college: { select: { id: true, name: true, code: true, university: true } },
      domain: { select: { id: true, name: true, code: true, durationHours: true } },
      mentor: { select: { id: true, name: true, employeeId: true, email: true, mobile: true, active: true } },
      user: { select: { id: true, username: true, email: true, active: true, lastLoginAt: true, createdAt: true } },
      certificate: { select: { certificateNo: true, verifyCode: true, issuedAt: true, revokedAt: true } },
      payments: {
        orderBy: { createdAt: "desc" },
        select: { id: true, transactionId: true, gateway: true, amount: true, status: true, paidAt: true, createdAt: true, receiptNo: true, method: true },
      },
    },
  });
  if (!s) notFound();

  const [progress, docs, master, domains, mentors, settings, activity] = await Promise.all([
    studentProgress(s.id),
    documentAvailability(s.id),
    loadMasterOptions(),
    prisma.domain.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true, active: true } }),
    prisma.mentor.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, employeeId: true, domainId: true, active: true, _count: { select: { students: true } } },
    }),
    getInternshipSettings(),
    prisma.auditLog.findMany({
      where: { OR: [{ entity: "Student", entityId: s.id }, ...(s.userId ? [{ entity: "User", entityId: s.userId }] : [])] },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { actor: { select: { username: true, role: true } } },
    }),
  ]);

  const paid = s.paymentStatus === "PAID";
  const gender = GENDERS.find((g) => g.value === s.gender)?.label;
  const start = s.internshipStart ? toISTDateString(s.internshipStart) : null;
  const end = s.internshipEnd ? toISTDateString(s.internshipEnd) : null;
  const detailsInitial = {
    name: s.name,
    fatherName: s.fatherName ?? "",
    rollNumber: s.rollNumber ?? "",
    gender: s.gender ?? "",
    dob: s.dob ? toISTDateString(s.dob) : "",
    programme: s.programme ?? "",
    majorSubject: s.majorSubject ?? "",
    session: s.session ?? "",
    semester: s.semester ?? "",
    mobile: s.mobile ?? "",
    email: s.email ?? "",
  };
  const state = progress.accessState;
  const regComplete = s.nextStep >= 7;
  const docBase = `/api/documents/${s.id}`;
  const statTone = (v: number) => (v >= 75 ? "green" : v >= 40 ? "amber" : "red") as "green" | "amber" | "red";

  return (
    <>
      <PageHeader
        title={s.name}
        description={
          <>
            {s.college.name} · <span className="font-mono">{s.registrationNumber}</span>
            {s.portalRegNo ? (
              <>
                {" "}
                · <span className="font-mono text-brand-700">{s.portalRegNo}</span>
              </>
            ) : null}
          </>
        }
        back={{ href: "/admin/students", label: "Students" }}
        actions={
          <EditDetailsButton
            studentId={s.id}
            initial={detailsInitial}
            options={{
              programmes: withCurrent(master.PROGRAMME, s.programme),
              sessions: withCurrent(master.SESSION, s.session),
              semesters: withCurrent(master.SEMESTER, s.semester),
            }}
          />
        }
      />

      {s.status === "BLOCKED" && (
        <Alert tone="error" icon={<AlertOctagon />} title="This student is blocked" className="mb-6">
          {s.blockedReason || "No reason was recorded."}
        </Alert>
      )}

      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center gap-5">
          <PhotoManager studentId={s.id} name={s.name} photoUrl={fileUrl(s.photoFileId)} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-slate-900">{s.name}</p>
            <p className="text-sm text-slate-500">
              {[s.programme, s.majorSubject].filter(Boolean).join(" · ") || "Programme not provided"}
              {s.semester ? ` · Semester ${s.semester}` : ""}
              {s.session ? ` · Session ${s.session}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge status={s.status} />
              {state !== s.status && <StatusBadge status={state} label={ACCESS_STATE_LABEL[state]} />}
              <StatusBadge status={s.paymentStatus} />
              {s.domain && <Badge tone="brand">{s.domain.name}</Badge>}
              {s.resultStatus && <StatusBadge status={s.resultStatus} label={`Result: ${s.resultStatus === "PASS" ? "Pass" : "Fail"}${s.grade ? ` (${s.grade})` : ""}`} />}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Ident label="Student code" value={s.studentCode} />
            <Ident label="Registration no." value={s.registrationNumber} />
            <Ident label="Portal reg. no." value={s.portalRegNo} />
            <Ident label="Roll no." value={s.rollNumber} />
          </dl>
        </CardBody>
      </Card>

      <StatGrid className="mb-6">
        <StatCard label="Overall progress" value={`${progress.overallPercent}%`} icon={<Sparkles />} hint={progress.eligibility.eligible ? "Eligible for certificate" : "Not yet eligible"} />
        <StatCard label="Learning" value={`${progress.learning.percent}%`} icon={<BookOpen />} tone="violet" hint={`${progress.learning.completed}/${progress.learning.total} chapters`} />
        <StatCard
          label="Attendance"
          value={`${progress.attendance.percent}%`}
          icon={<CalendarCheck />}
          tone={s.internshipStart ? statTone(progress.attendance.percent) : "gray"}
          hint={s.internshipStart ? `${progress.attendance.present} present · ${progress.attendance.absent} absent` : "Internship not started"}
        />
        <StatCard label="Logbook hours" value={`${progress.loggedHours}h`} icon={<Clock />} tone="teal" hint={`of ${progress.durationHours}h · ${progress.logbook.entries} entries`} />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Profile" description="Personal and academic details" icon={<UserRound className="size-5" />} />
            <CardBody>
              <DetailList
                cols={3}
                items={[
                  ["Full name", s.name],
                  ["Father's name", s.fatherName],
                  ["Gender", gender],
                  ["Date of birth", s.dob ? formatDate(s.dob) : null],
                  ["Mobile", s.mobile],
                  ["Email", s.email],
                  ["Programme", s.programme],
                  ["Major subject", s.majorSubject],
                  ["Session / Semester", `${s.session ?? "—"} / ${s.semester ? `Sem ${s.semester}` : "—"}`],
                  ["College", <Link key="c" href={`/admin/students?college=${s.college.id}`} className="text-brand-700 hover:underline">{`${s.college.name} (${s.college.code})`}</Link>],
                  ["University", s.college.university],
                  ["Fee captured", s.feeAmount != null ? formatINR(s.feeAmount) : null],
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Progress and eligibility" description="Learning, submissions and certificate criteria" icon={<ClipboardList className="size-5" />} />
            <CardBody className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Metric label="Course completion" value={`${progress.learning.completed}/${progress.learning.total} chapters`} percent={progress.learning.percent} />
                <Metric label="Internship hours" value={`${progress.loggedHours}h of ${progress.durationHours}h`} percent={Math.min(100, progress.durationHours ? (progress.loggedHours / progress.durationHours) * 100 : 0)} />
                <Metric
                  label="Quizzes"
                  value={progress.quizzes.total ? `${progress.quizzes.passed}/${progress.quizzes.total} passed · avg ${progress.quizzes.average}%` : "No quizzes in this domain"}
                  percent={progress.quizzes.total ? progress.quizzes.average : 0}
                />
                <Metric label="Attendance" value={`${progress.attendance.present} present · ${progress.attendance.halfDay} half · ${progress.attendance.leave} leave`} percent={progress.attendance.percent} />
              </div>
              <DetailList
                cols={3}
                items={[
                  ["Assignments", `${progress.assignments.submitted}/${progress.assignments.total} submitted · ${progress.assignments.approved} approved${progress.assignments.pending ? ` · ${progress.assignments.pending} pending` : ""}`],
                  ["Live project", progress.project.status ? `${progress.project.title ?? "Untitled"} — ${SUBMISSION_STATUS_LABEL[progress.project.status as SubmissionStatus] ?? progress.project.status}` : "Not submitted"],
                  ["Internship report", progress.report.status ? SUBMISSION_STATUS_LABEL[progress.report.status as SubmissionStatus] ?? progress.report.status : "Not submitted"],
                  ["Mentor assessment", progress.assessment.submitted ? `${progress.assessment.score}% · ${progress.assessment.recommend ? "recommended" : "not recommended"}` : "Pending"],
                  ["Active learning time", `${progress.learningHours}h`],
                  ["Quizzes out of attempts", progress.quizzes.exhausted ? String(progress.quizzes.exhausted) : "None"],
                ]}
              />
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  Certificate eligibility
                  <StatusBadge status={progress.eligibility.eligible ? "APPROVED" : "PENDING"} label={progress.eligibility.eligible ? "Eligible" : "Not yet eligible"} />
                </p>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {progress.eligibility.checks.map((c) => (
                    <li key={c.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="flex items-center gap-2 text-slate-700">
                        {c.met ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-label="Met" /> : <XCircle className="size-4 shrink-0 text-rose-500" aria-label="Not met" />}
                        {c.label}
                      </span>
                      <span className="text-right text-slate-500 tabular-nums">{c.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payments" description="All payment attempts for this student" icon={<Receipt className="size-5" />} />
            {s.payments.length === 0 ? (
              <EmptyState icon={<Receipt />} title="No payments yet" description="Payment attempts appear here once the student reaches the payment step." className="py-10" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Transaction</TH>
                    <TH>Gateway</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Status</TH>
                    <TH>Paid on</TH>
                    <TH>Receipt</TH>
                  </tr>
                </THead>
                <TBody>
                  {s.payments.map((p) => (
                    <TR key={p.id}>
                      <TD>
                        <p className="font-mono text-xs text-slate-800">{p.transactionId}</p>
                        <p className="text-xs text-slate-500">Created {formatDateTime(p.createdAt)}</p>
                      </TD>
                      <TD className="whitespace-nowrap">
                        {p.gateway}
                        {p.method ? <span className="text-xs text-slate-500"> · {p.method}</span> : null}
                      </TD>
                      <TD className="text-right font-medium tabular-nums">{formatINR(p.amount)}</TD>
                      <TD>
                        <StatusBadge status={p.status} />
                      </TD>
                      <TD className="whitespace-nowrap">{p.paidAt ? formatDateTime(p.paidAt) : "—"}</TD>
                      <TD className="whitespace-nowrap">
                        {p.status === "SUCCESS" ? (
                          <a href={`/api/payments/${p.id}/receipt`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                            <Download className="size-3.5" />
                            {p.receiptNo ?? "Receipt"}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title="Documents" description="Rendered on demand from the live record. Admins can generate a document before it is normally available." icon={<FileText className="size-5" />} />
            <ul className="divide-y divide-slate-100">
              {DOCUMENT_TYPES.map((t) => {
                const av = docs[t];
                const slug = t.toLowerCase();
                return (
                  <li key={t} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{DOCUMENT_LABEL[t]}</p>
                      <p className="text-xs text-slate-500">{av.available ? "Available" : av.reason}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {av.available ? (
                        <>
                          <ButtonLink href={`${docBase}/${slug}?inline=1`} external target="_blank" rel="noopener" variant="ghost" size="xs" icon={<Eye className="size-3.5" />}>
                            View
                          </ButtonLink>
                          <ButtonLink href={`${docBase}/${slug}`} external variant="outline" size="xs" icon={<Download className="size-3.5" />}>
                            Download
                          </ButtonLink>
                        </>
                      ) : (
                        <ButtonLink href={`${docBase}/${slug}?inline=1&force=1`} external target="_blank" rel="noopener" variant="ghost" size="xs" icon={<Sparkles className="size-3.5" />}>
                          Generate anyway
                        </ButtonLink>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Recent activity" description="Audit trail for this student" icon={<Activity className="size-5" />} />
            {activity.length === 0 ? (
              <EmptyState icon={<Activity />} title="No recorded activity" description="Admin and college actions on this student will appear here." className="py-10" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {activity.map((a) => {
                  const summary = auditSummary(a.action, a.details);
                  return (
                    <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{AUDIT_LABEL[a.action] ?? a.action.replace(/_/g, " ").toLowerCase()}</p>
                        {summary && <p className="mt-0.5 break-words text-slate-500">{summary}</p>}
                      </div>
                      <p className="shrink-0 text-xs text-slate-500" title={formatDateTime(a.createdAt)}>
                        {a.actor ? `@${a.actor.username}` : "System"} · {relativeTime(a.createdAt)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Internship" icon={<CalendarDays className="size-5" />} />
            <CardBody className="space-y-4">
              <DetailList
                cols={1}
                items={[
                  [
                    "Status",
                    <span key="st" className="flex flex-wrap gap-1.5">
                      <StatusBadge status={s.status} />
                      <span className="text-xs text-slate-500">Student sees: {ACCESS_STATE_LABEL[state]}</span>
                    </span>,
                  ],
                  ["Start date", start ? formatDate(start) : "Not set"],
                  ["End date", end ? formatDate(end) : "Not set"],
                  ...(s.completedAt ? ([["Completed on", formatDate(s.completedAt)]] as [string, string][]) : []),
                  ...(s.certificate
                    ? ([["Certificate", `${s.certificate.certificateNo}${s.certificate.revokedAt ? " (revoked)" : ""}`]] as [string, string][])
                    : []),
                ]}
              />
              {!paid && <p className="text-xs text-slate-500">Internship dates can be set after the fee is paid.</p>}
              <div className="flex flex-wrap gap-2">
                <StatusManager studentId={s.id} status={s.status} blockedReason={s.blockedReason} paid={paid} hasAccount={Boolean(s.userId)} />
                <DatesManager studentId={s.id} start={start} end={end} paid={paid} status={s.status} defaultWeeks={settings.defaultWeeks} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Domain and mentor" icon={<UserCog className="size-5" />} />
            <CardBody className="space-y-4">
              <DetailList
                cols={1}
                items={[
                  ["Domain", s.domain ? `${s.domain.name} (${s.domain.code})` : "Not selected"],
                  [
                    "Mentor",
                    s.mentor ? (
                      <span key="m">
                        {s.mentor.name} <span className="text-slate-500">({s.mentor.employeeId})</span>
                        {!s.mentor.active && <Badge tone="gray" className="ml-1.5">Inactive</Badge>}
                        {(s.mentor.email || s.mentor.mobile) && <span className="block text-xs text-slate-500">{[s.mentor.email, s.mentor.mobile].filter(Boolean).join(" · ")}</span>}
                      </span>
                    ) : (
                      "Not assigned"
                    ),
                  ],
                  ["Assigned on", s.mentorAssignedAt ? formatDate(s.mentorAssignedAt) : "—"],
                ]}
              />
              <MentorManager
                studentId={s.id}
                domainId={s.domainId}
                mentorId={s.mentorId}
                paid={paid}
                feeLabel={s.feeAmount != null ? formatINR(s.feeAmount) : null}
                domains={domains}
                mentors={mentors.map((m) => ({ id: m.id, name: m.name, employeeId: m.employeeId, domainId: m.domainId, active: m.active, students: m._count.students }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Registration" icon={<IdCard className="size-5" />} />
            <CardBody className="space-y-4">
              <DetailList
                cols={1}
                items={[
                  ["Progress", regComplete ? "Registration complete" : `Step ${s.nextStep} of 6 · next: ${REG_STEP_LABEL[s.nextStep] ?? "In progress"}`],
                  [
                    "Details",
                    s.registrationLocked ? (
                      <span key="l" className="inline-flex items-center gap-1.5">
                        <Badge tone="gray">Locked</Badge>
                        {s.lockedAt && <span className="text-xs text-slate-500">since {formatDateTime(s.lockedAt)}</span>}
                      </span>
                    ) : (
                      <Badge key="u" tone="amber">
                        Editable by student
                      </Badge>
                    ),
                  ],
                  ["Registered on", s.registeredAt ? formatDateTime(s.registeredAt) : "—"],
                  [
                    "Admit card",
                    s.admitCardFileId ? (
                      <a key="a" href={fileUrl(s.admitCardFileId)!} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                        <Eye className="size-3.5" /> View admit card
                      </a>
                    ) : (
                      "Not uploaded"
                    ),
                  ],
                ]}
              />
              <RegistrationManager studentId={s.id} locked={s.registrationLocked} paid={paid} canLock={paid || s.nextStep >= 6} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Login account" icon={<KeyRound className="size-5" />} />
            <CardBody className="space-y-4">
              {s.user ? (
                <>
                  <DetailList
                    cols={1}
                    items={[
                      ["Username", <span key="u" className="font-mono">@{s.user.username}</span>],
                      ["Account", s.user.active ? <Badge key="a" tone="green" dot>Active</Badge> : <Badge key="i" tone="gray" dot>Inactive until payment</Badge>],
                      ["Last sign-in", s.user.lastLoginAt ? formatDateTime(s.user.lastLoginAt) : "Never"],
                    ]}
                  />
                  <PasswordManager studentId={s.id} username={s.user.username} />
                </>
              ) : (
                <Alert tone="info" icon={<ShieldCheck />}>
                  This student has not registered yet, so there is no login account. A password can be set once they create their account through registration.
                </Alert>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Record" icon={<GraduationCap className="size-5" />} />
            <CardBody>
              <DetailList
                cols={1}
                items={[
                  ["Created", formatDateTime(s.createdAt)],
                  ["Last updated", formatDateTime(s.updatedAt)],
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Ident({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="truncate font-mono text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

function Metric({ label, value, percent }: { label: string; value: string; percent: number }) {
  const v = Math.round(percent);
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-sm font-semibold text-slate-900 tabular-nums">{v}%</p>
      </div>
      <ProgressBar value={v} size="sm" tone={v >= 75 ? "green" : v >= 40 ? "brand" : "amber"} />
      <p className="mt-1.5 text-xs text-slate-500">{value}</p>
    </div>
  );
}
