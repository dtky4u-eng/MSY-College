import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Ban, Building2, CheckCircle2, Clock, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { fileUrl } from "@/lib/files";
import { formatINR, formatNumber } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { Avatar } from "@/components/ui/avatar";
import { paidByCollege, revenueByCollege } from "@/components/admin/core/server-data";

export const metadata = { title: "Colleges" };

type SP = Record<string, string | undefined>;

export default async function CollegesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePageRole("ADMIN");
  const sp = await searchParams;
  const { page, pageSize, skip, take } = pagination(sp, 20);
  const q = sp.q?.trim();
  const status = ["ACTIVE", "PENDING", "INACTIVE"].includes(sp.status ?? "") ? sp.status : undefined;

  const where: Prisma.CollegeWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { code: { contains: q.toUpperCase() } },
            { university: { contains: q } },
            { district: { contains: q } },
            { state: { contains: q } },
            { email: { contains: q.toLowerCase() } },
          ],
        }
      : {}),
  };

  const [total, colleges, counts] = await Promise.all([
    prisma.college.count({ where }),
    prisma.college.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take,
      include: { adminUser: { select: { username: true } }, _count: { select: { students: true, domainFees: true } } },
    }),
    prisma.college.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const ids = colleges.map((c) => c.id);
  const [paid, revenue] = await Promise.all([paidByCollege(ids), revenueByCollege(ids)]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const all = counts.reduce((a, c) => a + c._count._all, 0);
  const filtered = Boolean(q || status);

  return (
    <>
      <PageHeader
        title="Colleges"
        description="Partner colleges, their revenue share and college-admin logins."
        actions={
          <ButtonLink href="/admin/colleges/new" icon={<Plus className="size-4" />}>
            Add college
          </ButtonLink>
        }
      />

      <StatGrid className="mb-6">
        <StatCard label="All colleges" value={formatNumber(all)} icon={<Building2 />} />
        <StatCard label="Active" value={formatNumber(countOf("ACTIVE"))} icon={<CheckCircle2 />} tone="green" />
        <StatCard label="Pending" value={formatNumber(countOf("PENDING"))} icon={<Clock />} tone="amber" />
        <StatCard label="Inactive" value={formatNumber(countOf("INACTIVE"))} icon={<Ban />} tone="gray" />
      </StatGrid>

      <Card>
        <FilterBar>
          <SearchInput placeholder="Search name, code, university, districtâ€¦" />
          <FilterSelect
            param="status"
            placeholder="All statuses"
            label="Filter by status"
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "PENDING", label: "Pending" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
        </FilterBar>

        {colleges.length === 0 ? (
          <EmptyState
            icon={<Building2 />}
            title={filtered ? "No colleges match your filters" : "No colleges yet"}
            description={filtered ? "Try a different search term or status." : "Add your first partner college to start onboarding students."}
            action={
              !filtered && (
                <ButtonLink href="/admin/colleges/new" icon={<Plus className="size-4" />}>
                  Add college
                </ButtonLink>
              )
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>College</TH>
                <TH>University</TH>
                <TH className="text-right">Students</TH>
                <TH className="text-right">Paid</TH>
                <TH className="text-right">Revenue</TH>
                <TH>Share (College / MSY)</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {colleges.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} src={fileUrl(c.logoFileId)} size={36} className="rounded-lg" />
                      <div className="min-w-0">
                        <Link href={`/admin/colleges/${c.id}/edit`} className="font-medium text-slate-900 hover:text-brand-700">
                          {c.name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          <span className="font-mono font-semibold text-slate-600">{c.code}</span>
                          {c.district ? ` Â· ${c.district}` : ""}
                          {c.adminUser ? ` Â· @${c.adminUser.username}` : " Â· no login"}
                        </p>
                      </div>
                    </div>
                  </TD>
                  <TD className="max-w-56 truncate" title={c.university}>
                    {c.university}
                  </TD>
                  <TD className="text-right tabular-nums">{formatNumber(c._count.students)}</TD>
                  <TD className="text-right tabular-nums">{formatNumber(paid.get(c.id) ?? 0)}</TD>
                  <TD className="text-right tabular-nums">{formatINR(revenue.get(c.id) ?? 0)}</TD>
                  <TD className="tabular-nums whitespace-nowrap">
                    {c.collegeShare}% / {c.rknexoraShare}%
                  </TD>
                  <TD>
                    <StatusBadge status={c.status} />
                  </TD>
                  <TD className="text-right whitespace-nowrap">
                    <div className="inline-flex gap-1.5">
                      <ButtonLink href={`/admin/colleges/${c.id}/domain-fees`} variant="ghost" size="xs">
                        Fees{c._count.domainFees ? ` (${c._count.domainFees})` : ""}
                      </ButtonLink>
                      <ButtonLink href={`/admin/colleges/${c.id}/edit`} variant="outline" size="xs">
                        Edit
                      </ButtonLink>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} />
      </Card>
    </>
  );
}
