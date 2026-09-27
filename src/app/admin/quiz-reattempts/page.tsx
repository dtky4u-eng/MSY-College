import type { Prisma } from "@prisma/client";
import { History, RotateCcw, ShieldCheck, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkTabs } from "@/components/ui/tabs";
import { FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { collegeOptions, domainOptions, sp1 } from "@/components/admin/ops/lookups";
import { GrantButton } from "./grant-button";

export const metadata = { title: "Quiz Reattempts" };

interface ExhaustedRow {
  key: string;
  studentId: string;
  studentName: string;
  regNo: string;
  college: string;
  domain: string;
  quizId: string;
  quizTitle: string;
  chapter: string;
  used: number;
  allowed: number;
  extra: number;
  best: number | null;
  lastAt: Date | null;
}

export default async function QuizReattemptsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageRole("ADMIN");
  const sp = await searchParams;
  const tab = sp1(sp, "tab") ?? "exhausted";
  const q = sp1(sp, "q");
  const domain = sp1(sp, "domain");
  const college = sp1(sp, "college");
  const { page, pageSize, skip, take } = pagination(sp, 20);

  const studentWhere: Prisma.StudentWhereInput = {
    ...(domain ? { domainId: domain } : {}),
    ...(college ? { collegeId: college } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { registrationNumber: { contains: q } }, { portalRegNo: { contains: q } }] } : {}),
  };

  // Exhausted = not passed, no open attempt and used ≥ allowed + granted extra.
  const [attempts, grantsAgg, domains, colleges, totalGrants, grantsLast30] = await Promise.all([
    prisma.quizAttempt.findMany({ where: { student: studentWhere }, select: { studentId: true, quizId: true, submittedAt: true, expiresAt: true, passed: true, percent: true, startedAt: true } }),
    prisma.quizReattemptGrant.groupBy({ by: ["studentId", "quizId"], where: { student: studentWhere }, _sum: { extraAttempts: true } }),
    domainOptions(),
    collegeOptions(),
    prisma.quizReattemptGrant.count(),
    prisma.quizReattemptGrant.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } } }),
  ]);
  const now = new Date();
  const extraMap = new Map(grantsAgg.map((g) => [`${g.studentId}:${g.quizId}`, g._sum.extraAttempts ?? 0]));
  const groups = new Map<string, { studentId: string; quizId: string; used: number; passed: boolean; open: boolean; best: number | null; lastAt: Date | null }>();
  for (const a of attempts) {
    const k = `${a.studentId}:${a.quizId}`;
    const g = groups.get(k) ?? { studentId: a.studentId, quizId: a.quizId, used: 0, passed: false, open: false, best: null, lastAt: null };
    const expired = a.expiresAt && a.expiresAt <= now;
    if (a.submittedAt || expired) g.used++;
    else g.open = true;
    if (a.passed) g.passed = true;
    if (a.submittedAt) g.best = Math.max(g.best ?? 0, a.percent);
    const at = a.submittedAt ?? a.startedAt;
    if (!g.lastAt || at > g.lastAt) g.lastAt = at;
    groups.set(k, g);
  }
  const quizIds = [...new Set([...groups.values()].map((g) => g.quizId))];
  const quizzes = await prisma.quiz.findMany({ where: { id: { in: quizIds } }, select: { id: true, title: true, attemptsAllowed: true, chapter: { select: { number: true, name: true, module: { select: { number: true } } } } } });
  const quizMap = new Map(quizzes.map((x) => [x.id, x]));
  const exhaustedGroups = [...groups.entries()].filter(([k, g]) => {
    const quiz = quizMap.get(g.quizId);
    return quiz && !g.passed && !g.open && g.used >= quiz.attemptsAllowed + (extraMap.get(k) ?? 0);
  });
  exhaustedGroups.sort((a, b) => (b[1].lastAt?.getTime() ?? 0) - (a[1].lastAt?.getTime() ?? 0));

  let exhaustedRows: ExhaustedRow[] = [];
  const exhaustedStudents = new Set(exhaustedGroups.map(([, g]) => g.studentId)).size;
  if (tab === "exhausted") {
    const slice = exhaustedGroups.slice(skip, skip + take);
    const students = await prisma.student.findMany({
      where: { id: { in: slice.map(([, g]) => g.studentId) } },
      select: { id: true, name: true, registrationNumber: true, portalRegNo: true, college: { select: { name: true } }, domain: { select: { name: true } } },
    });
    const sMap = new Map(students.map((s) => [s.id, s]));
    exhaustedRows = slice.map(([k, g]) => {
      const s = sMap.get(g.studentId)!;
      const quiz = quizMap.get(g.quizId)!;
      return {
        key: k,
        studentId: g.studentId,
        studentName: s?.name ?? "—",
        regNo: s?.portalRegNo ?? s?.registrationNumber ?? "—",
        college: s?.college.name ?? "—",
        domain: s?.domain?.name ?? "—",
        quizId: g.quizId,
        quizTitle: quiz.title,
        chapter: `M${quiz.chapter.module.number} · Ch ${quiz.chapter.number}: ${quiz.chapter.name}`,
        used: g.used,
        allowed: quiz.attemptsAllowed,
        extra: extraMap.get(k) ?? 0,
        best: g.best,
        lastAt: g.lastAt,
      };
    });
  }

  const historyWhere: Prisma.QuizReattemptGrantWhereInput = { student: studentWhere };
  const [history, historyTotal] =
    tab === "history"
      ? await Promise.all([
          prisma.quizReattemptGrant.findMany({
            where: historyWhere,
            orderBy: { createdAt: "desc" },
            skip,
            take,
            include: {
              student: { select: { name: true, registrationNumber: true, portalRegNo: true, college: { select: { name: true } } } },
              quiz: { select: { title: true, chapter: { select: { number: true, name: true } } } },
            },
          }),
          prisma.quizReattemptGrant.count({ where: historyWhere }),
        ])
      : [[], 0];
  const granters = await prisma.user.findMany({ where: { id: { in: [...new Set(history.map((h) => h.grantedById))] } }, select: { id: true, username: true, role: true } });
  const granter = new Map(granters.map((u) => [u.id, u]));

  return (
    <>
      <PageHeader title="Quiz Reattempts" description="Students across all colleges who have used every quiz attempt without passing. Grant extra attempts with a reason; the student is notified and the grant is audited." />
      <StatGrid className="mb-6">
        <StatCard label="Exhausted quizzes" value={formatNumber(exhaustedGroups.length)} hint="Matching the filters" icon={<RotateCcw />} tone="amber" />
        <StatCard label="Students affected" value={formatNumber(exhaustedStudents)} icon={<Users />} tone="red" />
        <StatCard label="Grants (30 days)" value={formatNumber(grantsLast30)} icon={<ShieldCheck />} tone="green" />
        <StatCard label="Grants (all time)" value={formatNumber(totalGrants)} icon={<History />} />
      </StatGrid>
      <Card>
        <LinkTabs
          className="px-3"
          items={[
            { key: "exhausted", label: "Attempts exhausted", count: exhaustedGroups.length },
            { key: "history", label: "Grant history" },
          ]}
        />
        <FilterBar>
          <SearchInput placeholder="Student name or reg. no.…" />
          <FilterSelect param="domain" placeholder="All domains" label="Domain" options={domains} />
          <FilterSelect param="college" placeholder="All colleges" label="College" options={colleges} className="max-w-[240px]" />
        </FilterBar>

        {tab === "exhausted" ? (
          exhaustedGroups.length === 0 ? (
            <EmptyState icon={<ShieldCheck />} title="No students are blocked on a quiz" description="Students who use every attempt without passing a chapter quiz will appear here." />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Student</TH>
                    <TH>College · Domain</TH>
                    <TH>Quiz</TH>
                    <TH className="text-center">Attempts</TH>
                    <TH className="text-right">Best score</TH>
                    <TH>Last attempt</TH>
                    <TH className="text-right">Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {exhaustedRows.map((r) => (
                    <TR key={r.key}>
                      <TD>
                        <p className="font-medium text-slate-900">{r.studentName}</p>
                        <p className="text-xs text-slate-500">{r.regNo}</p>
                      </TD>
                      <TD className="max-w-[220px] text-xs">
                        <p className="truncate text-sm text-slate-800">{r.college}</p>
                        <p className="text-slate-500">{r.domain}</p>
                      </TD>
                      <TD className="max-w-[260px]">
                        <p className="font-medium text-slate-800">{r.quizTitle}</p>
                        <p className="truncate text-xs text-slate-500">{r.chapter}</p>
                      </TD>
                      <TD className="text-center whitespace-nowrap tabular-nums">
                        {r.used} / {r.allowed}
                        {r.extra > 0 && <Badge tone="violet" className="ml-1">+{r.extra}</Badge>}
                      </TD>
                      <TD className="text-right tabular-nums">{r.best === null ? "—" : `${Math.round(r.best)}%`}</TD>
                      <TD className="text-xs whitespace-nowrap text-slate-500">{r.lastAt ? relativeTime(r.lastAt) : "—"}</TD>
                      <TD className="text-right">
                        <GrantButton studentId={r.studentId} quizId={r.quizId} studentName={r.studentName} quizTitle={r.quizTitle} used={r.used} allowed={r.allowed + r.extra} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <Pagination page={page} pageSize={pageSize} total={exhaustedGroups.length} />
            </>
          )
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Granted</TH>
                  <TH>Student</TH>
                  <TH>Quiz</TH>
                  <TH className="text-center">Extra</TH>
                  <TH>Reason</TH>
                  <TH>Granted by</TH>
                </TR>
              </THead>
              <TBody>
                {history.length === 0 && <EmptyRow colSpan={6}>No reattempts have been granted yet.</EmptyRow>}
                {history.map((h) => {
                  const u = granter.get(h.grantedById);
                  return (
                    <TR key={h.id}>
                      <TD className="text-xs whitespace-nowrap">{formatDateTime(h.createdAt)}</TD>
                      <TD>
                        <p className="font-medium text-slate-900">{h.student.name}</p>
                        <p className="text-xs text-slate-500">
                          {h.student.portalRegNo ?? h.student.registrationNumber} · {h.student.college.name}
                        </p>
                      </TD>
                      <TD className="max-w-[240px]">
                        <p className="text-slate-800">{h.quiz.title}</p>
                        <p className="truncate text-xs text-slate-500">
                          Ch {h.quiz.chapter.number}: {h.quiz.chapter.name}
                        </p>
                      </TD>
                      <TD className="text-center tabular-nums">+{h.extraAttempts}</TD>
                      <TD className="max-w-[280px] text-sm text-slate-600">{h.reason ?? "—"}</TD>
                      <TD className="text-sm">
                        {u?.username ?? "—"}
                        {u && <Badge tone={u.role === "ADMIN" ? "brand" : "teal"} className="ml-1.5">{u.role === "ADMIN" ? "Admin" : u.role === "MENTOR" ? "Mentor" : u.role}</Badge>}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={historyTotal} />
          </>
        )}
      </Card>
    </>
  );
}
