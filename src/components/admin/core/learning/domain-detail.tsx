// Selected domain: summary, and its modules with collapsible chapter lists (server component).
import Link from "next/link";
import { BookOpen, ChevronRight, ClipboardList, Clock, FileStack, Layers, ListTree, Paperclip, Star, Users } from "lucide-react";
import { formatINR, formatNumber } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page";
import { cn } from "@/components/ui/cn";
import { DeleteAction } from "./delete-action";
import { DomainFormButton } from "./domain-form";
import { ChapterFormButton, ModuleFormButton } from "./outline-forms";
import { learningHref, minutesLabel, plural } from "./shared";
import type { ChapterValue, DomainValue, Filters, ModuleValue, SectorOption } from "./types";

export interface DomainDetailData extends DomainValue {
  sectorName: string;
  students: number;
  activeStudents: number;
  mentors: number;
}

export interface OutlineChapter extends ChapterValue {
  resources: number;
  questions: number;
  hasQuiz: boolean;
  learners: number;
}

export interface OutlineModule extends ModuleValue {
  chapters: OutlineChapter[];
}

export function DomainSummary({ domain, modules, sectors, filters }: { domain: DomainDetailData; modules: OutlineModule[]; sectors: SectorOption[]; filters: Filters }) {
  const chapters = modules.reduce((a, m) => a + m.chapters.length, 0);
  const resources = modules.reduce((a, m) => a + m.chapters.reduce((b, c) => b + c.resources, 0), 0);
  const questions = modules.reduce((a, m) => a + m.chapters.reduce((b, c) => b + c.questions, 0), 0);
  const stats: [string, string, React.ComponentType<{ className?: string }>][] = [
    ["Students enrolled", formatNumber(domain.students), Users],
    ["Modules", formatNumber(modules.length), Layers],
    ["Chapters", formatNumber(chapters), BookOpen],
    ["Resources", formatNumber(resources), Paperclip],
    ["Quiz questions", formatNumber(questions), ClipboardList],
    ["Duration", `${formatNumber(domain.durationHours)} hours`, Clock],
  ];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{domain.sectorName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{domain.name}</h2>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">{domain.code}</span>
            {domain.active ? (
              <Badge tone="green" dot>
                Active
              </Badge>
            ) : (
              <Badge tone="gray" dot>
                Inactive
              </Badge>
            )}
            {domain.featured && (
              <Badge tone="amber">
                <Star className="size-3 fill-current" /> Featured
              </Badge>
            )}
          </div>
          {domain.description && <p className="mt-2 max-w-3xl text-sm whitespace-pre-line text-slate-600">{domain.description}</p>}
          <p className="mt-2 text-sm text-slate-600">
            Default fee <span className="font-semibold text-slate-900">{formatINR(domain.defaultFee)}</span>
            <span className="mx-2 text-slate-300">|</span>
            {plural(domain.mentors, "mentor")}
            <span className="mx-2 text-slate-300">|</span>
            {plural(domain.activeStudents, "active student")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DomainFormButton sectors={sectors} domain={domain} size="sm" />
          <DeleteAction
            url={`/api/admin/learning/domains/${domain.id}`}
            title={`Delete ${domain.name}?`}
            description="The domain and all of its modules, chapters, resources and quizzes will be permanently deleted."
            success="Domain deleted"
            redirectTo={learningHref({ ...filters })}
          />
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-b-2xl border-t border-slate-100 bg-slate-100 sm:grid-cols-3 2xl:grid-cols-6">
        {stats.map(([label, value, Icon]) => (
          <div key={label} className="bg-white px-4 py-3">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Icon className="size-3.5" />
              {label}
            </dt>
            <dd className="mt-0.5 text-base font-semibold text-slate-900 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function ModuleOutline({
  domainId,
  modules,
  selectedModuleId,
  selectedChapterId,
  filters,
}: {
  domainId: string;
  modules: OutlineModule[];
  selectedModuleId: string | null;
  selectedChapterId: string | null;
  filters: Filters;
}) {
  const nextModule = (modules.reduce((a, m) => Math.max(a, m.number), 0) || 0) + 1;
  return (
    <Card>
      <CardHeader
        icon={<ListTree className="size-5" />}
        title="Modules & chapters"
        description={modules.length ? `${plural(modules.length, "module")} · ${plural(modules.reduce((a, m) => a + m.chapters.length, 0), "chapter")}` : "Build the course outline"}
        actions={<ModuleFormButton domainId={domainId} nextNumber={nextModule} filters={filters} />}
      />
      {modules.length === 0 ? (
        <EmptyState
          icon={<FileStack />}
          title="No modules yet"
          description="Add the first module, then add chapters with resources and a quiz."
          action={<ModuleFormButton domainId={domainId} nextNumber={1} filters={filters} size="md" />}
        />
      ) : (
        <div className="divide-y divide-slate-100">
          {modules.map((m, i) => {
            const open = m.id === selectedModuleId || (!selectedModuleId && i === 0);
            const nextChapter = m.chapters.reduce((a, c) => Math.max(a, c.number), 0) + 1;
            const res = m.chapters.reduce((a, c) => a + c.resources, 0);
            const learners = m.chapters.reduce((a, c) => a + c.learners, 0);
            return (
              <details key={m.id} id={`module-${m.id}`} open={open} className="group scroll-mt-6">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70 [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700 tabular-nums">{m.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{m.name}</span>
                    <span className="block text-xs text-slate-500">
                      {plural(m.chapters.length, "chapter")} · {plural(res, "resource")}
                    </span>
                  </span>
                </summary>
                <div className="px-5 pb-4">
                  {m.description && <p className="mb-3 ml-11 text-sm whitespace-pre-line text-slate-600">{m.description}</p>}
                  <div className="mb-3 ml-11 flex flex-wrap gap-2">
                    <ChapterFormButton moduleId={m.id} domainId={domainId} nextNumber={nextChapter} filters={filters} size="xs" />
                    <ModuleFormButton domainId={domainId} module={m} filters={filters} size="xs" variant="outline" />
                    <DeleteAction
                      url={`/api/admin/learning/modules/${m.id}`}
                      title={`Delete module ${m.number}?`}
                      description={`“${m.name}” and its ${plural(m.chapters.length, "chapter")}, resources and quizzes will be permanently deleted.`}
                      success="Module deleted"
                      size="xs"
                      redirectTo={learningHref({ ...filters, domain: domainId })}
                    >
                      {learners > 0 && <p className="text-sm text-amber-700">Students have learning progress in this module.</p>}
                    </DeleteAction>
                  </div>
                  {m.chapters.length === 0 ? (
                    <p className="ml-11 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">No chapters in this module yet.</p>
                  ) : (
                    <ol className="ml-11 space-y-1">
                      {m.chapters.map((c) => {
                        const selected = c.id === selectedChapterId;
                        return (
                          <li key={c.id}>
                            <Link
                              href={learningHref({ ...filters, domain: domainId, module: m.id, chapter: c.id }, "workspace")}
                              aria-current={selected ? "page" : undefined}
                              className={cn(
                                "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                                selected ? "border-brand-200 bg-brand-50/70" : "border-transparent hover:border-slate-200 hover:bg-slate-50",
                              )}
                            >
                              <span className={cn("mt-0.5 text-xs font-semibold tabular-nums", selected ? "text-brand-700" : "text-slate-400")}>
                                {m.number}.{c.number}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className={cn("block truncate text-sm font-medium", selected ? "text-brand-800" : "text-slate-800")}>{c.name}</span>
                                <span className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-slate-500">
                                  <span className="inline-flex items-center gap-1">
                                    <Paperclip className="size-3" />
                                    {c.resources}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <ClipboardList className="size-3" />
                                    {c.hasQuiz ? plural(c.questions, "question") : "No quiz"}
                                  </span>
                                  {(c.minWatchSeconds > 0 || c.minReadSeconds > 0) && (
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="size-3" />
                                      {minutesLabel(c.minWatchSeconds + c.minReadSeconds)}
                                    </span>
                                  )}
                                  {c.learners > 0 && (
                                    <span className="inline-flex items-center gap-1">
                                      <Users className="size-3" />
                                      {c.learners}
                                    </span>
                                  )}
                                </span>
                              </span>
                              {c.resources === 0 && <Badge tone="amber" className="shrink-0">Empty</Badge>}
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </Card>
  );
}
