import type { Prisma } from "@prisma/client";
import { AlertCircle, Clock, IndianRupee, Undo2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { GATEWAYS, PAYMENT_STATUS } from "@/lib/constants";
import { formatINR, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { DateFilter, FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { collegeOptions, istRange, sp1 } from "@/components/admin/ops/lookups";
import { PaymentsTable, type PaymentRow } from "./payments-table";
import { GATEWAY_LABEL, PAYMENT_STATUS_LABEL as STATUS_LABEL } from "./labels";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageRole("ADMIN");
  const sp = await searchParams;
  const { page, pageSize, skip, take } = pagination(sp, 20);
  const q = sp1(sp, "q");
  const status = sp1(sp, "status");
  const gateway = sp1(sp, "gateway");
  const college = sp1(sp, "college");
  const created = istRange(sp1(sp, "from"), sp1(sp, "to"));

  const base: Prisma.PaymentWhereInput = {
    ...(gateway ? { gateway } : {}),
    ...(college ? { student: { collegeId: college } } : {}),
    ...(created ? { createdAt: created } : {}),
    ...(q
      ? {
          OR: [
            { transactionId: { contains: q } },
            { orderId: { contains: q } },
            { gatewayPaymentId: { contains: q } },
            { receiptNo: { contains: q } },
            { student: { name: { contains: q } } },
            { student: { registrationNumber: { contains: q } } },
            { student: { portalRegNo: { contains: q } } },
          ],
        }
      : {}),
  };
  const where: Prisma.PaymentWhereInput = { ...base, ...(status ? { status } : {}) };

  const [total, rows, byStatus, colleges] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { student: { select: { name: true, registrationNumber: true, portalRegNo: true, college: { select: { name: true } } } } },
    }),
    prisma.payment.groupBy({ by: ["status"], where: base, _count: { _all: true }, _sum: { amount: true } }),
    collegeOptions(),
  ]);

  const agg = (...st: string[]) => byStatus.filter((b) => st.includes(b.status)).reduce((a, b) => ({ count: a.count + b._count._all, amount: a.amount + (b._sum.amount ?? 0) }), { count: 0, amount: 0 });
  const collected = agg("SUCCESS");
  const pending = agg("CREATED", "PENDING");
  const failed = agg("FAILED", "VERIFY_FAILED");
  const refunded = agg("REFUNDED");

  const data: PaymentRow[] = rows.map((r) => ({
    id: r.id,
    transactionId: r.transactionId,
    studentName: r.student.name,
    registrationNumber: r.student.registrationNumber,
    portalRegNo: r.student.portalRegNo,
    college: r.student.college.name,
    gateway: r.gateway,
    method: r.method,
    amount: r.amount,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    paidAt: r.paidAt?.toISOString() ?? null,
    receiptNo: r.receiptNo,
    manual: Boolean(r.markedById),
  }));

  const filtered = Boolean(q || status || gateway || college || created);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Search every internship fee payment, inspect gateway identifiers, reconcile pending payments and issue receipts. Manual changes require a reason and are recorded in the audit log."
      />

      <StatGrid className="mb-6">
        <StatCard label="Collected" value={formatINR(collected.amount)} hint={`${formatNumber(collected.count)} successful payment(s)`} icon={<IndianRupee />} tone="green" />
        <StatCard label="Pending" value={formatNumber(pending.count)} hint="Created or awaiting confirmation" icon={<Clock />} tone="amber" />
        <StatCard label="Failed" value={formatNumber(failed.count)} hint="Failed or verification failed" icon={<AlertCircle />} tone="red" />
        <StatCard label="Refunded" value={formatNumber(refunded.count)} hint={refunded.count ? formatINR(refunded.amount) : "No refunds recorded"} icon={<Undo2 />} tone="violet" />
      </StatGrid>

      <Card>
        <FilterBar>
          <SearchInput placeholder="Student, reg. no., transaction / order ID…" className="sm:w-80" />
          <FilterSelect param="status" placeholder="All statuses" label="Status" options={PAYMENT_STATUS.map((s) => ({ value: s, label: STATUS_LABEL[s] ?? s }))} />
          <FilterSelect param="gateway" placeholder="All gateways" label="Gateway" options={GATEWAYS.map((g) => ({ value: g, label: GATEWAY_LABEL[g] ?? g }))} />
          <FilterSelect param="college" placeholder="All colleges" label="College" options={colleges} className="max-w-[240px]" />
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <DateFilter param="from" label="Created from" />
            <span aria-hidden>–</span>
            <DateFilter param="to" label="Created to" />
          </div>
        </FilterBar>
        <PaymentsTable rows={data} filtered={filtered} />
        <Pagination page={page} pageSize={pageSize} total={total} />
      </Card>
    </>
  );
}
