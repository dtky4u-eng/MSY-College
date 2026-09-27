import Link from "next/link";
import { CheckCircle2, History, RotateCcw } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireMentor } from "@/lib/auth";
import { formatDateTime, relativeTime } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { exhaustedQuizzes } from "../_lib/scope";
import { GrantButton } from "./grant-button";

export const metadata = { title: "Quiz Reattempts" };

export default async function QuizReattemptsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { mentor } = await requireMentor();
  const studentFilter = sp.student ? await prisma.student.findFirst({ where: { id: sp.student, mentorId: mentor.id }, select: { id: true, name: true } }) : null;
  const [items, grants] = await Promise.all([
    exhaustedQuizzes(mentor, studentFilter ? { studentId: studentFilter.id } : {}),
    prisma.quizReattemptGrant.findMany({
      where: { student: { mentorId: mentor.id } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { student: { select: { id: true, name: true } }, quiz: { select: { title: true, chapter: { select: { number: true, name: true, module: { select: { number: true } } } } } } },
    }),
  ]);
  const granters = await prisma.user.findMany({ where: { id: { in: [...new Set(grants.map((g) => g.grantedById))] } }, select: { id: true, role: true, mentor: { select: { name: true } } } });
  const gMap = new Map(granters.map((u) => [u.id, u.mentor?.name ?? (u.role === "ADMIN" ? "MSY College Admin" : "—")]));

  return (
    <>
      <PageHeader title="Quiz Reattempts" description="Assigned students who used every quiz attempt without passing. Grant 1–3 extra attempts so they can continue their learning path." />

      <Card>
        <CardHeader
          title="Attempts exhausted"
          description={studentFilter ? `Showing ${studentFilter.name}` : `${items.length} student quiz${items.length === 1 ? "" : "zes"} waiting`}
          icon={<RotateCcw className="size-5" />}
          actions={studentFilter ? <ButtonLink href="/mentor/quiz-reattempts" size="sm" variant="outline">Show all students</ButtonLink> : undefined}
        />
        {items.length === 0 ? (
          <EmptyState icon={<CheckCircle2 />} title="Nothing to grant" description="No assigned student is currently blocked on a quiz." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Student</TH>
                <TH>Chapter quiz</TH>
                <TH className="text-right">Attempts used</TH>
                <TH className="text-right">Best score</TH>
                <TH>Last attempt</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {items.map((e) => (
                <TR key={`${e.student.id}-${e.quiz.id}`}>
                  <TD>
                    <Link href={`/mentor/students/${e.student.id}`} className="font-medium text-slate-900 hover:text-brand-700">{e.student.name}</Link>
                    <div className="text-xs text-slate-500">{e.student.registrationNumber}</div>
                  </TD>
                  <TD>
                    <p className="font-medium text-slate-800">{e.quiz.title}</p>
                    <p className="text-xs text-slate-500">Chapter {e.chapter.moduleNumber}.{e.chapter.number} {e.chapter.name}</p>
                  </TD>
                  <TD className="text-right tabular-nums">
                    {e.info.attemptsUsed} / {e.info.attemptsAllowed + e.info.extraAttempts}
                    {e.info.extraAttempts > 0 && <div className="text-xs text-slate-500">incl. {e.info.extraAttempts} granted</div>}
                  </TD>
                  <TD className="text-right tabular-nums">
                    <Badge tone="red">{e.info.bestPercent ?? 0}%</Badge>
                    <div className="text-xs text-slate-500">pass {e.info.passingScore}%</div>
                  </TD>
                  <TD className="whitespace-nowrap text-slate-500">{e.lastAttemptAt ? relativeTime(e.lastAttemptAt) : "—"}</TD>
                  <TD className="text-right">
                    <GrantButton studentId={e.student.id} studentName={e.student.name} quizId={e.quiz.id} quizTitle={e.quiz.title} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Grant history" description="Recent reattempts granted to your students" icon={<History className="size-5" />} />
        <Table>
          <THead>
            <tr>
              <TH>Granted</TH>
              <TH>Student</TH>
              <TH>Quiz</TH>
              <TH className="text-right">Extra attempts</TH>
              <TH>Reason</TH>
              <TH>Granted by</TH>
            </tr>
          </THead>
          <TBody>
            {grants.length === 0 && <EmptyRow colSpan={6}>No reattempts have been granted yet.</EmptyRow>}
            {grants.map((g) => (
              <TR key={g.id}>
                <TD className="whitespace-nowrap text-slate-500">{formatDateTime(g.createdAt)}</TD>
                <TD><Link href={`/mentor/students/${g.student.id}`} className="font-medium text-slate-900 hover:text-brand-700">{g.student.name}</Link></TD>
                <TD>
                  {g.quiz.title}
                  <div className="text-xs text-slate-500">Chapter {g.quiz.chapter.module.number}.{g.quiz.chapter.number} {g.quiz.chapter.name}</div>
                </TD>
                <TD className="text-right tabular-nums">+{g.extraAttempts}</TD>
                <TD className="max-w-72 text-slate-600">{g.reason ?? "—"}</TD>
                <TD className="text-slate-600">{gMap.get(g.grantedById) ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
