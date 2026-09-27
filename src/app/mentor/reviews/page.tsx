import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { FileCheck2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireMentor } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { SUBMISSION_STATUS, SUBMISSION_STATUS_LABEL, type SubmissionStatus } from "@/lib/constants";
import { formatDate, relativeTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/tabs";
import { FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Submission Reviews" };

const KIND_OPTIONS = [
  { value: "ASSIGNMENT", label: "Assignments" },
  { value: "PROJECT", label: "Live projects" },
  { value: "REPORT", label: "Internship reports" },
];
const KIND_LABEL: Record<string, string> = { ASSIGNMENT: "Assignment", PROJECT: "Live project", REPORT: "Internship report" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { mentor } = await requireMentor();
  const status: SubmissionStatus | "ALL" = sp.tab === "ALL" ? "ALL" : SUBMISSION_STATUS.includes(sp.tab as SubmissionStatus) ? (sp.tab as SubmissionStatus) : "PENDING";
  const { page, pageSize, skip, take } = pagination(sp);
  const q = sp.q?.trim();

  const base: Prisma.SubmissionWhereInput = {
    student: { mentorId: mentor.id, ...(q ? { OR: [{ name: { contains: q } }, { registrationNumber: { contains: q } }, { portalRegNo: { contains: q } }] } : {}) },
    kind: sp.kind && KIND_OPTIONS.some((k) => k.value === sp.kind) ? sp.kind : { in: KIND_OPTIONS.map((k) => k.value) },
  };
  const where: Prisma.SubmissionWhereInput = status === "ALL" ? base : { ...base, status };

  const [counts, allCount, total, rows] = await Promise.all([
    Promise.all(SUBMISSION_STATUS.map((st) => prisma.submission.count({ where: { ...base, status: st } }))),
    prisma.submission.count({ where: base }),
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      orderBy: status === "PENDING" ? [{ submittedAt: "asc" }] : [{ status: "asc" }, { updatedAt: "desc" }],
      skip,
      take,
      include: { student: { select: { id: true, name: true, registrationNumber: true } }, assignment: { select: { title: true, maxMarks: true, dueDate: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader title="Submission Reviews" description="Review assignments, live projects and internship reports from your students. Oldest pending submissions are shown first." />
      <Card>
        <LinkTabs
          className="px-3"
          items={[
            ...SUBMISSION_STATUS.map((st, i) => ({ key: st, label: SUBMISSION_STATUS_LABEL[st], count: counts[i] })),
            { key: "ALL", label: "All", count: allCount },
          ]}
        />
        <FilterBar>
          <SearchInput placeholder="Search student or registration no." />
          <FilterSelect param="kind" placeholder="All types" label="Submission type" options={KIND_OPTIONS} />
        </FilterBar>
        <Table>
          <THead>
            <tr>
              <TH>Submission</TH>
              <TH>Student</TH>
              <TH>Type</TH>
              <TH>Submitted</TH>
              <TH>Status</TH>
              <TH className="text-right">Marks</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={7}>
                <div className="flex flex-col items-center gap-2">
                  <FileCheck2 className="size-8 text-slate-300" />
                  <span>{status === "PENDING" ? "No submissions are waiting for review." : "No submissions found."}</span>
                </div>
              </EmptyRow>
            )}
            {rows.map((s) => (
              <TR key={s.id}>
                <TD>
                  <Link href={`/mentor/reviews/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700">{s.assignment?.title ?? s.title ?? KIND_LABEL[s.kind]}</Link>
                  {s.version > 1 && <Badge className="ml-1.5" tone="violet">v{s.version}</Badge>}
                  {s.assignment && <div className="text-xs text-slate-500">Due {formatDate(s.assignment.dueDate)}</div>}
                </TD>
                <TD>
                  <Link href={`/mentor/students/${s.student.id}`} className="text-slate-800 hover:text-brand-700">{s.student.name}</Link>
                  <div className="text-xs text-slate-500">{s.student.registrationNumber}</div>
                </TD>
                <TD>{KIND_LABEL[s.kind] ?? s.kind}</TD>
                <TD className="whitespace-nowrap text-slate-500" title={formatDate(s.submittedAt)}>{relativeTime(s.submittedAt)}</TD>
                <TD><StatusBadge status={s.status} label={SUBMISSION_STATUS_LABEL[s.status as SubmissionStatus]} /></TD>
                <TD className="text-right tabular-nums">{s.assignment ? (s.marks !== null ? `${s.marks}/${s.assignment.maxMarks}` : "—") : <span className="text-slate-400">n/a</span>}</TD>
                <TD className="text-right">
                  <ButtonLink href={`/mentor/reviews/${s.id}`} size="xs" variant={s.status === "PENDING" ? "primary" : "outline"}>{s.status === "PENDING" ? "Review" : "Open"}</ButtonLink>
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
