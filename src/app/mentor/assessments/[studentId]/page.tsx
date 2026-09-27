import { notFound } from "next/navigation";
import { Award, CheckCircle2, TrendingUp, XCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireMentor } from "@/lib/auth";
import { studentProgress, parseRatings } from "@/lib/student";
import { formatDate, formatDateTime } from "@/lib/format";
import { PageHeader, Alert } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { AssessmentForm } from "./assessment-form";

export const metadata = { title: "Assess Student" };

export default async function AssessStudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { mentor } = await requireMentor();
  const s = await prisma.student.findFirst({ where: { id: studentId, mentorId: mentor.id }, include: { assessment: true, college: { select: { name: true } } } });
  if (!s) notFound();
  const progress = await studentProgress(s.id);
  const eligible = s.paymentStatus === "PAID" && Boolean(s.internshipStart) && (s.status === "ACTIVE" || s.status === "COMPLETED");
  const locked = Boolean(s.resultPublishedAt);

  return (
    <>
      <PageHeader title={`Assessment · ${s.name}`} description={`${s.college.name} · internship ${formatDate(s.internshipStart)} – ${formatDate(s.internshipEnd)}`} back={{ href: "/mentor/assessments", label: "Assessments" }} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {!eligible ? (
            <Alert tone="info" title="Assessment not available yet">Assessments can be submitted once the student has paid and the internship has started.</Alert>
          ) : (
            <>
              {locked && (
                <Alert tone="warning" className="mb-4" title="Result published">
                  The result was published on {formatDateTime(s.resultPublishedAt)}. The assessment is locked.
                </Alert>
              )}
              <AssessmentForm
                studentId={s.id}
                locked={locked}
                initial={{
                  ratings: parseRatings(s.assessment?.ratings),
                  remarks: s.assessment?.remarks ?? "",
                  recommendCertificate: s.assessment?.recommendCertificate ?? false,
                }}
                submittedAt={s.assessment ? formatDateTime(s.assessment.updatedAt) : null}
              />
            </>
          )}
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Progress" icon={<TrendingUp className="size-5" />} actions={<StatusBadge status={s.status} />} />
            <CardBody className="space-y-4">
              <Meter label="Learning" value={progress.learning.percent} detail={`${progress.learning.completed}/${progress.learning.total} chapters`} />
              <Meter label="Hours logged" value={Math.min(100, (progress.loggedHours / Math.max(1, progress.durationHours)) * 100)} detail={`${progress.loggedHours}/${progress.durationHours}h`} />
              <Meter label="Attendance" value={progress.attendance.percent} detail={`${progress.attendance.percent}%`} />
              <Meter label="Quiz average" value={progress.quizzes.average} detail={`${progress.quizzes.passed}/${progress.quizzes.total} passed`} />
              <dl className="grid grid-cols-2 gap-3 pt-1 text-sm">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <dt className="text-xs text-slate-500">Assignments approved</dt>
                  <dd className="font-semibold text-slate-900">{progress.assignments.approved}/{progress.assignments.total}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <dt className="text-xs text-slate-500">Logbook entries</dt>
                  <dd className="font-semibold text-slate-900">{progress.logbook.entries}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <dt className="text-xs text-slate-500">Live project</dt>
                  <dd className="font-semibold text-slate-900">{progress.project.status ? <StatusBadge status={progress.project.status} /> : "Not submitted"}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <dt className="text-xs text-slate-500">Report</dt>
                  <dd className="font-semibold text-slate-900">{progress.report.status ? <StatusBadge status={progress.report.status} /> : "Not submitted"}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Certificate eligibility" icon={<Award className="size-5" />} actions={<Badge tone={progress.eligibility.eligible ? "green" : "amber"}>{progress.eligibility.eligible ? "Eligible" : "Not yet eligible"}</Badge>} />
            <ul className="divide-y divide-slate-100">
              {progress.eligibility.checks.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="flex items-center gap-2 text-slate-700">
                    {c.met ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-slate-300" />}
                    {c.label}
                  </span>
                  <span className="text-xs text-slate-500">{c.detail}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
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
