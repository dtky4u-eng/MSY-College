import type { Prisma } from "@prisma/client";
import { CalendarClock, ExternalLink, PlayCircle, Video } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkTabs } from "@/components/ui/tabs";
import { FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { domainOptions, sp1 } from "@/components/admin/ops/lookups";
import { NewLiveClassButton, type DomainTree } from "./live-class-form";
import { LiveClassActions } from "./live-class-actions";

export const metadata = { title: "Live Classes" };

export default async function LiveClassesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageRole("ADMIN");
  const sp = await searchParams;
  const tab = sp1(sp, "tab") ?? "upcoming";
  const domainId = sp1(sp, "domain");
  const q = sp1(sp, "q");
  const { page, pageSize, skip, take } = pagination(sp, 15);
  const now = new Date();
  // A class stays "upcoming" until it has ended (max duration 8 h).
  const endedBefore = new Date(now.getTime() - 8 * 3600_000);

  const base: Prisma.LiveClassWhereInput = {
    ...(domainId ? { domainId } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { trainer: { contains: q } }] } : {}),
  };

  const all = await prisma.liveClass.findMany({
    where: { ...base, ...(tab === "cancelled" ? { cancelled: true } : { cancelled: false }), ...(tab === "upcoming" ? { startsAt: { gte: endedBefore } } : tab === "past" ? { startsAt: { lt: now } } : {}) },
    orderBy: { startsAt: tab === "upcoming" ? "asc" : "desc" },
    select: { id: true, startsAt: true, durationMinutes: true },
  });
  const ended = (c: { startsAt: Date; durationMinutes: number }) => c.startsAt.getTime() + c.durationMinutes * 60_000 < now.getTime();
  const ids = all.filter((c) => (tab === "upcoming" ? !ended(c) : tab === "past" ? ended(c) : true)).map((c) => c.id);
  const pageIds = ids.slice(skip, skip + take);

  const [rows, tree, domains, upcomingCount, thisWeek, attendanceTotal] = await Promise.all([
    prisma.liveClass.findMany({
      where: { id: { in: pageIds } },
      include: { domain: { select: { name: true } }, module: { select: { number: true, name: true } }, chapter: { select: { number: true, name: true } }, _count: { select: { attendance: true } } },
    }),
    prisma.domain.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        modules: { orderBy: { number: "asc" }, select: { id: true, number: true, name: true, chapters: { orderBy: { number: "asc" }, select: { id: true, number: true, name: true } } } },
      },
    }),
    domainOptions(),
    prisma.liveClass.count({ where: { cancelled: false, startsAt: { gte: now } } }),
    prisma.liveClass.count({ where: { cancelled: false, startsAt: { gte: now, lte: new Date(now.getTime() + 7 * 86400_000) } } }),
    prisma.liveClassAttendance.count(),
  ]);
  const order = new Map(pageIds.map((id, i) => [id, i]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const domainTree: DomainTree[] = tree;

  return (
    <>
      <PageHeader
        title="Live Classes"
        description="Schedule live sessions for a domain, module or chapter. Students see a reminder popup before the class and their join/leave times are tracked."
        actions={<NewLiveClassButton domains={domainTree} />}
      />
      <StatGrid className="mb-6">
        <StatCard label="Upcoming classes" value={formatNumber(upcomingCount)} icon={<CalendarClock />} />
        <StatCard label="Next 7 days" value={formatNumber(thisWeek)} icon={<Video />} tone="blue" />
        <StatCard label="Total attendances" value={formatNumber(attendanceTotal)} icon={<PlayCircle />} tone="green" />
        <StatCard label="Domains" value={formatNumber(domains.length)} icon={<Video />} tone="violet" />
      </StatGrid>
      <Card>
        <LinkTabs
          className="px-3"
          items={[
            { key: "upcoming", label: "Upcoming" },
            { key: "past", label: "Past" },
            { key: "cancelled", label: "Cancelled" },
          ]}
        />
        <FilterBar>
          <SearchInput placeholder="Search title or trainer…" />
          <FilterSelect param="domain" placeholder="All domains" label="Domain" options={domains} />
        </FilterBar>
        {ids.length === 0 ? (
          <EmptyState
            icon={<Video />}
            title={tab === "upcoming" ? "No upcoming classes" : tab === "past" ? "No past classes" : "No cancelled classes"}
            description={tab === "upcoming" ? "Schedule a live class to notify the paid students of a domain." : "Classes will appear here once they are held."}
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Class</TH>
                  <TH>Scope</TH>
                  <TH>When (IST)</TH>
                  <TH>Trainer</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Attendance · Actions</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((c) => {
                  const start = c.startsAt.getTime();
                  const end = start + c.durationMinutes * 60_000;
                  const live = !c.cancelled && start <= now.getTime() && end >= now.getTime();
                  const isEnded = end < now.getTime();
                  return (
                    <TR key={c.id}>
                      <TD className="max-w-[280px]">
                        <p className="font-medium text-slate-900">{c.title}</p>
                        <a href={c.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-xs text-brand-700 hover:underline">
                          <ExternalLink className="size-3 shrink-0" />
                          <span className="truncate">{c.meetingLink.replace(/^https?:\/\//, "")}</span>
                        </a>
                      </TD>
                      <TD className="text-xs">
                        <p className="text-sm font-medium text-slate-800">{c.domain.name}</p>
                        {c.module && (
                          <p className="text-slate-500">
                            Module {c.module.number}
                            {c.chapter ? ` · Chapter ${c.chapter.number}: ${c.chapter.name}` : `: ${c.module.name}`}
                          </p>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <p className="font-medium text-slate-800">{formatDate(c.startsAt, { weekday: "short" })}</p>
                        <p className="text-xs text-slate-500">
                          {formatTime(c.startsAt)} · {c.durationMinutes} min · popup {c.popupMinutes} min
                        </p>
                      </TD>
                      <TD>{c.trainer}</TD>
                      <TD>{c.cancelled ? <Badge tone="gray">Cancelled</Badge> : live ? <Badge tone="red" dot>Live now</Badge> : isEnded ? <Badge tone="brand">Held</Badge> : <Badge tone="blue">Scheduled</Badge>}</TD>
                      <TD>
                        <LiveClassActions
                          domains={domainTree}
                          attendance={c._count.attendance}
                          canEdit={!c.cancelled && !isEnded}
                          canCancel={!c.cancelled && !isEnded}
                          value={{
                            id: c.id,
                            title: c.title,
                            description: c.description,
                            domainId: c.domainId,
                            moduleId: c.moduleId,
                            chapterId: c.chapterId,
                            meetingLink: c.meetingLink,
                            startsAt: c.startsAt.toISOString(),
                            trainer: c.trainer,
                            durationMinutes: c.durationMinutes,
                            popupMinutes: c.popupMinutes,
                          }}
                        />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={ids.length} />
          </>
        )}
      </Card>
    </>
  );
}
