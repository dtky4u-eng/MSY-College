import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Ban, ChevronRight, Download, GraduationCap, IndianRupee, PlayCircle, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { fileUrl } from "@/lib/files";
import { formatNumber } from "@/lib/format";
import { STUDENT_STATUS } from "@/lib/constants";
import { ACCESS_STATE_LABEL, accessState, learningPercentMany } from "@/lib/student";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { Avatar } from "@/components/ui/avatar";
import { ProgressBar } from "@/components/ui/progress";
import { ImportStudentsButton } from "@/components/admin/core/students/import-students";
import { collegeOptions, domainOptions, sessionFilterOptions, spValue, studentSearchWhere } from "@/components/admin/core/students/server";

export const metadata = { title: "Students" };

type SP = Record<string, string | string[] | undefined>;

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "BLOCKED", label: "Blocked" },
];

export default async function StudentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePageRole("ADMIN");
  const sp = await searchParams;
  const { page, pageSize, skip, take } = pagination(sp, 20);
  const q = spValue(sp, "q");
  const collegeId = spValue(sp, "college");
  const session = spValue(sp, "session");
  const domainId = spValue(sp, "domain");
  const statusRaw = spValue(sp, "status");
  const status = STUDENT_STATUS.includes(statusRaw as (typeof STUDENT_STATUS)[number]) ? statusRaw : undefined;
  const paymentRaw = spValue(sp, "payment");
  const payment = paymentRaw === "PAID" || paymentRaw === "UNPAID" ? paymentRaw : undefined;

  const where: Prisma.StudentWhereInput = {
    ...(collegeId ? { collegeId } : {}),
    ...(session ? { session } : {}),
    ...(domainId ? { domainId } : {}),
    ...(status ? { status } : {}),
    ...(payment ? { paymentStatus: payment } : {}),
    ...studentSearchWhere(q),
  };

  const [total, students, byStatus, paidCount, colleges, domains, sessions] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      skip,
      take,
      include: {
        college: { select: { name: true, code: true } },
        domain: { select: { name: true, code: true } },
        mentor: { select: { name: true } },
      },
    }),
    prisma.student.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.student.count({ where: { paymentStatus: "PAID" } }),
    collegeOptions(),
    domainOptions(),
    sessionFilterOptions(),
  ]);
  const progress = await learningPercentMany(students.map((s) => ({ id: s.id, domainId: s.domainId })));
  const countOf = (s: string) => byStatus.find((c) => c.status === s)?._count._all ?? 0;
  const all = byStatus.reduce((a, c) => a + c._count._all, 0);
  const filtered = Boolean(q || collegeId || session || domainId || status || payment);

  return (
    <>
      <PageHeader
        title="Students"
        description="Every student record across partner colleges — registration, payment, internship status and progress."
        actions={
          <>
            <ButtonLink href="/api/admin/students/template" external variant="ghost" icon={<Download className="size-4" />}>
              Template
            </ButtonLink>
            <ImportStudentsButton colleges={colleges} defaultCollegeId={collegeId} />
          </>
        }
      />

      <StatGrid className="mb-6">
        <StatCard label="All students" value={formatNumber(all)} icon={<Users />} hint={`${formatNumber(countOf("PENDING"))} pending`} />
        <StatCard label="Fee paid" value={formatNumber(paidCount)} icon={<IndianRupee />} tone="green" hint={all ? `${Math.round((paidCount / all) * 100)}% of students` : undefined} href="/admin/students?payment=PAID" />
        <StatCard label="Active internships" value={formatNumber(countOf("ACTIVE"))} icon={<PlayCircle />} tone="blue" hint={`${formatNumber(countOf("COMPLETED"))} completed`} href="/admin/students?status=ACTIVE" />
        <StatCard label="Blocked" value={formatNumber(countOf("BLOCKED"))} icon={<Ban />} tone="red" href="/admin/students?status=BLOCKED" />
      </StatGrid>

      <Card>
        <FilterBar>
          <SearchInput placeholder="Name, reg. no., portal no., mobile, email…" className="sm:w-80" />
          <FilterSelect param="college" placeholder="All colleges" label="Filter by college" options={colleges} className="max-w-full sm:max-w-64" />
          <FilterSelect param="session" placeholder="All sessions" label="Filter by session" options={sessions} />
          <FilterSelect param="domain" placeholder="All domains" label="Filter by domain" options={domains} className="max-w-full sm:max-w-56" />
          <FilterSelect param="status" placeholder="All statuses" label="Filter by status" options={STATUS_OPTIONS} />
          <FilterSelect
            param="payment"
            placeholder="Any payment"
            label="Filter by payment"
            options={[
              { value: "PAID", label: "Paid" },
              { value: "UNPAID", label: "Unpaid" },
            ]}
          />
          {filtered && (
            <Link href="/admin/students" className="text-sm font-medium text-slate-500 hover:text-brand-600">
              Clear filters
            </Link>
          )}
        </FilterBar>

        {students.length === 0 ? (
          <EmptyState
            icon={<GraduationCap />}
            title={filtered ? "No students match your filters" : "No students yet"}
            description={filtered ? "Try a different search term or clear some filters." : "Import a college's student database from Excel to get started."}
            action={!filtered && <ImportStudentsButton colleges={colleges} />}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Student</TH>
                <TH>College</TH>
                <TH>Domain</TH>
                <TH>Mentor</TH>
                <TH>Status</TH>
                <TH>Payment</TH>
                <TH className="min-w-36">Progress</TH>
                <TH className="text-right">
                  <span className="sr-only">Open</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {students.map((s) => {
                const state = accessState(s);
                const showState = state !== s.status;
                const pct = progress.get(s.id) ?? 0;
                return (
                  <TR key={s.id}>
                    <TD>
                      <div className="flex min-w-56 items-center gap-3">
                        <Avatar name={s.name} src={fileUrl(s.photoFileId)} size={36} />
                        <div className="min-w-0">
                          <Link href={`/admin/students/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                            {s.name}
                          </Link>
                          <p className="font-mono text-xs text-slate-500">
                            {s.registrationNumber}
                            {s.portalRegNo ? <span className="text-brand-600"> · {s.portalRegNo}</span> : null}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD className="max-w-52">
                      <p className="truncate" title={s.college.name}>
                        {s.college.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {s.college.code}
                        {s.session ? ` · ${s.session}` : ""}
                      </p>
                    </TD>
                    <TD className="whitespace-nowrap">{s.domain ? <span title={s.domain.name}>{s.domain.code}</span> : <span className="text-slate-400">—</span>}</TD>
                    <TD className="whitespace-nowrap">{s.mentor?.name ?? <span className="text-slate-400">Not assigned</span>}</TD>
                    <TD>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={s.status} />
                        {showState && <span className="text-xs whitespace-nowrap text-slate-500">{ACCESS_STATE_LABEL[state]}</span>}
                      </div>
                    </TD>
                    <TD>
                      <StatusBadge status={s.paymentStatus} />
                    </TD>
                    <TD>
                      {s.domainId ? <ProgressBar value={pct} size="sm" showLabel tone={pct >= 100 ? "green" : "brand"} /> : <span className="text-xs text-slate-400">No domain</span>}
                    </TD>
                    <TD className="text-right">
                      <ButtonLink href={`/admin/students/${s.id}`} variant="ghost" size="xs" aria-label={`Open ${s.name}`}>
                        View <ChevronRight className="size-3.5" />
                      </ButtonLink>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} />
      </Card>
    </>
  );
}
