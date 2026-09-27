import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AlertTriangle, BookOpen, ChevronLeft, ClipboardList, FolderTree, Layers, MousePointerClick, Paperclip } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { parseJson } from "@/lib/json";
import { formatNumber } from "@/lib/format";
import type { ResourceType } from "@/lib/constants";
import { PageHeader, Alert, EmptyState } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { SectorManager } from "@/components/admin/core/learning/sector-manager";
import { DomainFormButton } from "@/components/admin/core/learning/domain-form";
import { DomainSidebar, type SidebarSector } from "@/components/admin/core/learning/domain-sidebar";
import { DomainSummary, ModuleOutline, type OutlineModule } from "@/components/admin/core/learning/domain-detail";
import { ChapterWorkspace } from "@/components/admin/core/learning/chapter-workspace";
import { learningHref, type LearningTab } from "@/components/admin/core/learning/shared";
import type { Filters, QuestionRow, ResourceRow } from "@/components/admin/core/learning/types";

export const metadata = { title: "Learning Setup" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || null;

export default async function LearningSetupPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePageRole("ADMIN");
  const sp = await searchParams;
  const status = one(sp.status);
  const filters: Filters = { q: one(sp.q), sector: one(sp.sector), status: status && ["active", "inactive", "featured"].includes(status) ? status : null };
  const domainParam = one(sp.domain);
  const moduleParam = one(sp.module);
  const chapterParam = one(sp.chapter);
  const tab: LearningTab = one(sp.tab) === "quiz" ? "quiz" : "resources";

  const q = filters.q?.slice(0, 80);
  const domainWhere: Prisma.DomainWhereInput = {
    AND: [
      q ? { OR: [{ name: { contains: q } }, { code: { contains: q.toUpperCase() } }, { description: { contains: q } }] } : {},
      filters.status === "active" ? { active: true } : filters.status === "inactive" ? { active: false } : filters.status === "featured" ? { featured: true } : {},
    ],
  };

  const [sectorRows, totalDomains] = await Promise.all([
    prisma.sector.findMany({
      where: filters.sector ? { id: filters.sector } : undefined,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { domains: true } },
        domains: {
          where: domainWhere,
          orderBy: { name: "asc" },
          select: { id: true, code: true, name: true, active: true, featured: true, _count: { select: { modules: true, students: true } } },
        },
      },
    }),
    prisma.domain.count(),
  ]);
  // The sector filter needs the full sector list for its options.
  const allSectors = await prisma.sector.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { domains: true } } } });
  const sectorOptions = allSectors.map((s) => ({ id: s.id, name: s.name, domains: s._count.domains }));
  const sidebar: SidebarSector[] = sectorRows.map((s) => ({
    id: s.id,
    name: s.name,
    totalDomains: s._count.domains,
    domains: s.domains.map((d) => ({ id: d.id, code: d.code, name: d.name, active: d.active, featured: d.featured, modules: d._count.modules, students: d._count.students })),
  }));

  const domain = domainParam
    ? await prisma.domain.findFirst({
        where: { OR: [{ id: domainParam }, { code: domainParam.toUpperCase() }] },
        include: {
          sector: { select: { name: true } },
          _count: { select: { students: true, mentors: true } },
          modules: {
            orderBy: { number: "asc" },
            include: {
              chapters: {
                orderBy: { number: "asc" },
                include: {
                  quiz: { select: { id: true, _count: { select: { questions: true } } } },
                  _count: { select: { resources: true, progress: true } },
                },
              },
            },
          },
        },
      })
    : null;

  const header = (
    <PageHeader
      title="Learning Setup"
      description="Organise sectors, domains, modules and chapters, and manage each chapter's resources and quiz."
      actions={
        <>
          <SectorManager sectors={sectorOptions} />
          <DomainFormButton sectors={sectorOptions} defaultSectorId={filters.sector} />
        </>
      }
    />
  );

  let main: React.ReactNode;
  if (domainParam && !domain) {
    main = (
      <Alert tone="error" icon={<AlertTriangle />} title="Domain not found" action={<Link href={learningHref({ ...filters })} className="text-sm font-medium underline">Back to overview</Link>}>
        The domain in the link no longer exists or was deleted.
      </Alert>
    );
  } else if (!domain) {
    const [modules, chapters, resources, questions, enrolled, activeDomains] = await Promise.all([
      prisma.module.count(),
      prisma.chapter.count(),
      prisma.resource.count(),
      prisma.question.count(),
      prisma.student.count({ where: { domainId: { not: null } } }),
      prisma.domain.count({ where: { active: true } }),
    ]);
    main = (
      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Domains" value={formatNumber(totalDomains)} hint={`${formatNumber(activeDomains)} active · ${formatNumber(allSectors.length)} sectors`} icon={<FolderTree />} />
          <StatCard label="Modules" value={formatNumber(modules)} hint={`${formatNumber(chapters)} chapters`} icon={<Layers />} tone="violet" />
          <StatCard label="Resources" value={formatNumber(resources)} hint="Videos, PDFs, notes and links" icon={<Paperclip />} tone="teal" />
          <StatCard label="Quiz questions" value={formatNumber(questions)} hint={`${formatNumber(enrolled)} students enrolled`} icon={<ClipboardList />} tone="amber" />
        </StatGrid>
        <Card>
          <EmptyState
            icon={totalDomains ? <MousePointerClick /> : <BookOpen />}
            title={totalDomains ? "Select a domain" : "No domains yet"}
            description={
              totalDomains
                ? "Choose a domain from the list to manage its modules, chapters, resources and quizzes."
                : allSectors.length
                  ? "Create the first domain to start building learning content."
                  : "Start by adding a sector with “Manage sectors”, then create a domain inside it."
            }
            action={totalDomains ? undefined : <DomainFormButton sectors={sectorOptions} />}
          />
        </Card>
      </div>
    );
  } else {
    const outline: OutlineModule[] = domain.modules.map((m) => ({
      id: m.id,
      domainId: m.domainId,
      number: m.number,
      name: m.name,
      description: m.description,
      chapters: m.chapters.map((c) => ({
        id: c.id,
        moduleId: c.moduleId,
        number: c.number,
        name: c.name,
        description: c.description,
        minWatchSeconds: c.minWatchSeconds,
        minReadSeconds: c.minReadSeconds,
        resources: c._count.resources,
        questions: c.quiz?._count.questions ?? 0,
        hasQuiz: Boolean(c.quiz),
        learners: c._count.progress,
      })),
    }));

    const selModule = outline.find((m) => m.chapters.some((c) => c.id === chapterParam)) ?? outline.find((m) => m.id === moduleParam) ?? null;
    const selChapter = chapterParam ? (selModule?.chapters.find((c) => c.id === chapterParam) ?? null) : null;
    const [activeStudents, workspace] = await Promise.all([
      prisma.student.count({ where: { domainId: domain.id, status: "ACTIVE" } }),
      selChapter ? loadChapter(selChapter.id) : Promise.resolve(null),
    ]);

    main = (
      <div className="space-y-6">
        <DomainSummary
          domain={{
            id: domain.id,
            code: domain.code,
            name: domain.name,
            description: domain.description,
            sectorId: domain.sectorId,
            durationHours: domain.durationHours,
            defaultFee: domain.defaultFee,
            active: domain.active,
            featured: domain.featured,
            sectorName: domain.sector.name,
            students: domain._count.students,
            activeStudents,
            mentors: domain._count.mentors,
          }}
          modules={outline}
          sectors={sectorOptions}
          filters={filters}
        />
        {chapterParam && !selChapter && (
          <Alert tone="warning" icon={<AlertTriangle />} title="Chapter not found">
            The chapter in the link does not belong to this domain or was deleted.
          </Alert>
        )}
        <div className={selChapter ? "grid items-start gap-6 2xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : undefined}>
          <ModuleOutline domainId={domain.id} modules={outline} selectedModuleId={selModule?.id ?? null} selectedChapterId={selChapter?.id ?? null} filters={filters} />
          {selChapter && selModule && workspace && (
            <ChapterWorkspace
              domainId={domain.id}
              module={selModule}
              chapter={selChapter}
              learners={selChapter.learners}
              resources={workspace.resources}
              quiz={workspace.quiz}
              questions={workspace.questions}
              stats={workspace.stats}
              tab={tab}
              filters={filters}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {header}
      <div className="grid items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)] [&>*]:min-w-0">
        <aside className={domain ? "hidden xl:block" : undefined}>
          <DomainSidebar sectors={sidebar} sectorOptions={sectorOptions}selectedDomainId={domain?.id ?? null} filters={filters} totalDomains={totalDomains} />
        </aside>
        <section className="min-w-0 space-y-4">
          {domain && (
            <Link href={learningHref({ ...filters })} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-600 xl:hidden">
              <ChevronLeft className="size-4" /> All domains
            </Link>
          )}
          {main}
        </section>
      </div>
    </>
  );
}

async function loadChapter(chapterId: string) {
  const [resources, quiz] = await Promise.all([
    prisma.resource.findMany({ where: { chapterId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.quiz.findUnique({ where: { chapterId }, include: { questions: { orderBy: [{ sort: "asc" }, { id: "asc" }] } } }),
  ]);
  const fileIds = resources.map((r) => r.fileId).filter((x): x is string => Boolean(x));
  const [files, attempts, submitted, passed] = await Promise.all([
    fileIds.length ? prisma.fileObject.findMany({ where: { id: { in: fileIds } } }) : Promise.resolve([]),
    quiz ? prisma.quizAttempt.count({ where: { quizId: quiz.id } }) : Promise.resolve(0),
    quiz ? prisma.quizAttempt.count({ where: { quizId: quiz.id, submittedAt: { not: null } } }) : Promise.resolve(0),
    quiz ? prisma.quizAttempt.count({ where: { quizId: quiz.id, submittedAt: { not: null }, passed: true } }) : Promise.resolve(0),
  ]);
  const fileMap = new Map(files.map((f) => [f.id, f]));
  const resourceRows: ResourceRow[] = resources.map((r) => {
    const f = r.fileId ? fileMap.get(r.fileId) : undefined;
    return {
      id: r.id,
      type: r.type as ResourceType,
      title: r.title,
      url: r.url,
      content: r.content,
      sortOrder: r.sortOrder,
      primary: r.primary,
      downloadable: r.downloadable,
      file: f ? { id: f.id, name: f.originalName, size: f.size, mime: f.mime, href: fileUrl(f.id)!, downloadHref: fileUrl(f.id, true)! } : null,
      updatedAt: r.updatedAt.toISOString(),
    };
  });
  const questions: QuestionRow[] = (quiz?.questions ?? []).map((qn) => ({
    id: qn.id,
    text: qn.text,
    options: parseJson<string[]>(qn.options, []),
    correctIndex: qn.correctIndex,
    marks: qn.marks,
    explanation: qn.explanation,
    sort: qn.sort,
  }));
  return {
    resources: resourceRows,
    quiz: quiz
      ? {
          id: quiz.id,
          chapterId: quiz.chapterId,
          title: quiz.title,
          description: quiz.description,
          passingScore: quiz.passingScore,
          attemptsAllowed: quiz.attemptsAllowed,
          timeLimitMinutes: quiz.timeLimitMinutes,
          randomize: quiz.randomize,
          showResult: quiz.showResult,
        }
      : null,
    questions,
    stats: { attempts, submitted, passed },
  };
}
