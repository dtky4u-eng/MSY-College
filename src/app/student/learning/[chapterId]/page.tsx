import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { learningTree, quizAttemptInfo } from "@/lib/student";
import { fileUrl } from "@/lib/files";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StateBanner } from "@/components/student/state-banner";
import { youtubeEmbedUrl } from "@/components/student/utils";
import { studentPage } from "../../_lib/server";
import { closeExpiredAttempts } from "../../_lib/quiz";
import { ChapterView, type ChapterResource } from "./chapter-view";

export const metadata = { title: "Chapter" };

export default async function ChapterPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;
  const { student, state, t } = await studentPage();
  if (!student.domainId) notFound();

  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, module: { domainId: student.domainId } },
    include: { module: true, resources: { orderBy: [{ primary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }, quiz: { select: { id: true, description: true, showResult: true } } },
  });
  if (!chapter) notFound();

  if (chapter.quiz) await closeExpiredAttempts(chapter.quiz.id, student.id);
  const tree = await learningTree(student.id, student.domainId);
  const flat = tree.modules.flatMap((m) => m.chapters.map((c) => ({ ...c, moduleNumber: m.number })));
  const idx = flat.findIndex((c) => c.id === chapter.id);
  const node = flat[idx];
  if (!node) notFound();
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx < flat.length - 1 ? flat[idx + 1] : null;
  const title = `${chapter.module.number}.${chapter.number} ${chapter.name}`;

  // WF-2: locked chapters are rejected on the server — no resource data is sent.
  if (!node.unlocked || state === "BLOCKED") {
    return (
      <>
        <PageHeader title={title} back={{ href: "/student/learning", label: t("learn.backToModules") }} />
        <StateBanner state={state} student={student} context="learning" />
        <Card>
          <EmptyState
            icon={<Lock />}
            title={state === "BLOCKED" ? t("state.BLOCKED") : t("learn.lockedTitle")}
            description={state === "BLOCKED" ? t("banner.blocked") : prev ? t("learn.lockedDesc", { name: `${prev.moduleNumber}.${prev.number} ${prev.name}` }) : t("learn.lockedHint")}
            action={prev ? <ButtonLink href={`/student/learning/${prev.id}`} variant="outline" icon={<ArrowLeft className="size-4" />}>{t("learn.goPrevious")}</ButtonLink> : undefined}
          />
        </Card>
      </>
    );
  }

  // Open the heartbeat window for active students so the first beat is credited.
  if (state === "ACTIVE") {
    const exists = await prisma.chapterProgress.findUnique({ where: { studentId_chapterId: { studentId: student.id, chapterId: chapter.id } }, select: { id: true } });
    if (!exists) await prisma.chapterProgress.create({ data: { studentId: student.id, chapterId: chapter.id } }).catch(() => undefined);
  }

  const fileIds = chapter.resources.map((r) => r.fileId).filter((x): x is string => Boolean(x));
  const files = fileIds.length ? await prisma.fileObject.findMany({ where: { id: { in: fileIds } }, select: { id: true, mime: true, originalName: true, size: true } }) : [];
  const fMap = new Map(files.map((f) => [f.id, f]));
  const resources: ChapterResource[] = chapter.resources.map((r) => {
    const f = r.fileId ? fMap.get(r.fileId) : undefined;
    return {
      id: r.id,
      title: r.title,
      type: r.type,
      url: r.url && /^https?:\/\//i.test(r.url) ? r.url : null,
      embedUrl: youtubeEmbedUrl(r.url),
      fileUrl: f ? fileUrl(f.id) : null,
      downloadUrl: f && r.downloadable ? fileUrl(f.id, true) : null,
      fileName: f?.originalName ?? null,
      fileSize: f?.size ?? null,
      mime: f?.mime ?? null,
      content: r.content,
      downloadable: r.downloadable,
      primary: r.primary,
    };
  });

  const quizInfo = chapter.quiz ? await quizAttemptInfo(chapter.quiz.id, student.id) : null;
  const lastAttempt = chapter.quiz
    ? await prisma.quizAttempt.findFirst({ where: { quizId: chapter.quiz.id, studentId: student.id, submittedAt: { not: null } }, orderBy: { submittedAt: "desc" }, select: { id: true } })
    : null;

  return (
    <>
      <PageHeader
        title={title}
        description={chapter.description ?? undefined}
        back={{ href: "/student/learning", label: t("learn.backToModules") }}
      />
      <StateBanner state={state} student={student} context="learning" />
      <ChapterView
        chapterId={chapter.id}
        moduleName={`${t("learn.module", { n: chapter.module.number })} · ${chapter.module.name}`}
        resources={resources}
        tracking={state === "ACTIVE"}
        canAct={state === "ACTIVE"}
        minWatchSeconds={chapter.minWatchSeconds}
        minReadSeconds={chapter.minReadSeconds}
        watchSeconds={node.watchSeconds}
        readSeconds={node.readSeconds}
        completed={node.completed}
        completedVia={node.completedVia}
        quiz={
          quizInfo && chapter.quiz
            ? { ...quizInfo, description: chapter.quiz.description, showResult: chapter.quiz.showResult, lastAttemptId: lastAttempt?.id ?? null }
            : null
        }
      />
      <nav className="mt-6 flex flex-wrap items-center justify-between gap-3" aria-label={t("learn.chapterNav")}>
        {prev ? (
          <Link href={`/student/learning/${prev.id}`} className="inline-flex max-w-[48%] items-center gap-2 truncate rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-brand-700">
            <ArrowLeft className="size-4 shrink-0" /> <span className="truncate">{prev.moduleNumber}.{prev.number} {prev.name}</span>
          </Link>
        ) : (
          <span />
        )}
        {next &&
          (next.unlocked ? (
            <Link href={`/student/learning/${next.id}`} className="inline-flex max-w-[48%] items-center gap-2 truncate rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-white">
              <span className="truncate">{next.moduleNumber}.{next.number} {next.name}</span> <ArrowRight className="size-4 shrink-0" />
            </Link>
          ) : (
            <span className="inline-flex max-w-[48%] items-center gap-2 truncate px-3 py-2 text-sm text-slate-400" title={t("learn.lockedHint")}>
              <Lock className="size-4 shrink-0" /> <span className="truncate">{next.moduleNumber}.{next.number} {next.name}</span>
            </span>
          ))}
      </nav>
    </>
  );
}
