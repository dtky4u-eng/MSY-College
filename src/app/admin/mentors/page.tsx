import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus, UserCheck, UserCog, UserX, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { formatNumber } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { Avatar } from "@/components/ui/avatar";

export const metadata = { title: "Mentors" };

type SP = Record<string, string | undefined>;

export default async function MentorsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePageRole("ADMIN");
  const sp = await searchParams;
  const { page, pageSize, skip, take } = pagination(sp, 20);
  const q = sp.q?.trim();
  const status = sp.status === "active" ? true : sp.status === "inactive" ? false : undefined;

  const where: Prisma.MentorWhereInput = {
    ...(sp.domain ? { domainId: sp.domain } : {}),
    ...(status !== undefined ? { active: status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { employeeId: { contains: q.toUpperCase() } },
            { email: { contains: q.toLowerCase() } },
            { mobile: { contains: q } },
            { user: { username: { contains: q.toLowerCase() } } },
          ],
        }
      : {}),
  };

  const [total, mentors, domains, activeCount, allCount, unassignedPaid] = await Promise.all([
    prisma.mentor.count({ where }),
    prisma.mentor.findMany({
      where,
      skip,
      take,
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        domain: { select: { code: true, name: true } },
        college: { select: { code: true, name: true } },
        user: { select: { username: true, lastLoginAt: true } },
        _count: { select: { students: true } },
      },
    }),
    prisma.domain.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.mentor.count({ where: { active: true } }),
    prisma.mentor.count(),
    prisma.student.count({ where: { paymentStatus: "PAID", mentorId: null, status: { notIn: ["COMPLETED", "BLOCKED"] } } }),
  ]);

  const activeByMentor = mentors.length
    ? await prisma.student.groupBy({
        by: ["mentorId"],
        _count: { _all: true },
        where: { mentorId: { in: mentors.map((m) => m.id) }, status: "ACTIVE" },
      })
    : [];
  const activeMap = new Map(activeByMentor.map((r) => [r.mentorId, r._count._all]));
  const assignedTotal = await prisma.student.count({ where: { mentorId: { not: null } } });
  const filtered = Boolean(q || sp.domain || sp.status);

  return (
    <>
      <PageHeader
        title="Mentors"
        description="Domain mentors, their logins and assigned students."
        actions={
          <ButtonLink href="/admin/mentors/new" icon={<Plus className="size-4" />}>
            Add mentor
          </ButtonLink>
        }
      />

      <StatGrid className="mb-6">
        <StatCard label="All mentors" value={formatNumber(allCount)} icon={<UserCog />} />
        <StatCard label="Active mentors" value={formatNumber(activeCount)} icon={<UserCheck />} tone="green" />
        <StatCard label="Students assigned" value={formatNumber(assignedTotal)} icon={<Users />} tone="blue" />
        <StatCard label="Paid students without mentor" value={formatNumber(unassignedPaid)} icon={<UserX />} tone={unassignedPaid ? "amber" : "gray"} />
      </StatGrid>

      <Card>
        <FilterBar>
          <SearchInput placeholder="Search name, employee ID, email…" />
          <FilterSelect param="domain" placeholder="All domains" label="Filter by domain" options={domains.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))} />
          <FilterSelect
            param="status"
            placeholder="Any status"
            label="Filter by status"
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </FilterBar>

        {mentors.length === 0 ? (
          <EmptyState
            icon={<UserCog />}
            title={filtered ? "No mentors match your filters" : "No mentors yet"}
            description={filtered ? "Try a different search term, domain or status." : "Add mentors for each domain, then assign paid students to them."}
            action={
              !filtered && (
                <ButtonLink href="/admin/mentors/new" icon={<Plus className="size-4" />}>
                  Add mentor
                </ButtonLink>
              )
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Mentor</TH>
                <TH>Domain</TH>
                <TH>College</TH>
                <TH>Contact</TH>
                <TH className="text-right">Assigned</TH>
                <TH className="text-right">Active</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {mentors.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} src={m.photoUrl} size={36} />
                      <div className="min-w-0">
                        <Link href={`/admin/mentors/${m.id}/edit`} className="font-medium text-slate-900 hover:text-brand-700">
                          {m.name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          <span className="font-mono">{m.employeeId}</span> · @{m.user.username}
                          {m.designation ? ` · ${m.designation}` : ""}
                        </p>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <Badge tone="brand">{m.domain.code}</Badge>
                    <div className="mt-0.5 text-xs text-slate-500">{m.domain.name}</div>
                  </TD>
                  <TD className="text-slate-600">{m.college ? m.college.code : <span className="text-slate-400">—</span>}</TD>
                  <TD className="text-xs text-slate-600">
                    <div>{m.email ?? "—"}</div>
                    <div>{m.mobile ?? ""}</div>
                  </TD>
                  <TD className="text-right tabular-nums">{formatNumber(m._count.students)}</TD>
                  <TD className="text-right tabular-nums">{formatNumber(activeMap.get(m.id) ?? 0)}</TD>
                  <TD>
                    <StatusBadge status={m.active ? "ACTIVE" : "INACTIVE"} />
                  </TD>
                  <TD className="text-right whitespace-nowrap">
                    <div className="inline-flex gap-1.5">
                      <ButtonLink href={`/admin/mentors/${m.id}/assign-students`} variant="secondary" size="xs">
                        Assign students
                      </ButtonLink>
                      <ButtonLink href={`/admin/mentors/${m.id}/edit`} variant="outline" size="xs">
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
