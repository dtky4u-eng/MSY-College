import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCollege } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { formatDate, formatINR, relativeTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/tabs";
import { FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { STEP_NAME } from "../_lib/finance";

export const metadata = { title: "Student Registrations" };

type Stage = "not_started" | "in_progress" | "awaiting_payment" | "registered";

const STAGES: { key: Stage; label: string; where: Prisma.StudentWhereInput }[] = [
  { key: "not_started", label: "Not started", where: { paymentStatus: "UNPAID", registrationLocked: false, nextStep: { lte: 1 } } },
  { key: "in_progress", label: "In progress", where: { paymentStatus: "UNPAID", registrationLocked: false, nextStep: { gte: 2 } } },
  { key: "awaiting_payment", label: "Awaiting payment", where: { paymentStatus: "UNPAID", registrationLocked: true } },
  { key: "registered", label: "Registered", where: { paymentStatus: "PAID" } },
];

export default async function RegistrationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { college } = await requireCollege();
  const stage = STAGES.find((s) => s.key === sp.tab) ?? STAGES[0]!;
  const { page, pageSize, skip, take } = pagination(sp);
  const q = sp.q?.trim();

  const base: Prisma.StudentWhereInput = { collegeId: college.id };
  const filters: Prisma.StudentWhereInput[] = [];
  if (q) filters.push({ OR: [{ name: { contains: q } }, { registrationNumber: { contains: q.toUpperCase() } }, { email: { contains: q.toLowerCase() } }, { mobile: { contains: q } }] });
  if (sp.domain) filters.push({ domainId: sp.domain });
  const scoped: Prisma.StudentWhereInput = { ...base, AND: filters };
  const where: Prisma.StudentWhereInput = { ...scoped, ...stage.where };

  const [counts, total, rows, domains] = await Promise.all([
    Promise.all(STAGES.map((s) => prisma.student.count({ where: { ...scoped, ...s.where } }))),
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: stage.key === "registered" ? { registeredAt: "desc" } : { updatedAt: "desc" },
      skip,
      take,
      include: {
        domain: { select: { name: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, amount: true, createdAt: true, failureReason: true } },
      },
    }),
    prisma.domain.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader title="Student Registrations" description="Track the registration status of every student uploaded by your college." />
      <Card>
        <LinkTabs className="px-3" items={STAGES.map((s, i) => ({ key: s.key, label: s.label, count: counts[i] }))} />
        <FilterBar>
          <SearchInput placeholder="Search name, registration no., email, mobile" className="sm:w-80" />
          <FilterSelect param="domain" placeholder="All domains" label="Domain" options={domains.map((d) => ({ value: d.id, label: d.name }))} />
        </FilterBar>
        <Table>
          <THead>
            <tr>
              <TH>Student</TH>
              <TH>Programme</TH>
              <TH>Domain</TH>
              <TH>{stage.key === "registered" ? "MSY College No." : "Stage"}</TH>
              <TH>{stage.key === "registered" ? "Registered on" : stage.key === "awaiting_payment" ? "Last payment attempt" : "Progress"}</TH>
              <TH>Last activity</TH>
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <EmptyRow colSpan={6}>
                <div className="flex flex-col items-center gap-2">
                  <ClipboardCheck className="size-8 text-slate-300" />
                  <span>{q || sp.domain ? "No students match your filters." : `No students in “${stage.label}”.`}</span>
                </div>
              </EmptyRow>
            )}
            {rows.map((s) => {
              const last = s.payments[0];
              const stepPct = Math.round((Math.min(6, Math.max(1, s.nextStep)) - 1) / 5 * 100);
              return (
                <TR key={s.id}>
                  <TD>
                    <Link href={`/college/students/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700">{s.name}</Link>
                    <div className="text-xs text-slate-500">{s.registrationNumber}</div>
                  </TD>
                  <TD className="text-slate-600">
                    {s.programme ?? "—"}
                    {s.session && <div className="text-xs text-slate-400">Session {s.session}</div>}
                  </TD>
                  <TD>{s.domain?.name ?? <span className="text-slate-400">Not selected</span>}</TD>
                  <TD>
                    {stage.key === "registered" ? (
                      <span className="font-mono text-xs text-slate-700">{s.portalRegNo ?? "—"}</span>
                    ) : stage.key === "not_started" ? (
                      <Badge tone="gray">Not started</Badge>
                    ) : stage.key === "awaiting_payment" ? (
                      <Badge tone="amber" dot>Awaiting payment</Badge>
                    ) : (
                      <Badge tone="blue" dot>Step {s.nextStep} · {STEP_NAME[s.nextStep] ?? "In progress"}</Badge>
                    )}
                  </TD>
                  <TD className="min-w-40">
                    {stage.key === "registered" ? (
                      <span className="whitespace-nowrap">{formatDate(s.registeredAt)}</span>
                    ) : stage.key === "awaiting_payment" ? (
                      last ? (
                        <div>
                          <StatusBadge status={last.status} />
                          <div className="mt-0.5 text-xs text-slate-500">
                            {formatINR(last.amount)} · {formatDate(last.createdAt)}
                          </div>
                          {last.failureReason && <div className="text-xs text-rose-600">{last.failureReason}</div>}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">No attempt yet{s.feeAmount ? ` · fee ${formatINR(s.feeAmount)}` : ""}</span>
                      )
                    ) : (
                      <ProgressBar value={stepPct} size="sm" showLabel />
                    )}
                  </TD>
                  <TD className="whitespace-nowrap text-slate-500" title={formatDate(s.updatedAt)}>{relativeTime(s.updatedAt)}</TD>
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
