import { FileSignature, FileText, Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/constants";
import { PageHeader, EmptyState, Alert } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StateBanner } from "@/components/student/state-banner";
import { SubmissionStatus } from "@/components/student/submission-status";
import { FileUploadForm } from "@/components/student/file-upload-form";
import { ACCEPT } from "@/components/student/utils";
import { studentPage } from "../_lib/server";

export const metadata = { title: "Internship Report" };

export default async function ReportPage() {
  const { student, state, t } = await studentPage();
  const sub = await prisma.submission.findFirst({ where: { studentId: student.id, kind: "REPORT" }, orderBy: { updatedAt: "desc" } });
  const canSubmit = state === "ACTIVE" && sub?.status !== "APPROVED";

  return (
    <>
      <PageHeader title={t("report.title")} description={t("report.subtitle")} />
      <StateBanner state={state} student={student} context="submissions" />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader icon={<FileText className="size-5" />} title={t("report.status")} />
          <CardBody className="space-y-4">
            {sub ? (
              <>
                <SubmissionStatus submission={sub} />
                {sub.status === "APPROVED" && (
                  <Alert tone="success" icon={<Lock />}>
                    {t("report.approvedNote")}
                  </Alert>
                )}
              </>
            ) : (
              <EmptyState icon={<FileSignature />} title={t("report.emptyTitle")} description={t("report.emptyDesc")} className="py-8" />
            )}
          </CardBody>
        </Card>
        <div className="space-y-6 lg:col-span-2">
          {canSubmit && (
            <Card>
              <CardHeader title={sub ? t("report.resubmitTitle") : t("report.uploadTitle")} description={sub?.status === "RESUBMIT" ? t("sub.resubmitRequested") : t("report.uploadDesc")} />
              <CardBody>
                <FileUploadForm endpoint="/api/student/report" accept={ACCEPT.report} maxBytes={LIMITS.submissionBytes} resubmit={Boolean(sub)} hint={t("report.fileHint")} />
              </CardBody>
            </Card>
          )}
          {!canSubmit && state !== "ACTIVE" && !sub && <Alert tone="info">{t("sub.inactiveNote")}</Alert>}
          <Card>
            <CardHeader title={t("report.checklistTitle")} />
            <CardBody>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                <li>{t("report.check1")}</li>
                <li>{t("report.check2")}</li>
                <li>{t("report.check3")}</li>
                <li>{t("report.check4")}</li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
