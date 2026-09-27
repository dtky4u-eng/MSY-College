import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Banknote, CircleDollarSign, Download, FileText, Hourglass, Landmark, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCollege } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { fileUrl } from "@/lib/files";
import { SETTLEMENT_MODE_LABEL } from "@/lib/constants";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { ProgressBar } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { collegeFinance } from "../_lib/finance";

export const metadata = { title: "My Payments" };

export default async function CollegePaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { college } = await requireCollege();
  const { page, pageSize, skip, take } = pagination(sp);
  const q = sp.q?.trim();

  const studentWhere: Prisma.StudentWhereInput = { collegeId: college.id };
  if (q) studentWhere.OR = [{ name: { contains: q } }, { registrationNumber: { contains: q } }, { portalRegNo: { contains: q } }];
  if (sp.domain) studentWhere.domainId = sp.domain;
  const payWhere: Prisma.PaymentWhereInput = { status: "SUCCESS", student: studentWhere };

  const [finance, settlements, total, payments, domains] = await Promise.all([
    collegeFinance(college),
    prisma.collegeSettlement.findMany({ where: { collegeId: college.id }, orderBy: { date: "desc" } }),
    prisma.payment.count({ where: payWhere }),
    prisma.payment.findMany({
      where: payWhere,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      skip,
      take,
      select: {
        id: true,
        amount: true,
        paidAt: true,
        createdAt: true,
        receiptNo: true,
        transactionId: true,
        method: true,
        student: { select: { id: true, name: true, registrationNumber: true, domain: { select: { name: true } } } },
      },
    }),
    prisma.domain.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader title="My Payments" description={`Your college earns ${college.collegeShare}% of every successful student payment. MSY College settles the earned share offline.`} />

      <StatGrid>
        <StatCard label="Student collection" value={formatINR(finance.collection)} icon={<Wallet />} hint={`${formatNumber(finance.paidCount)} successful payments`} />
        <StatCard label="Earned share" value={formatINR(finance.earned)} icon={<CircleDollarSign />} tone="teal" hint={`${college.collegeShare}% of collection`} />
        <StatCard label="Amount received" value={formatINR(finance.received)} icon={<Landmark />} tone="green" hint={`${finance.settlementCount} settlement${finance.settlementCount === 1 ? "" : "s"}`} />
        <StatCard label="Pending balance" value={formatINR(finance.pending)} icon={<Hourglass />} tone="amber" hint="Yet to be settled" />
      </StatGrid>

      <Card className="mt-6">
        <CardBody>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Settlement progress</p>
              <p className="text-xs text-slate-500">
                {formatINR(finance.received)} received of {formatINR(finance.earned)} earned
              </p>
            </div>
            <span className="font-display text-2xl font-bold text-slate-900 tabular-nums">{finance.progress}%</span>
          </div>
          <ProgressBar value={finance.progress} tone={finance.progress >= 100 ? "green" : "brand"} />
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Settlement history" description="Payments received from MSY College" icon={<Banknote className="size-5" />} />
        <Table>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH>Mode</TH>
              <TH>UTR / Transaction no.</TH>
              <TH className="text-right">Amount</TH>
              <TH>Remarks</TH>
              <TH>Proof</TH>
            </tr>
          </THead>
          <TBody>
            {settlements.length === 0 && <EmptyRow colSpan={6}>No settlements have been recorded yet.</EmptyRow>}
            {settlements.map((st) => {
              const proof = fileUrl(st.proofFileId);
              return (
                <TR key={st.id}>
                  <TD className="whitespace-nowrap">{formatDate(st.date)}</TD>
                  <TD><Badge tone="blue">{SETTLEMENT_MODE_LABEL[st.mode as keyof typeof SETTLEMENT_MODE_LABEL] ?? st.mode}</Badge></TD>
                  <TD className="font-mono text-xs text-slate-700">{st.reference ?? "—"}</TD>
                  <TD className="text-right font-semibold text-slate-900 tabular-nums">{formatINR(st.amount)}</TD>
                  <TD className="max-w-72 text-slate-600">{st.remarks ?? "—"}</TD>
                  <TD>
                    {proof ? (
                      <a href={proof} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                        <FileText className="size-3.5" /> View proof
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Student collection" description="Successful internship fee payments by your students" icon={<Wallet className="size-5" />} />
        <FilterBar>
          <SearchInput placeholder="Search student or registration no." />
          <FilterSelect param="domain" placeholder="All domains" label="Domain" options={domains.map((d) => ({ value: d.id, label: d.name }))} />
        </FilterBar>
        <Table>
          <THead>
            <tr>
              <TH>Student</TH>
              <TH>Domain</TH>
              <TH>Receipt no.</TH>
              <TH>Paid on</TH>
              <TH className="text-right">Amount</TH>
              <TH className="text-right">College share</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {payments.length === 0 && <EmptyRow colSpan={7}>{q || sp.domain ? "No payments match your filters." : "No successful payments yet."}</EmptyRow>}
            {payments.map((p) => (
              <TR key={p.id}>
                <TD>
                  <Link href={`/college/students/${p.student.id}`} className="font-medium text-slate-900 hover:text-brand-700">{p.student.name}</Link>
                  <div className="text-xs text-slate-500">{p.student.registrationNumber}</div>
                </TD>
                <TD>{p.student.domain?.name ?? "—"}</TD>
                <TD className="font-mono text-xs text-slate-600">{p.receiptNo ?? p.transactionId}</TD>
                <TD className="whitespace-nowrap">{formatDate(p.paidAt ?? p.createdAt)}</TD>
                <TD className="text-right tabular-nums">{formatINR(p.amount)}</TD>
                <TD className="text-right text-teal-700 tabular-nums">{formatINR(Math.round((p.amount * college.collegeShare) / 100))}</TD>
                <TD className="text-right">
                  <a href={`/api/payments/${p.id}/receipt`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                    <Download className="size-3.5" /> Receipt
                  </a>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <Pagination page={page} pageSize={pageSize} total={total} />
      </Card>
    </>
  );
}
