import { notFound } from "next/navigation";
import { Award, CalendarCheck, CheckCircle2, Download, Eye, FileText, KeyRound, Receipt, TrendingUp, UserRound, XCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCollege } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { studentProgress, ACCESS_STATE_LABEL } from "@/lib/student";
import { documentAvailability } from "@/lib/pdf/documents";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { GENDERS } from "@/lib/constants";
import { PageHeader, DetailList, Alert } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { ButtonLink } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { StudentPasswordForm } from "./password-form";
import { STEP_NAME } from "../../_lib/finance";

export const metadata = { title: "Student Details" };

export default async function CollegeStudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { college } = await requireCollege();
  // AR-5: scope by college
  const s = await prisma.student.findFirst({
    where: { id, collegeId: college.id },
    include: {
      domain: true,
      mentor: { select: { name: true, email: true, mobile: true } },
      certificate: true,
      user: { select: { username: true, lastLoginAt: true } },
      payments: { orderBy: { createdAt: "desc" }, select: { id: true, transactionId: true, amount: true, status: true, paidAt: true, createdAt: true, receiptNo: true, method: true } },
    },
  });
  if (!s) notFound();

  const registered = s.paymentStatus === "PAID";
  const [progress, docs] = await Promise.all([registered ? studentProgress(s.id) : Promise.resolve(null), documentAvailability(s.id)]);
  const gender = GENDERS.find((g) => g.value === s.gender)?.label;
  const docItems = [
    { type: "certificate", label: "Internship Certificate", av: docs.CERTIFICATE },
    { type: "marksheet", label: "Assessment Marksheet", av: docs.MARKSHEET },
  ];

  return (
    <>
      <PageHeader title={s.name} description={`Registration No. ${s.registrationNumber}${s.portalRegNo ? ` · MSY College No. ${s.portalRegNo}` : ""}`} back={{ href: "/college/students", label: "Students" }} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardBody className="flex flex-wrap items-center gap-5">
              <Avatar name={s.name} src={fileUrl(s.photoFileId)} size={72} />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-slate-900">{s.name}</p>
                <p className="text-sm text-slate-500">
                  {[s.programme, s.majorSubject].filter(Boolean).join(" · ") || "Programme not provided"}
                  {s.semester && ` · Semester ${s.semester}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge status={s.status} />
                  <StatusBadge status={s.paymentStatus} />
                  {progress && <Badge tone="brand">{ACCESS_STATE_LABEL[progress.accessState]}</Badge>}
                  {s.resultStatus && <StatusBadge status={s.resultStatus} label={`Result: ${s.resultStatus === "PASS" ? "Pass" : "Fail"}${s.grade ? ` (${s.grade})` : ""}`} />}
                </div>
              </div>
              {progress && <ProgressRing value={progress.overallPercent} sub="overall" />}
            </CardBody>
          </Card>

          {s.status === "BLOCKED" && s.blockedReason && (
            <Alert tone="error" icon={<XCircle />} title="Internship blocked">
              {s.blockedReason}
            </Alert>
          )}

          <Card>
            <CardHeader title="Profile" icon={<UserRound className="size-5" />} />
            <CardBody>
              <DetailList
                cols={3}
                items={[
                  ["Father name", s.fatherName],
                  ["Gender", gender],
                  ["Date of birth", s.dob ? formatDate(s.dob) : null],
                  ["Roll number", s.rollNumber],
                  ["Session", s.session],
                  ["Semester", s.semester],
                  ["Mobile", s.mobile],
                  ["Email", s.email],
                  ["Username", s.user?.username],
                  ["Domain", s.domain?.name],
                  ["Mentor", s.mentor?.name ?? "Not assigned"],
                  ["Registration", registered ? `Completed ${formatDate(s.registeredAt)}` : `Step ${s.nextStep} · ${STEP_NAME[s.nextStep] ?? "In progress"}`],
                  ["Internship start", formatDate(s.internshipStart)],
                  ["Internship end", formatDate(s.internshipEnd)],
                  ["Last sign-in", s.user?.lastLoginAt ? formatDateTime(s.user.lastLoginAt) : "Never"],
                ]}
              />
            </CardBody>
          </Card>

          {progress ? (
            <>
              <Card>
                <CardHeader title="Progress summary" icon={<TrendingUp className="size-5" />} description={`${progress.loggedHours} of ${progress.durationHours} internship hours logged`} />
                <CardBody className="grid gap-5 sm:grid-cols-2">
                  <Meter label="Learning modules" value={progress.learning.percent} detail={`${progress.learning.completed}/${progress.learning.total} chapters`} />
                  <Meter label="Internship hours" value={Math.min(100, (progress.loggedHours / Math.max(1, progress.durationHours)) * 100)} detail={`${progress.hoursRemaining}h remaining`} />
                  <Meter label="Quiz average" value={progress.quizzes.average} detail={`${progress.quizzes.passed}/${progress.quizzes.total} passed`} />
                  <Meter label="Assignments approved" value={progress.assignments.total ? (progress.assignments.approved / progress.assignments.total) * 100 : 0} detail={`${progress.assignments.approved}/${progress.assignments.total}`} />
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                    <span className="text-slate-600">Live project</span>
                    <StatusBadge status={progress.project.status ?? "NOT_MARKED"} label={progress.project.status ? undefined : "Not submitted"} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                    <span className="text-slate-600">Internship report</span>
                    <StatusBadge status={progress.report.status ?? "NOT_MARKED"} label={progress.report.status ? undefined : "Not submitted"} />
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Attendance" icon={<CalendarCheck className="size-5" />} description={`${progress.attendance.workingDays} working days elapsed of ${progress.attendance.totalDays}`} />
                <CardBody>
                  <div className="mb-4 flex items-center gap-3">
                    <ProgressBar value={progress.attendance.percent} tone={progress.attendance.percent >= 75 ? "green" : "amber"} className="flex-1" />
                    <span className="font-display text-xl font-bold text-slate-900 tabular-nums">{progress.attendance.percent}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <Count label="Present" value={progress.attendance.present} tone="text-emerald-600" />
                    <Count label="Half day" value={progress.attendance.halfDay} tone="text-amber-600" />
                    <Count label="Absent" value={progress.attendance.absent} tone="text-rose-600" />
                    <Count label="Approved leave" value={progress.attendance.leave} tone="text-sky-600" />
                    <Count label="Not marked" value={progress.attendance.notMarked} tone="text-slate-500" />
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Certificate eligibility" icon={<Award className="size-5" />} actions={<Badge tone={progress.eligibility.eligible ? "green" : "amber"}>{progress.eligibility.eligible ? "Eligible" : "Not yet eligible"}</Badge>} />
                <ul className="divide-y divide-slate-100">
                  {progress.eligibility.checks.map((c) => (
                    <li key={c.key} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <span className="flex items-center gap-2 text-slate-700">
                        {c.met ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-slate-300" />}
                        {c.label}
                      </span>
                      <span className="text-slate-500">{c.detail}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          ) : (
            <Alert tone="info" title="Registration not completed">
              Internship progress, attendance and documents become available after the student completes registration and pays the internship fee.
            </Alert>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Documents" icon={<FileText className="size-5" />} description="Certificates and marksheets can be viewed and downloaded by the college" />
            <ul className="divide-y divide-slate-100">
              {docItems.map((d) => (
                <li key={d.type} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{d.label}</p>
                    {d.av.available ? <Badge tone="green">Available</Badge> : <Badge>Not available</Badge>}
                  </div>
                  {d.type === "certificate" && s.certificate && !s.certificate.revokedAt && <p className="mt-0.5 font-mono text-xs text-slate-500">{s.certificate.certificateNo}</p>}
                  {d.av.available ? (
                    <div className="mt-3 flex gap-2">
                      <ButtonLink external href={`/api/documents/${s.id}/${d.type}?inline=1`} target="_blank" rel="noopener" size="sm" variant="outline" icon={<Eye className="size-4" />}>
                        View
                      </ButtonLink>
                      <ButtonLink external href={`/api/documents/${s.id}/${d.type}`} size="sm" variant="secondary" icon={<Download className="size-4" />}>
                        Download
                      </ButtonLink>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">{d.av.reason}</p>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Change password" icon={<KeyRound className="size-5" />} description="Set a new sign-in password for this student" />
            <CardBody>
              {s.userId ? (
                <StudentPasswordForm studentId={s.id} />
              ) : (
                <p className="text-sm text-slate-500">This student has not created a login yet. A password can be set after the student completes the registration details step.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payments" icon={<Receipt className="size-5" />} />
            <Table>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH className="text-right">Amount</TH>
                  <TH>Status</TH>
                  <TH />
                </tr>
              </THead>
              <TBody>
                {s.payments.length === 0 && <EmptyRow colSpan={4}>No payment attempts</EmptyRow>}
                {s.payments.map((p) => (
                  <TR key={p.id}>
                    <TD className="whitespace-nowrap text-slate-500">{formatDate(p.paidAt ?? p.createdAt)}</TD>
                    <TD className="text-right tabular-nums">{formatINR(p.amount)}</TD>
                    <TD><StatusBadge status={p.status} /></TD>
                    <TD className="text-right">
                      {p.status === "SUCCESS" && (
                        <a href={`/api/payments/${p.id}/receipt`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                          <Download className="size-3.5" /> Receipt
                        </a>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </div>
      </div>
    </>
  );
}

function Meter({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-xs text-slate-500">{detail}</span>
      </div>
      <ProgressBar value={value} showLabel />
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
      <p className={`font-display text-lg font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
