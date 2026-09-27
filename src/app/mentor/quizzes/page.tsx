import { ListChecks, Pencil, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireMentor } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Quizzes" };

export default async function MentorQuizzesPage() {
  const { mentor } = await requireMentor();
  const modules = await prisma.module.findMany({
    where: { domainId: mentor.domainId },
    orderBy: { number: "asc" },
    include: {
      chapters: {
        orderBy: { number: "asc" },
        include: { quiz: { include: { _count: { select: { questions: true, attempts: true } } } } },
      },
    },
  });
  const total = modules.reduce((a, m) => a + m.chapters.length, 0);
  const withQuiz = modules.reduce((a, m) => a + m.chapters.filter((c) => c.quiz).length, 0);

  return (
    <>
      <PageHeader title="Quizzes" description={`Chapter quizzes for ${mentor.domain.name}. Each chapter can have one quiz; passing it completes the chapter. ${withQuiz} of ${total} chapters have a quiz.`} />
      {modules.length === 0 ? (
        <Card>
          <EmptyState icon={<ListChecks />} title="No chapters in your domain yet" description="Quizzes can be created once the admin team sets up modules and chapters." />
        </Card>
      ) : (
        <div className="space-y-6">
          {modules.map((m) => (
            <Card key={m.id}>
              <CardHeader title={`Module ${m.number}: ${m.name}`} description={`${m.chapters.filter((c) => c.quiz).length}/${m.chapters.length} chapters with a quiz`} />
              <Table>
                <THead>
                  <tr>
                    <TH>Chapter</TH>
                    <TH>Quiz</TH>
                    <TH className="text-right">Questions</TH>
                    <TH className="text-right">Pass mark</TH>
                    <TH className="text-right">Attempts</TH>
                    <TH>Time limit</TH>
                    <TH className="text-right">Student attempts</TH>
                    <TH />
                  </tr>
                </THead>
                <TBody>
                  {m.chapters.map((c) => (
                    <TR key={c.id}>
                      <TD className="font-medium text-slate-900">{m.number}.{c.number} {c.name}</TD>
                      <TD>{c.quiz ? c.quiz.title : <Badge>No quiz</Badge>}</TD>
                      <TD className="text-right tabular-nums">{c.quiz ? c.quiz._count.questions : "—"}</TD>
                      <TD className="text-right tabular-nums">{c.quiz ? `${c.quiz.passingScore}%` : "—"}</TD>
                      <TD className="text-right tabular-nums">{c.quiz ? c.quiz.attemptsAllowed : "—"}</TD>
                      <TD>{c.quiz ? (c.quiz.timeLimitMinutes ? `${c.quiz.timeLimitMinutes} min` : "Untimed") : "—"}</TD>
                      <TD className="text-right tabular-nums">{c.quiz ? c.quiz._count.attempts : "—"}</TD>
                      <TD className="text-right">
                        {c.quiz ? (
                          <ButtonLink href={`/mentor/quizzes/${c.id}`} size="xs" variant="outline" icon={<Pencil className="size-3.5" />}>Edit</ButtonLink>
                        ) : (
                          <ButtonLink href={`/mentor/quizzes/${c.id}`} size="xs" variant="secondary" icon={<Plus className="size-3.5" />}>Create</ButtonLink>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
