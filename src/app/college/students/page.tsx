import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Award, GraduationCap } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCollege } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { attendanceStats, learningPercentMany } from "@/lib/student";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Students & Certificates" };

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "BLOCKED", label: "Blocked" },
];

export default async function CollegeStudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { college } = await requireCollege();
  const { page, pageSize, skip, take } = pagination(sp);
  const q = sp.q?.trim();

  const and: Prisma.StudentWhereInput[] = [];
  if (q)
    and.push({
      OR: [{ name: { contains: q } }, { registrationNumber: { contains: q } }, { portalRegNo: { contains: q } }, { email: { contains: q } }, { mobile: { contains: q } }],
    });
  if (sp.status && STATUS_OPTIONS.some((o) => o.value === sp.status)) and.push({ status: sp.status });
  if (sp.payment === "PAID" || sp.payment === "UNPAID") and.push({ paymentStatus: sp.payment });
  if (sp.domain) and.push({ domainId: sp.domain });
  if (sp.certificate === "1") and.push({ certificate: { is: { revokedAt: null } } });
  const where: Prisma.StudentWhereInput = { collegeId: college.id, AND: and };

  const [total, rows, domains] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: [{ status: "asc" }, { name: "asc" }],
      skip,
      take,
      include: {
        domain: { select: { name: true } },
        mentor: { select: { name: true } },
        certificate: { select: { revokedAt: true } },
      },
    }),
    prisma.domain.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const ids = rows.map((r) => r.id);
  const [progress, attRows] = await Promise.all([
    learningPercentMany(rows.map((r) => ({ id: r.id, domainId: r.domainId }))),
    prisma.attendance.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, date: true, status: true } }),
  ]);
  const attendance = new Map(
    await Promise.all(
      rows.map(async (r) => [r.id, (await attendanceStats(r.id, r.internshipStart, r.internshipEnd, { rows: attRows.filter((a) => a.studentId === r.id) })).percent] as const),
    ),
  );

  return (
    <>
      <PageHeader title="Students & Certificates" description="Search your students, follow their internship progress and download certificates and marksheets." />
      <Card>
        <FilterBar>
          <SearchInput placeholder="Search name, registration no., email or mobile" className="sm:w-80" />
          <FilterSelect param="status" placeholder="All statuses" label="Status" options={STATUS_OPTIONS} />
          <FilterSelect param="domain" placeholder="All domains" label="Domain" options={domains.map((d) => ({ value: d.id, label: d.name }))} />
          <FilterSelect
            param="payment"
            placeholder="Any payment"
            label="Payment"
            options={[
              { value: "PAID", label: "Paid" },
              { value: "UNPAID", label: "Unpaid" },
            ]}
          />
          <FilterSelect param="certificate" placeholder="Any certificate" label="Certificate" options={[{ value: "1", label: "Certificate issued" }]} />
        </FilterBar>
        <Table>
          <THead>
            <tr>
              <TH>Student</TH>
              <TH>Domain</TH>
              <TH>Mentor</TH>
              <TH>Progress</TH>
              <TH className="text-right">Attendance</TH>
              <TH>Payment</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={8}>
                <div className="flex flex-col items-center gap-2">
                  <GraduationCap className="size-8 text-slate-300" />
                  <span>{and.length ? "No students match your filters." : "No students uploaded yet."}</span>
                </div>
              </EmptyRow>
            )}
            {rows.map((s) => {
              const hasCert = s.certificate && !s.certificate.revokedAt;
              return (
                <TR key={s.id}>
                  <TD>
                    <Link href={`/college/students/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700">{s.name}</Link>
                    <div className="text-xs text-slate-500">
                      {s.registrationNumber}
                      {s.portalRegNo && <span className="text-slate-400"> · {s.portalRegNo}</span>}
                    </div>
                  </TD>
                  <TD>{s.domain?.name ?? <span className="text-slate-400">Not selected</span>}</TD>
                  <TD>{s.mentor?.name ?? <span className="text-slate-400">Not assigned</span>}</TD>
                  <TD className="min-w-36"><ProgressBar value={progress.get(s.id) ?? 0} size="sm" showLabel /></TD>
                  <TD className="text-right tabular-nums">{s.internshipStart ? `${attendance.get(s.id) ?? 0}%` : <span className="text-slate-400">—</span>}</TD>
                  <TD><StatusBadge status={s.paymentStatus} /></TD>
                  <TD>
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={s.status} />
                      {hasCert && (
                        <Badge tone="violet">
                          <Award className="size-3" /> Certified
                        </Badge>
                      )}
                    </div>
                  </TD>
                  <TD className="text-right">
                    <ButtonLink href={`/college/students/${s.id}`} size="xs" variant="outline">View</ButtonLink>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        <Pagination page={page} pageSize={pageSize} total={total} />
      </Card>
    </>
  );
}
