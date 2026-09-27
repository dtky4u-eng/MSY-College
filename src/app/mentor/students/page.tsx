import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireMentor } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { attendanceStats, learningPercentMany } from "@/lib/student";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Assigned Students" };

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PENDING", label: "Pending" },
  { value: "BLOCKED", label: "Blocked" },
];

export default async function MentorStudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { mentor } = await requireMentor();
  const { page, pageSize, skip, take } = pagination(sp);
  const q = sp.q?.trim();
  const and: Prisma.StudentWhereInput[] = [];
  if (q) and.push({ OR: [{ name: { contains: q } }, { registrationNumber: { contains: q } }, { portalRegNo: { contains: q } }, { email: { contains: q } }, { mobile: { contains: q } }] });
  if (sp.status && STATUS_OPTIONS.some((o) => o.value === sp.status)) and.push({ status: sp.status });
  const where: Prisma.StudentWhereInput = { mentorId: mentor.id, AND: and };

  const [total, rows] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({ where, orderBy: [{ status: "asc" }, { name: "asc" }], skip, take, include: { college: { select: { name: true } } } }),
  ]);
  const ids = rows.map((r) => r.id);
  const [progress, attRows, logs] = await Promise.all([
    learningPercentMany(rows.map((r) => ({ id: r.id, domainId: r.domainId }))),
    prisma.attendance.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, date: true, status: true } }),
    prisma.logbookEntry.groupBy({ by: ["studentId"], where: { studentId: { in: ids } }, _sum: { hours: true } }),
  ]);
  const hours = new Map(logs.map((l) => [l.studentId, Math.round((l._sum.hours ?? 0) * 10) / 10]));
  const attendance = new Map(
    await Promise.all(rows.map(async (r) => [r.id, (await attendanceStats(r.id, r.internshipStart, r.internshipEnd, { rows: attRows.filter((a) => a.studentId === r.id) })).percent] as const)),
  );

  return (
    <>
      <PageHeader title="Assigned Students" description={`Students assigned to you for ${mentor.domain.name}.`} />
      <Card>
        <FilterBar>
          <SearchInput placeholder="Search name, registration no., email or mobile" className="sm:w-80" />
          <FilterSelect param="status" placeholder="All statuses" label="Status" options={STATUS_OPTIONS} />
        </FilterBar>
        <Table>
          <THead>
            <tr>
              <TH>Student</TH>
              <TH>College</TH>
              <TH>Internship</TH>
              <TH>Progress</TH>
              <TH className="text-right">Attendance</TH>
              <TH className="text-right">Logbook</TH>
              <TH>Status</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={8}>
                <div className="flex flex-col items-center gap-2">
                  <Users className="size-8 text-slate-300" />
                  <span>{and.length ? "No students match your filters." : "No students have been assigned to you yet."}</span>
                </div>
              </EmptyRow>
            )}
            {rows.map((s) => (
              <TR key={s.id}>
                <TD>
                  <Link href={`/mentor/students/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700">{s.name}</Link>
                  <div className="text-xs text-slate-500">{s.portalRegNo ?? s.registrationNumber}</div>
                </TD>
                <TD className="max-w-56 truncate text-slate-600" title={s.college.name}>{s.college.name}</TD>
                <TD className="whitespace-nowrap text-xs text-slate-500">
                  {s.internshipStart ? `${formatDate(s.internshipStart)} – ${formatDate(s.internshipEnd)}` : "Not scheduled"}
                </TD>
                <TD className="min-w-36"><ProgressBar value={progress.get(s.id) ?? 0} size="sm" showLabel /></TD>
                <TD className="text-right tabular-nums">{s.internshipStart ? `${attendance.get(s.id) ?? 0}%` : "—"}</TD>
                <TD className="text-right tabular-nums">{hours.get(s.id) ?? 0}h</TD>
                <TD><StatusBadge status={s.status} /></TD>
                <TD className="text-right"><ButtonLink href={`/mentor/students/${s.id}`} size="xs" variant="outline">Open</ButtonLink></TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <Pagination page={page} pageSize={pageSize} total={total} />
      </Card>
    </>
  );
}
