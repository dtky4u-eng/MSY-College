import Link from "next/link";
import { Library } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireMentor } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { ResourceManager, type ResourceRow } from "./resource-manager";

export const metadata = { title: "Learning Resources" };

export default async function MentorResourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { mentor } = await requireMentor();
  const modules = await prisma.module.findMany({
    where: { domainId: mentor.domainId },
    orderBy: { number: "asc" },
    include: { chapters: { orderBy: { number: "asc" }, include: { _count: { select: { resources: true } } } } },
  });
  const chapters = modules.flatMap((m) => m.chapters.map((c) => ({ ...c, module: m })));
  const selected = chapters.find((c) => c.id === sp.chapter) ?? chapters[0];

  const resources = selected
    ? await prisma.resource.findMany({ where: { chapterId: selected.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })
    : [];
  const files = await prisma.fileObject.findMany({ where: { id: { in: resources.map((r) => r.fileId).filter((x): x is string => Boolean(x)) } }, select: { id: true, originalName: true, size: true } });
  const fMap = new Map(files.map((f) => [f.id, f]));
  const rows: ResourceRow[] = resources.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    url: r.url,
    content: r.content,
    sortOrder: r.sortOrder,
    primary: r.primary,
    downloadable: r.downloadable,
    file: r.fileId ? { url: fileUrl(r.fileId)!, name: fMap.get(r.fileId)?.originalName ?? "File", size: fMap.get(r.fileId)?.size ?? 0 } : null,
  }));

  return (
    <>
      <PageHeader title="Learning Resources" description={`Manage chapter resources for ${mentor.domain.name}. Students see resources in the order below.`} />
      {chapters.length === 0 ? (
        <Card>
          <EmptyState icon={<Library />} title="No chapters in your domain yet" description="Modules and chapters are created by the MSY College admin team. Resources can be added once chapters exist." />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Card className="h-fit lg:sticky lg:top-20">
            <CardHeader title="Chapters" description={`${modules.length} modules · ${chapters.length} chapters`} />
            <nav className="max-h-[70vh] overflow-y-auto py-2 scrollbar-thin" aria-label="Chapters">
              {modules.map((m) => (
                <div key={m.id} className="px-2 pb-2">
                  <p className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Module {m.number} · {m.name}</p>
                  {m.chapters.map((c) => (
                    <Link
                      key={c.id}
                      href={`/mentor/resources?chapter=${c.id}`}
                      scroll={false}
                      aria-current={selected?.id === c.id ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm",
                        selected?.id === c.id ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-100",
                      )}
                    >
                      <span className="truncate">{m.number}.{c.number} {c.name}</span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-500 tabular-nums">{c._count.resources}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </Card>
          {selected && (
            <ResourceManager
              key={selected.id}
              chapter={{ id: selected.id, title: `${selected.module.number}.${selected.number} ${selected.name}`, module: `Module ${selected.module.number}: ${selected.module.name}` }}
              resources={rows}
            />
          )}
        </div>
      )}
    </>
  );
}
