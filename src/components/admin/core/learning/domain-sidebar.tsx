// Left column of Learning Setup: sectors and their domains with URL-driven search and filters (server component).
import Link from "next/link";
import { FolderTree, Layers, SearchX, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page";
import { FilterSelect, SearchInput } from "@/components/ui/filters";
import { cn } from "@/components/ui/cn";
import { learningHref, plural } from "./shared";
import type { Filters } from "./types";

export interface SidebarSector {
  id: string;
  name: string;
  totalDomains: number;
  domains: { id: string; code: string; name: string; active: boolean; featured: boolean; modules: number; students: number }[];
}

export function DomainSidebar({
  sectors,
  sectorOptions,
  selectedDomainId,
  filters,
  totalDomains,
}: {
  sectors: SidebarSector[];
  sectorOptions: { id: string; name: string }[];
  selectedDomainId: string | null;
  filters: Filters;
  totalDomains: number;
}) {
  const filtered = Boolean(filters.q || filters.sector || filters.status);
  const visible = filtered ? sectors.filter((s) => s.domains.length > 0) : sectors;
  const shown = visible.reduce((a, s) => a + s.domains.length, 0);

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-brand-600" />
          <h2 className="text-[15px] font-semibold text-slate-900">Domains</h2>
          <span className="ml-auto text-xs text-slate-500 tabular-nums">{filtered ? `${shown} of ${totalDomains}` : plural(totalDomains, "domain")}</span>
        </div>
        <div className="mt-3 space-y-2">
          <SearchInput placeholder="Search name or code…" className="sm:w-full" />
          <div className="grid grid-cols-2 gap-2">
            <FilterSelect param="sector" label="Filter by sector" placeholder="All sectors" options={sectorOptions.map((s) => ({ value: s.id, label: s.name }))} className="w-full min-w-0" />
            <FilterSelect
              param="status"
              label="Filter by status"
              placeholder="Any status"
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
                { value: "featured", label: "Featured" },
              ]}
              className="w-full min-w-0"
            />
          </div>
        </div>
      </div>

      {sectorOptions.length === 0 ? (
        <EmptyState icon={<FolderTree />} title="No sectors yet" description="Use “Manage sectors” to add a sector, then create your first domain." className="py-10" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title="No matching domains"
          description="Try a different search or clear the filters."
          action={
            <Link href={learningHref({ domain: selectedDomainId })} className="text-sm font-medium text-brand-600 hover:underline">
              Clear filters
            </Link>
          }
          className="py-10"
        />
      ) : (
        <nav aria-label="Domains" className="max-h-none divide-y divide-slate-100 xl:max-h-[calc(100vh-16rem)] xl:overflow-y-auto">
          {visible.map((s) => (
            <section key={s.id} className="px-2 py-3">
              <h3 className="flex items-center justify-between px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                <span className="truncate">{s.name}</span>
                <span className="tabular-nums">{s.totalDomains}</span>
              </h3>
              {s.domains.length === 0 ? (
                <p className="px-2 py-1 text-xs text-slate-400">No domains in this sector yet</p>
              ) : (
                <ul className="space-y-0.5">
                  {s.domains.map((d) => {
                    const selected = d.id === selectedDomainId;
                    return (
                      <li key={d.id}>
                        <Link
                          href={learningHref({ ...filters, domain: d.id })}
                          aria-current={selected ? "page" : undefined}
                          className={cn(
                            "group block rounded-lg px-2 py-2 transition-colors",
                            selected ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-slate-50",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", selected ? "text-brand-800" : d.active ? "text-slate-800" : "text-slate-500")}>{d.name}</span>
                            {d.featured && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Featured" />}
                            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">{d.code}</span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                            <span>{plural(d.modules, "module")}</span>
                            <span aria-hidden>·</span>
                            <span>{plural(d.students, "student")}</span>
                            {!d.active && (
                              <Badge tone="gray" className="ml-auto px-1.5 py-0 text-[10px]">
                                Inactive
                              </Badge>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </nav>
      )}
    </Card>
  );
}
