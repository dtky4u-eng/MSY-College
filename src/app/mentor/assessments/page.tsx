import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BookOpenCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireMentor } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { learningPercentMany } from "@/lib/student";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/tabs";
import { FilterBar, Pagination, SearchInput } from "@/components/ui/filters";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Student Assessment" };

const ELIGIBLE: Prisma.StudentWhereInput = { paymentStatus: "PAID", internshipStart: { not: null }, status: { in: ["ACTIVE", "COMPLETED"] } };

export default async function AssessmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { mentor } = await requireMentor();
  const { page, pageSize, skip, take } = pagination(sp);
  const filter = sp.filter === "submitted" ? "submitted" : sp.filter === "all" ? "all" : "pending";
  const q = sp.q?.trim();
  const base: Prisma.StudentWhereInput = {
    mentorId: mentor.id,
    ...ELIGIBLE,
    ...(q ? { OR: [{ name: { contains: q } }, { registrationNumber: { contains: q } }, { portalRegNo: { contains: q } }] } : {}),
  };
  const byFilter: Record<string, Prisma.StudentWhereInput> = { pending: { assessment: { is: null } }, submitted: { assessment: { isNot: null } }, all: {} };
  const where = { ...base, ...byFilter[filter] };

  const [pendingCount, submittedCount, total, rows] = await Promise.all([
    prisma.student.count({ where: { ...base, ...byFilter.pending } }),
    prisma.student.count({ where: { ...base, ...byFilter.submitted } }),
    prisma.student.count({ where }),
    prisma.student.findMany({ where, orderBy: [{ internshipEnd: "asc" }, { name: "asc" }], skip, take, include: { assessment: true, college: { select: { name: true } } } }),
  ]);
  const progress = await learningPercentMany(rows.map((r) => ({ id: r.id, domainId: r.domainId })));

  return (
    <>
      <PageHeader title="Student Assessment" description="Rate each student on the assessment criteria, add supervisor remarks and recommend a certificate. Assessments can be edited until results are published." />
      <Card>
        <LinkTabs
          param="filter"
          className="px-3"
          items={[
            { key: "pending", label: "Pending", count: pendingCount },
            { key: "submitted", label: "Submitted", count: submittedCount },
            { key: "all", label: "All", count: pendingCount + submittedCount },
          ]}
        />
        <FilterBar>
          <SearchInput placeholder="Search student or registration no." />
        </FilterBar>
        <Table>
          <THead>
            <tr>
              <TH>Student</TH>
              <TH>Internship ends</TH>
              <TH>Learning</TH>
              <TH>Status</TH>
              <TH>Assessment</TH>
              <TH className="text-right">Score</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={7}>
                <div className="flex flex-col items-center gap-2">
                  <BookOpenCheck className="size-8 text-slate-300" />
                  <span>{filter === "pending" ? "No assessments are pending." : "No students found."}</span>
                </div>
              </EmptyRow>
            )}
            {rows.map((s) => {
              const locked = Boolean(s.resultPublishedAt);
              return (
                <TR key={s.id}>
                  <TD>
                    <Link href={`/mentor/students/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700">{s.name}</Link>
                    <div className="text-xs text-slate-500">{s.college.name}</div>
                  </TD>
                  <TD className="whitespace-nowrap text-slate-600">{formatDate(s.internshipEnd)}</TD>
                  <TD className="min-w-32"><ProgressBar value={progress.get(s.id) ?? 0} size="sm" showLabel /></TD>
                  <TD><StatusBadge status={s.status} /></TD>
                  <TD>
                    {s.assessment ? (
                      <div className="flex flex-wrap gap-1">
                        <Badge tone="green">Submitted {formatDate(s.assessment.updatedAt)}</Badge>
                        {s.assessment.recommendCertificate ? <Badge tone="violet">Certificate recommended</Badge> : <Badge>Not recommended</Badge>}
                      </div>
                    ) : (
                      <Badge tone="amber" dot>Pending</Badge>
                    )}
                  </TD>
                  <TD className="text-right tabular-nums">{s.assessment ? `${s.assessment.score}%` : "—"}</TD>
                  <TD className="text-right">
                    <ButtonLink href={`/mentor/assessments/${s.id}`} size="xs" variant={s.assessment ? "outline" : "primary"}>
                      {locked ? "View" : s.assessment ? "Edit" : "Assess"}
                    </ButtonLink>
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
