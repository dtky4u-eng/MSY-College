import { CalendarClock, ClipboardList, Download, Lock, Trophy } from "lucide-react";
import { prisma } from "@/lib/db";
import { fileUrl } from "@/lib/files";
import { LIMITS } from "@/lib/constants";
import { formatDate, toISTDateString } from "@/lib/format";
import { PageHeader, EmptyState, Alert } from "@/components/ui/page";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { StateBanner } from "@/components/student/state-banner";
import { SubmissionStatus } from "@/components/student/submission-status";
import { FileUploadForm } from "@/components/student/file-upload-form";
import { ACCEPT, isLate } from "@/components/student/utils";
import { studentPage } from "../_lib/server";

export const metadata = { title: "Assignments" };

export default async function AssignmentsPage() {
  const { student, state, t } = await studentPage();
  const [assignments, subs] = await Promise.all([
    student.domainId ? prisma.assignment.findMany({ where: { domainId: student.domainId }, orderBy: { dueDate: "asc" } }) : Promise.resolve([]),
    prisma.submission.findMany({ where: { studentId: student.id, kind: "ASSIGNMENT" }, orderBy: { updatedAt: "desc" } }),
  ]);
  const byAssignment = new Map<string, (typeof subs)[number]>();
  for (const s of subs) if (s.assignmentId && !byAssignment.has(s.assignmentId)) byAssignment.set(s.assignmentId, s);
  const today = toISTDateString();
  const submitted = assignments.filter((a) => byAssignment.has(a.id)).length;
  const approved = assignments.filter((a) => byAssignment.get(a.id)?.status === "APPROVED").length;

  return (
    <>
      <PageHeader
        title={t("asg.title")}
        description={t("asg.subtitle")}
        actions={
          assignments.length ? (
            <div className="flex gap-2">
              <Badge tone="brand">{t("asg.submittedCount", { n: submitted, total: assignments.length })}</Badge>
              <Badge tone="green">{t("asg.approvedCount", { n: approved })}</Badge>
            </div>
          ) : null
        }
      />
      <StateBanner state={state} student={student} context="submissions" />

      {assignments.length === 0 ? (
        <Card>
          <EmptyState icon={<ClipboardList />} title={t("asg.emptyTitle")} description={t("asg.emptyDesc")} />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {assignments.map((a) => {
            const sub = byAssignment.get(a.id);
            const dueYmd = toISTDateString(a.dueDate);
            const overdue = !sub && dueYmd < today;
            const dueSoon = !sub && !overdue && dueYmd <= toISTDateString(new Date(Date.now() + 3 * 86_400_000));
            const late = sub ? isLate(sub.submittedAt, a.dueDate) : false;
            const canSubmit = state === "ACTIVE" && sub?.status !== "APPROVED";
            return (
              <Card key={a.id} className="flex flex-col">
                <div className="border-b border-slate-100 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-[15px] font-semibold text-slate-900">{a.title}</h2>
                    {overdue ? <Badge tone="red">{t("asg.overdue")}</Badge> : dueSoon ? <Badge tone="amber">{t("asg.dueSoon")}</Badge> : null}
                  </div>
                  {a.description && <p className="mt-1 text-sm whitespace-pre-line text-slate-600">{a.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="size-3.5" /> {t("asg.due", { date: formatDate(a.dueDate) })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Trophy className="size-3.5" /> {t("asg.maxMarks", { n: a.maxMarks })}
                    </span>
                  </div>
                  {a.briefFileId && (
                    <ButtonLink href={fileUrl(a.briefFileId, true)!} external variant="secondary" size="sm" icon={<Download className="size-4" />} className="mt-3">
                      {t("asg.downloadBrief")}
                    </ButtonLink>
                  )}
                </div>
                <CardBody className="flex-1 space-y-4">
                  {sub ? (
                    <SubmissionStatus submission={sub} maxMarks={a.maxMarks} late={late} />
                  ) : (
                    <p className="text-sm text-slate-500">{t("sub.notSubmittedYet")}</p>
                  )}
                  {sub?.status === "APPROVED" ? (
                    <Alert tone="success" icon={<Lock />}>
                      {t("sub.approvedLocked")}
                    </Alert>
                  ) : canSubmit ? (
                    <div className="border-t border-slate-100 pt-4">
                      {sub?.status === "RESUBMIT" && <p className="mb-2 text-sm font-medium text-rose-700">{t("sub.resubmitRequested")}</p>}
                      <FileUploadForm
                        endpoint={`/api/student/assignments/${a.id}/submit`}
                        accept={ACCEPT.submission}
                        maxBytes={LIMITS.submissionBytes}
                        resubmit={Boolean(sub)}
                        hint={t("asg.fileHint")}
                        confirmLateMessage={dueYmd < today ? t("asg.lateWarning") : null}
                      />
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
