import Link from "next/link";
import { Banknote, Building2, CircleDollarSign, Hourglass, Wallet } from "lucide-react";
import { requirePageRole } from "@/lib/auth";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { ProgressBar } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/badge";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/filters";
import { ButtonLink } from "@/components/ui/button";
import { sp1 } from "@/components/admin/ops/lookups";
import { collegeBalances } from "./_lib/finance";
import { RecordSettlementButton } from "./record-settlement";

export const metadata = { title: "College Settlements" };

export default async function CollegePaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageRole("ADMIN");
  const sp = await searchParams;
  const q = sp1(sp, "q")?.toLowerCase();
  const balanceFilter = sp1(sp, "balance");
  const all = await collegeBalances();
  const rows = all.filter(
    (c) =>
      (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) &&
      (!balanceFilter || (balanceFilter === "pending" ? c.pending > 0 : c.pending === 0)),
  );
  rows.sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name));

  const t = all.reduce((a, c) => ({ collection: a.collection + c.collection, earned: a.earned + c.earned, received: a.received + c.received, pending: a.pending + c.pending }), {
    collection: 0,
    earned: 0,
    received: 0,
    pending: 0,
  });

  return (
    <>
      <PageHeader
        title="College Settlements"
        description="Each partner college earns its share of successful student payments. Record offline settlements (bank transfer, UPI, cheque) up to the pending balance and keep proof on file."
      />
      <StatGrid className="mb-6">
        <StatCard label="Student collection" value={formatINR(t.collection)} hint="Successful payments, all colleges" icon={<CircleDollarSign />} tone="brand" />
        <StatCard label="Colleges' earned share" value={formatINR(t.earned)} hint="Collection × college share %" icon={<Wallet />} tone="violet" />
        <StatCard label="Settled" value={formatINR(t.received)} hint={`${t.earned ? Math.round((t.received / t.earned) * 100) : 0}% of earned share`} icon={<Banknote />} tone="green" />
        <StatCard label="Pending balance" value={formatINR(t.pending)} hint={`${formatNumber(all.filter((c) => c.pending > 0).length)} college(s) awaiting payment`} icon={<Hourglass />} tone="amber" />
      </StatGrid>

      <Card>
        <FilterBar>
          <SearchInput placeholder="Search college name or code…" />
          <FilterSelect
            param="balance"
            placeholder="All balances"
            label="Balance"
            options={[
              { value: "pending", label: "Pending balance" },
              { value: "settled", label: "Fully settled" },
            ]}
          />
        </FilterBar>
        {all.length === 0 ? (
          <EmptyState icon={<Building2 />} title="No colleges yet" description="Add partner colleges first; their revenue share appears here once students pay." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>College</TH>
                <TH className="text-right">Collection</TH>
                <TH className="text-right">Share</TH>
                <TH className="text-right">Earned</TH>
                <TH className="text-right">Received</TH>
                <TH className="text-right">Pending</TH>
                <TH className="min-w-[160px]">Settlement progress</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 && <EmptyRow colSpan={8}>No colleges match these filters.</EmptyRow>}
              {rows.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/admin/college-payments/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                      {c.name}
                    </Link>
                    <p className="flex items-center gap-2 text-xs text-slate-500">
                      {c.code} · {formatNumber(c.paidStudents)} paid student(s)
                      {c.status !== "ACTIVE" && <StatusBadge status={c.status} />}
                    </p>
                  </TD>
                  <TD className="text-right tabular-nums">{formatINR(c.collection)}</TD>
                  <TD className="text-right tabular-nums">{c.collegeShare}%</TD>
                  <TD className="text-right font-medium tabular-nums">{formatINR(c.earned)}</TD>
                  <TD className="text-right text-emerald-700 tabular-nums">
                    {formatINR(c.received)}
                    {c.lastSettlementAt && <p className="text-[11px] text-slate-500">Last {formatDate(c.lastSettlementAt)}</p>}
                  </TD>
                  <TD className={`text-right font-semibold tabular-nums ${c.pending > 0 ? "text-amber-700" : "text-slate-500"}`}>{formatINR(c.pending)}</TD>
                  <TD>
                    <ProgressBar value={c.progress} tone={c.progress >= 100 ? "green" : c.progress > 0 ? "brand" : "amber"} size="sm" showLabel />
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <ButtonLink href={`/admin/college-payments/${c.id}`} size="sm" variant="outline">
                        History
                      </ButtonLink>
                      <RecordSettlementButton college={{ id: c.id, name: c.name, pending: c.pending, earned: c.earned, received: c.received }} />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
