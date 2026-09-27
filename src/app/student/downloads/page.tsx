import { Award, BadgeCheck, CalendarCheck, Download, ExternalLink, Eye, FileCheck2, FileSignature, FileText, Lock, NotebookPen, Receipt, ScrollText } from "lucide-react";
import { prisma } from "@/lib/db";
import { documentAvailability } from "@/lib/pdf/documents";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/constants";
import { fileUrl } from "@/lib/files";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import { StateBanner } from "@/components/student/state-banner";
import { studentPage } from "../_lib/server";

export const metadata = { title: "Download Center" };

const ICONS: Record<DocumentType, typeof FileText> = {
  OFFER_LETTER: FileSignature,
  ACCEPTANCE_LETTER: FileCheck2,
  ATTENDANCE_SHEET: CalendarCheck,
  LOGBOOK: NotebookPen,
  REPORT: FileText,
  MARKSHEET: ScrollText,
  CERTIFICATE: Award,
};

export default async function DownloadsPage() {
  const { student, state, t } = await studentPage();
  const [availability, certificate, payments, report] = await Promise.all([
    documentAvailability(student.id),
    prisma.certificate.findUnique({ where: { studentId: student.id } }),
    prisma.payment.findMany({ where: { studentId: student.id, status: "SUCCESS" }, orderBy: { paidAt: "desc" } }),
    prisma.submission.findFirst({ where: { studentId: student.id, kind: "REPORT" }, orderBy: { updatedAt: "desc" } }),
  ]);
  const base = `/api/documents/${student.id}`;
  const readyCount = DOCUMENT_TYPES.filter((d) => availability[d].available).length;
  const reasonKey: Record<DocumentType, string> = {
    OFFER_LETTER: "doc.reason.start",
    ACCEPTANCE_LETTER: "doc.reason.start",
    ATTENDANCE_SHEET: "doc.reason.started",
    LOGBOOK: "doc.reason.logbook",
    REPORT: "doc.reason.report",
    MARKSHEET: "doc.reason.results",
    CERTIFICATE: "doc.reason.certificate",
  };

  return (
    <>
      <PageHeader title={t("doc.title")} description={t("doc.subtitle")} actions={<Badge tone="brand">{t("doc.readyCount", { n: readyCount, total: DOCUMENT_TYPES.length })}</Badge>} />
      <StateBanner state={state} student={student} />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {DOCUMENT_TYPES.map((type) => {
          const a = availability[type];
          const I = ICONS[type];
          const slug = type.toLowerCase();
          const isCert = type === "CERTIFICATE";
          return (
            <Card key={type} className={cn("flex flex-col p-5", !a.available && "bg-slate-50/60")}>
              <div className="flex items-start gap-3">
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", a.available ? (isCert ? "bg-amber-50 text-amber-600" : "bg-brand-50 text-brand-600") : "bg-slate-100 text-slate-400")}>
                  <I className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{t(`doc.${type}`)}</p>
                  {a.available ? (
                    <Badge tone="green" dot className="mt-1">
                      {t("doc.ready")}
                    </Badge>
                  ) : (
                    <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
                      <Lock className="mt-0.5 size-3 shrink-0" /> {t(reasonKey[type]) === reasonKey[type] ? a.reason : t(reasonKey[type])}
                    </p>
                  )}
                </div>
              </div>
              {isCert && certificate && !certificate.revokedAt && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
                  <p className="text-slate-500">{t("doc.certNo")}</p>
                  <p className="font-mono text-sm font-semibold text-slate-900">{certificate.certificateNo}</p>
                  <p className="mt-1 text-slate-500">{t("doc.issuedOn", { date: formatDate(certificate.issuedAt) })}</p>
                  <a href={`/verify/${certificate.verifyCode}`} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                    <BadgeCheck className="size-3.5" /> {t("doc.verifyLink")} <ExternalLink className="size-3" />
                  </a>
                </div>
              )}
              {isCert && certificate?.revokedAt && <p className="mt-3 text-xs font-medium text-rose-600">{t("doc.certRevoked")}</p>}
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {a.available ? (
                  <>
                    <ButtonLink href={`${base}/${slug}?inline=1`} external target="_blank" rel="noopener" variant="outline" size="sm" icon={<Eye className="size-4" />}>
                      {t("action.view")}
                    </ButtonLink>
                    <ButtonLink href={`${base}/${slug}`} external size="sm" icon={<Download className="size-4" />}>
                      {t("action.download")}
                    </ButtonLink>
                  </>
                ) : (
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 text-xs font-medium text-slate-400">
                    <Lock className="size-3.5" /> {t("doc.notYet")}
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={<Receipt className="size-5" />} title={t("doc.receipts")} description={t("doc.receiptsDesc")} />
          {payments.length === 0 ? (
            <EmptyState icon={<Receipt />} title={t("doc.noReceipts")} className="py-10" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>{t("doc.receiptNo")}</TH>
                  <TH>{t("doc.paidOn")}</TH>
                  <TH>{t("doc.amount")}</TH>
                  <TH>{t("doc.method")}</TH>
                  <TH>{t("doc.txn")}</TH>
                  <TH className="text-right">{t("doc.receipt")}</TH>
                </tr>
              </THead>
              <TBody>
                {payments.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-medium whitespace-nowrap text-slate-900">{p.receiptNo ?? "—"}</TD>
                    <TD className="whitespace-nowrap">{formatDateTime(p.paidAt ?? p.createdAt)}</TD>
                    <TD className="whitespace-nowrap font-semibold">{formatINR(p.amount)}</TD>
                    <TD className="uppercase">{p.method ?? p.gateway}</TD>
                    <TD className="font-mono text-xs">{p.transactionId}</TD>
                    <TD className="text-right">
                      <ButtonLink href={`/api/payments/${p.id}/receipt`} external size="xs" variant="secondary" icon={<Download className="size-3.5" />}>
                        {t("action.download")}
                      </ButtonLink>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader icon={<FileText className="size-5" />} title={t("doc.myReport")} description={t("doc.myReportDesc")} />
          <div className="p-5">
            {report?.fileId ? (
              <div className="space-y-3">
                <StatusBadge status={report.status} label={t(`sub.${report.status}`)} />
                <p className="text-xs text-slate-500">{t("sub.submittedOn", { date: formatDateTime(report.submittedAt) })}</p>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href={fileUrl(report.fileId)!} external target="_blank" rel="noopener" variant="outline" size="sm" icon={<Eye className="size-4" />}>
                    {t("action.view")}
                  </ButtonLink>
                  <ButtonLink href={fileUrl(report.fileId, true)!} external size="sm" icon={<Download className="size-4" />}>
                    {t("action.download")}
                  </ButtonLink>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t("doc.noReportUploaded")}</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
