import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireMentor } from "@/lib/auth";
import { parseJson } from "@/lib/json";
import { PageHeader } from "@/components/ui/page";
import { QuizEditor, type QuizDraft } from "./quiz-editor";

export const metadata = { title: "Quiz Editor" };

export default async function QuizEditorPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;
  const { mentor } = await requireMentor();
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, module: { domainId: mentor.domainId } },
    include: { module: true, quiz: { include: { questions: { orderBy: { sort: "asc" } }, _count: { select: { attempts: true } } } } },
  });
  if (!chapter) notFound();
  const q = chapter.quiz;
  const draft: QuizDraft = {
    id: q?.id ?? null,
    title: q?.title ?? `${chapter.name} — Quiz`,
    description: q?.description ?? "",
    passingScore: String(q?.passingScore ?? 60),
    attemptsAllowed: String(q?.attemptsAllowed ?? 3),
    timeLimitMinutes: q?.timeLimitMinutes ? String(q.timeLimitMinutes) : "",
    randomize: q?.randomize ?? false,
    showResult: q?.showResult ?? true,
    questions: (q?.questions ?? []).map((x) => ({
      key: x.id,
      id: x.id,
      text: x.text,
      options: parseJson<string[]>(x.options, ["", ""]),
      correctIndex: x.correctIndex,
      marks: String(x.marks),
      explanation: x.explanation ?? "",
    })),
  };
  return (
    <>
      <PageHeader
        title={q ? "Edit quiz" : "Create quiz"}
        description={`Module ${chapter.module.number}: ${chapter.module.name} · Chapter ${chapter.module.number}.${chapter.number} ${chapter.name}`}
        back={{ href: "/mentor/quizzes", label: "Quizzes" }}
      />
      <QuizEditor chapterId={chapter.id} initial={draft} attempts={q?._count.attempts ?? 0} />
    </>
  );
}
