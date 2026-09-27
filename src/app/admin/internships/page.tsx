import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { CalendarClock, CheckCircle2, Hourglass, PlayCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { fileUrl } from "@/lib/files";
import { addDays, formatNumber, istDate, toISTDateString } from "@/lib/format";
import { getInternshipSettings } from "@/lib/settings";
import { learningPercentMany } from "@/lib/student";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { LinkTabs } from "@/components/ui/tabs";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { collegeOptions, domainOptions, sessionFilterOptions, spValue, studentSearchWhere } from "@/components/admin/core/students/server";
import { InternshipTable, type InternshipRow, type InternshipTab } from "./internship-table";

export const metadata = { title: "Internships" };

type SP = Record<string, string | string[] | undefined>;

const TAB_KEYS: InternshipTab[] = ["awaiting", "scheduled", "active", "completed"];

export default async function InternshipsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePageRole("ADMIN");
  const sp = await searchParams;
  const tabRaw = spValue(sp, "tab") as InternshipTab | undefined;
  const tab: InternshipTab = tabRaw && TAB_KEYS.includes(tabRaw) ? tabRaw : "awaiting";
  const { page, pageSize, skip, take } = pagination(sp, 25);
  const q = spValue(sp, "q");
  const collegeId = spValue(sp, "college");
  const domainId = spValue(sp, "domain");
  const session = spValue(sp, "session");

  const today = toISTDateString();
  const tomorrow = istDate(addDays(today, 1));
  const open = { notIn: ["BLOCKED", "COMPLETED"] };
  const tabWhere: Record<InternshipTab, Prisma.StudentWhereInput> = {
    awaiting: { paymentStatus: "PAID", internshipStart: null, status: open },
    scheduled: { paymentStatus: "PAID", internshipStart: { gte: tomorrow }, status: open },
    active: { internshipStart: { lt: tomorrow }, status: "ACTIVE" },
    completed: { status: "COMPLETED" },
  };
  const orderBy: Record<InternshipTab, Prisma.StudentOrderByWithRelationInput[]> = {
    awaiting: [{ registeredAt: "asc" }, { name: "asc" }],
    scheduled: [{ internshipStart: "asc" }, { name: "asc" }],
    active: [{ internshipEnd: "asc" }, { name: "asc" }],
    completed: [{ completedAt: "desc" }, { name: "asc" }],
  };
  const base: Prisma.StudentWhereInput = {
    ...(collegeId ? { collegeId } : {}),
    ...(domainId ? { domainId } : {}),
    ...(session ? { session } : {}),
    ...studentSearchWhere(q),
  };
  const where: Prisma.StudentWhereInput = { AND: [base, tabWhere[tab]] };

  const [counts, total, students, settings, colleges, domains, sessions] = await Promise.all([
    Promise.all(TAB_KEYS.map((k) => prisma.student.count({ where: { AND: [base, tabWhere[k]] } }))),
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: orderBy[tab],
      skip,
      take,
      include: {
        college: { select: { name: true, code: true } },
        domain: { select: { name: true, code: true } },
        mentor: { select: { name: true } },
        payments: { where: { status: "SUCCESS" }, orderBy: { paidAt: "desc" }, take: 1, select: { paidAt: true } },
      },
    }),
    getInternshipSettings(),
    collegeOptions(),
    domainOptions(),
    sessionFilterOptions(),
  ]);
  const progress = tab === "active" || tab === "completed" ? await learningPercentMany(students.map((s) => ({ id: s.id, domainId: s.domainId }))) : new Map<string, number>();
  const countOf = (k: InternshipTab) => counts[TAB_KEYS.indexOf(k)] ?? 0;

  const rows: InternshipRow[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    registrationNumber: s.registrationNumber,
    portalRegNo: s.portalRegNo,
    photoUrl: fileUrl(s.photoFileId),
    college: s.college.name,
    collegeCode: s.college.code,
    session: s.session,
    domain: s.domain?.name ?? null,
    domainCode: s.domain?.code ?? null,
    hasDomain: Boolean(s.domainId),
    mentor: s.mentor?.name ?? null,
    start: s.internshipStart ? toISTDateString(s.internshipStart) : null,
    end: s.internshipEnd ? toISTDateString(s.internshipEnd) : null,
    paidAt: s.payments[0]?.paidAt?.toISOString() ?? s.registeredAt?.toISOString() ?? null,
    completedAt: s.completedAt?.toISOString() ?? null,
    progress: progress.get(s.id) ?? null,
  }));
  const filtered = Boolean(q || collegeId || domainId || session);

  return (
    <>
      <PageHeader
        title="Internships"
        description={`Schedule internship start dates for paid students, singly or in bulk. The default duration is ${settings.defaultWeeks} weeks.`}
      />

      <StatGrid className="mb-6">
        <StatCard label="Awaiting start" value={formatNumber(countOf("awaiting"))} icon={<Hourglass />} tone="amber" hint="Paid, no start date" />
        <StatCard label="Scheduled" value={formatNumber(countOf("scheduled"))} icon={<CalendarClock />} tone="blue" hint="Starting after today" />
        <StatCard label="Active" value={formatNumber(countOf("active"))} icon={<PlayCircle />} tone="green" hint="Internship in progress" />
        <StatCard label="Completed" value={formatNumber(countOf("completed"))} icon={<CheckCircle2 />} tone="brand" />
      </StatGrid>
      {filtered && <p className="-mt-3 mb-4 text-xs text-slate-500">Counts reflect the current filters.</p>}

      <Card>
        <LinkTabs
          className="px-3"
          items={[
            { key: "awaiting", label: "Awaiting start", count: countOf("awaiting") },
            { key: "scheduled", label: "Scheduled", count: countOf("scheduled") },
            { key: "active", label: "Active", count: countOf("active") },
            { key: "completed", label: "Completed", count: countOf("completed") },
          ]}
        />
        <FilterBar>
          <SearchInput placeholder="Name, reg. no., portal no., mobile, email…" className="sm:w-80" />
          <FilterSelect param="college" placeholder="All colleges" label="Filter by college" options={colleges} className="max-w-full sm:max-w-64" />
          <FilterSelect param="domain" placeholder="All domains" label="Filter by domain" options={domains} className="max-w-full sm:max-w-56" />
          <FilterSelect param="session" placeholder="All sessions" label="Filter by session" options={sessions} />
          {filtered && (
            <Link href={`/admin/internships?tab=${tab}`} className="text-sm font-medium text-slate-500 hover:text-brand-600">
              Clear filters
            </Link>
          )}
        </FilterBar>
        <InternshipTable key={`${tab}-${page}`} rows={rows} tab={tab} defaultWeeks={settings.defaultWeeks} today={today} filtered={filtered} />
        <Pagination page={page} pageSize={pageSize} total={total} />
      </Card>
    </>
  );
}
