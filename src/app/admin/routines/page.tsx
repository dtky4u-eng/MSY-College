import type { Prisma } from "@prisma/client";
import { CalendarClock, FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { formatDateTime } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/filters";
import { domainOptions, sp1 } from "@/components/admin/ops/lookups";
import { NewRoutineButton, RoutineActions } from "./routine-form";

export const metadata = { title: "Routines" };

export default async function RoutinesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageRole("ADMIN");
  const sp = await searchParams;
  const q = sp1(sp, "q");
  const domain = sp1(sp, "domain");
  const status = sp1(sp, "status");
  const now = new Date();
  const where: Prisma.RoutineWhereInput = {
    ...(q ? { OR: [{ title: { contains: q } }, { description: { contains: q } }] } : {}),
    ...(domain === "ALL" ? { domainId: null } : domain ? { domainId: domain } : {}),
    ...(status === "active" ? { active: true, publishAt: { lte: now } } : status === "scheduled" ? { active: true, publishAt: { gt: now } } : status === "hidden" ? { active: false } : {}),
  };
  const [routines, domains] = await Promise.all([
    prisma.routine.findMany({ where, orderBy: [{ publishAt: "desc" }], include: { domain: { select: { name: true } } } }),
    domainOptions(),
  ]);
  const files = await prisma.fileObject.findMany({ where: { id: { in: routines.map((r) => r.fileId) } }, select: { id: true, originalName: true, mime: true, size: true } });
  const fileMap = new Map(files.map((f) => [f.id, f]));

  return (
    <>
      <PageHeader
        title="Routines"
        description="Publish timetables and routines as PDF or image. Active routines are shown to students of the chosen domain (or everyone) from the publish time."
        actions={<NewRoutineButton domains={domains} />}
      />
      <Card>
        <FilterBar>
          <SearchInput placeholder="Search routines…" />
          <FilterSelect param="domain" placeholder="All domains" label="Domain" options={[{ value: "ALL", label: "Shown to all domains" }, ...domains]} />
          <FilterSelect
            param="status"
            placeholder="Any status"
            label="Status"
            options={[
              { value: "active", label: "Active (published)" },
              { value: "scheduled", label: "Scheduled" },
              { value: "hidden", label: "Hidden" },
            ]}
          />
        </FilterBar>
        {routines.length === 0 ? (
          <EmptyState
            icon={<CalendarClock />}
            title={q || domain || status ? "No routines match these filters" : "No routines yet"}
            description="Upload a PDF or image routine (max 10 MB) to make it available in the student portal."
          />
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {routines.map((r) => {
              const f = fileMap.get(r.fileId);
              const isImage = f?.mime.startsWith("image/");
              const scheduled = r.publishAt > now;
              return (
                <div key={r.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <a href={fileUrl(r.fileId)!} target="_blank" rel="noopener" className="group relative block aspect-[16/9] bg-slate-100" aria-label={`Open ${r.title}`}>
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(r.fileId)!} alt={`Preview of ${r.title}`} className="size-full object-cover transition group-hover:opacity-90" loading="lazy" />
                    ) : (
                      <div className="flex size-full flex-col items-center justify-center gap-2 text-slate-500 group-hover:text-brand-600">
                        <FileText className="size-10" />
                        <span className="text-xs font-medium">Open PDF</span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex gap-1">
                      {!r.active ? <Badge tone="gray">Hidden</Badge> : scheduled ? <Badge tone="amber">Scheduled</Badge> : <Badge tone="green">Published</Badge>}
                    </div>
                  </a>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">{r.title}</h3>
                      {r.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{r.description}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <Badge tone="brand">{r.domain?.name ?? "All domains"}</Badge>
                      <Badge tone="gray">{scheduled ? "Publishes" : "Published"} {formatDateTime(r.publishAt)}</Badge>
                    </div>
                    {f && (
                      <p className="truncate text-xs text-slate-500">
                        {f.originalName} · {f.size >= 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`}
                      </p>
                    )}
                    <div className="mt-auto border-t border-slate-100 pt-3">
                      <RoutineActions
                        domains={domains}
                        value={{ id: r.id, title: r.title, description: r.description, domainId: r.domainId, publishAt: r.publishAt.toISOString(), active: r.active, fileName: f?.originalName ?? "routine" }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
