import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { formatNumber } from "@/lib/format";
import { PageHeader, Alert } from "@/components/ui/page";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { LinkTabs } from "@/components/ui/tabs";
import { AssignTable } from "./assign-table";

export const metadata = { title: "Assign students" };

type SP = Record<string, string | undefined>;

export default async function AssignStudentsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  await requirePageRole("ADMIN");
  const { id } = await params;
  const sp = await searchParams;
  const mentor = await prisma.mentor.findUnique({ where: { id }, include: { domain: true, _count: { select: { students: true } } } });
  if (!mentor) notFound();

  const { page, pageSize, skip, take } = pagination(sp, 25);
  const view = ["unassigned", "mine", "others", "all"].includes(sp.view ?? "") ? sp.view! : "unassigned";
  const q = sp.q?.trim();

  const base: Prisma.StudentWhereInput = { paymentStatus: "PAID", domainId: mentor.domainId };
  const where: Prisma.StudentWhereInput = {
    ...base,
    ...(view === "unassigned" ? { mentorId: null } : view === "mine" ? { mentorId: id } : view === "others" ? { mentorId: { not: null }, NOT: { mentorId: id } } : {}),
    ...(sp.college ? { collegeId: sp.college } : {}),
    ...(sp.session ? { session: sp.session } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { registrationNumber: { contains: q.toUpperCase() } },
            { portalRegNo: { contains: q.toUpperCase() } },
            { mobile: { contains: q } },
            { email: { contains: q.toLowerCase() } },
          ],
        }
      : {}),
  };

  const [total, students, colleges, sessions, unassignedCount, mineCount, othersCount, allCount] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      skip,
      take,
      orderBy: [{ mentorId: { sort: "asc", nulls: "first" } }, { name: "asc" }],
      include: { college: { select: { code: true, name: true } }, mentor: { select: { id: true, name: true, employeeId: true } } },
    }),
    prisma.college.findMany({ where: { students: { some: base } }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.student.findMany({ where: { ...base, session: { not: null } }, select: { session: true }, distinct: ["session"], orderBy: { session: "desc" } }),
    prisma.student.count({ where: { ...base, mentorId: null } }),
    prisma.student.count({ where: { ...base, mentorId: id } }),
    prisma.student.count({ where: { ...base, mentorId: { not: null }, NOT: { mentorId: id } } }),
    prisma.student.count({ where: base }),
  ]);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/mentors", label: "Mentors" }}
        title={`Assign students — ${mentor.name}`}
        description={
          <>
            Paid students of <b className="text-slate-700">{mentor.domain.name}</b> ({mentor.domain.code}) can be assigned to this mentor. Assigning a student who already has a mentor moves them here.
          </>
        }
        actions={
          <ButtonLink href={`/admin/mentors/${id}/edit`} variant="outline" icon={<Pencil className="size-4" />}>
            Edit mentor
          </ButtonLink>
        }
      />
      {!mentor.active && (
        <Alert tone="warning" title="This mentor is inactive" className="mb-5">
          Activate the mentor before assigning new students. You can still remove students.
        </Alert>
      )}
      <StatGrid className="mb-6">
        <StatCard label="Assigned to this mentor" value={formatNumber(mineCount)} tone="brand" />
        <StatCard label="Unassigned in domain" value={formatNumber(unassignedCount)} tone={unassignedCount ? "amber" : "gray"} />
        <StatCard label="With other mentors" value={formatNumber(othersCount)} tone="blue" />
        <StatCard label="Paid students in domain" value={formatNumber(allCount)} tone="green" />
      </StatGrid>

      <Card>
        <LinkTabs
          param="view"
          className="px-3"
          items={[
            { key: "unassigned", label: "Unassigned", count: unassignedCount },
            { key: "mine", label: "Assigned to this mentor", count: mineCount },
            { key: "others", label: "Other mentors", count: othersCount },
            { key: "all", label: "All", count: allCount },
          ]}
        />
        <FilterBar>
          <SearchInput placeholder="Search name, reg. no., mobile, email…" />
          <FilterSelect param="college" placeholder="All colleges" label="Filter by college" options={colleges.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} />
          <FilterSelect param="session" placeholder="All sessions" label="Filter by session" options={sessions.map((s) => ({ value: s.session!, label: s.session! }))} />
        </FilterBar>
        <AssignTable
          key={`${view}-${page}-${students.map((s) => s.id + (s.mentorId ?? "")).join(",")}`}
          mentorId={id}
          mentorActive={mentor.active}
          view={view}
          rows={students.map((s) => ({
            id: s.id,
            name: s.name,
            registrationNumber: s.registrationNumber,
            portalRegNo: s.portalRegNo,
            college: s.college.code,
            session: s.session,
            status: s.status,
            internshipStart: s.internshipStart ? s.internshipStart.toISOString() : null,
            mentor: s.mentor ? { id: s.mentor.id, name: s.mentor.name, employeeId: s.mentor.employeeId } : null,
          }))}
        />
        <Pagination page={page} pageSize={pageSize} total={total} />
      </Card>
    </>
  );
}
