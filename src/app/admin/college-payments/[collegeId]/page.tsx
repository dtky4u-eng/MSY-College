import { notFound } from "next/navigation";
import { Banknote, CircleDollarSign, FileText, Hourglass, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { fileUrl } from "@/lib/files";
import { SETTLEMENT_MODE_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime, formatINR, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { ProgressBar } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/filters";
import { collegeBalance } from "../_lib/finance";
import { RecordSettlementButton } from "../record-settlement";
import { GATEWAY_LABEL } from "../../payments/labels";

export const metadata = { title: "College Settlement History" };

export default async function CollegeSettlementPage({
  params,
  searchParams,
}: {
  params: Promise<{ collegeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageRole("ADMIN");
  const { collegeId } = await params;
  const sp = await searchParams;
  const b = await collegeBalance(collegeId);
  if (!b) notFound();
  const { page, pageSize, skip, take } = pagination(sp, 15);
  const payWhere = { status: "SUCCESS", student: { collegeId } };

  const [settlements, payments, payTotal] = await Promise.all([
    prisma.collegeSettlement.findMany({ where: { collegeId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    prisma.payment.findMany({
      where: payWhere,
      orderBy: { paidAt: "desc" },
      skip,
      take,
      include: { student: { select: { name: true, registrationNumber: true, portalRegNo: true, domain: { select: { name: true } } } } },
    }),
    prisma.payment.count({ where: payWhere }),
  ]);
  const recorders = await prisma.user.findMany({ where: { id: { in: [...new Set(settlements.map((s) => s.recordedById))] } }, select: { id: true, username: true } });
  const recorder = new Map(recorders.map((u) => [u.id, u.username]));
  const proofs = await prisma.fileObject.findMany({ where: { id: { in: settlements.map((s) => s.proofFileId).filter((x): x is string => Boolean(x)) } }, select: { id: true, originalName: true } });
  const proofName = new Map(proofs.map((f) => [f.id, f.originalName]));

  return (
    <>
      <PageHeader
        back={{ href: "/admin/college-payments", label: "College Settlements" }}
        title={b.name}
        description={`College code ${b.code} · college share ${b.collegeShare}% of successful student payments`}
        actions={<RecordSettlementButton size="md" college={{ id: b.id, name: b.name, pending: b.pending, earned: b.earned, received: b.received }} />}
      />
      <StatGrid className="mb-4">
        <StatCard label="Student collection" value={formatINR(b.collection)} hint={`${formatNumber(b.paidStudents)} paid student(s)`} icon={<CircleDollarSign />} />
        <StatCard label="Earned share" value={formatINR(b.earned)} hint={`${b.collegeShare}% of collection`} icon={<Wallet />} tone="violet" />
        <StatCard label="Received" value={formatINR(b.received)} hint={`${b.settlements} settlement(s)`} icon={<Banknote />} tone="green" />
        <StatCard label="Pending balance" value={formatINR(b.pending)} icon={<Hourglass />} tone="amber" />
      </StatGrid>
      <Card className="mb-6 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Settlement progress</span>
          <span className="text-slate-500 tabular-nums">
            {formatINR(b.received)} of {formatINR(b.earned)}
          </span>
        </div>
        <ProgressBar value={b.progress} tone={b.progress >= 100 ? "green" : "brand"} showLabel />
      </Card>

      <Card className="mb-6">
        <CardHeader title="Settlement history" description="Payments made by MSY College to this college." icon={<Banknote className="size-5" />} />
        <Table>
          <THead>
            <TR>
              <TH>Date</TH>
              <TH className="text-right">Amount</TH>
              <TH>Mode</TH>
              <TH>Reference</TH>
              <TH>Remarks</TH>
              <TH>Proof</TH>
              <TH>Recorded</TH>
            </TR>
          </THead>
          <TBody>
            {settlements.length === 0 && <EmptyRow colSpan={7}>No settlements recorded yet.</EmptyRow>}
            {settlements.map((s) => (
              <TR key={s.id}>
                <TD className="whitespace-nowrap">{formatDate(s.date)}</TD>
                <TD className="text-right font-semibold whitespace-nowrap text-slate-900 tabular-nums">{formatINR(s.amount)}</TD>
                <TD>
                  <Badge tone="blue">{SETTLEMENT_MODE_LABEL[s.mode as keyof typeof SETTLEMENT_MODE_LABEL] ?? s.mode}</Badge>
                </TD>
                <TD className="font-mono text-xs">{s.reference ?? "—"}</TD>
                <TD className="max-w-[260px] text-xs text-slate-600">{s.remarks ?? "—"}</TD>
                <TD>
                  {s.proofFileId ? (
                    <a href={fileUrl(s.proofFileId)!} target="_blank" rel="noopener" className="inline-flex max-w-[180px] items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                      <FileText className="size-4 shrink-0" />
                      <span className="truncate">{proofName.get(s.proofFileId) ?? "View proof"}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Not attached</span>
                  )}
                </TD>
                <TD className="text-xs whitespace-nowrap text-slate-500">
                  {recorder.get(s.recordedById) ?? "—"}
                  <br />
                  {formatDateTime(s.createdAt)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardHeader title="Student payments" description="Successful payments that make up this college's collection." icon={<CircleDollarSign className="size-5" />} />
        <Table>
          <THead>
            <TR>
              <TH>Student</TH>
              <TH>Domain</TH>
              <TH>Transaction</TH>
              <TH>Gateway</TH>
              <TH className="text-right">Amount</TH>
              <TH className="text-right">College share</TH>
              <TH>Paid on</TH>
            </TR>
          </THead>
          <TBody>
            {payments.length === 0 && <EmptyRow colSpan={7}>No successful student payments yet.</EmptyRow>}
            {payments.map((p) => (
              <TR key={p.id}>
                <TD>
                  <p className="font-medium text-slate-900">{p.student.name}</p>
                  <p className="text-xs text-slate-500">{p.student.portalRegNo ?? p.student.registrationNumber}</p>
                </TD>
                <TD>{p.student.domain?.name ?? "—"}</TD>
                <TD className="font-mono text-xs">{p.transactionId}</TD>
                <TD>{GATEWAY_LABEL[p.gateway] ?? p.gateway}</TD>
                <TD className="text-right tabular-nums">{formatINR(p.amount)}</TD>
                <TD className="text-right font-medium tabular-nums">{formatINR(Math.round((p.amount * b.collegeShare) / 100))}</TD>
                <TD className="whitespace-nowrap">{formatDate(p.paidAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <Pagination page={page} pageSize={pageSize} total={payTotal} />
      </Card>
    </>
  );
}
