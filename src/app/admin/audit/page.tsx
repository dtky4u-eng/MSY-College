import type { Prisma } from "@prisma/client";
import { ScrollText } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { pagination } from "@/lib/http";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { DateFilter, FilterBar, FilterSelect, Pagination, SearchInput } from "@/components/ui/filters";
import { Table, THead, TBody, TR, TH, EmptyRow } from "@/components/ui/table";
import { istRange, sp1 } from "@/components/admin/ops/lookups";
import { AuditRows, type AuditRow } from "./audit-rows";
import { actionLabel } from "./labels";

export const metadata = { title: "Audit Log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageRole("ADMIN");
  const sp = await searchParams;
  const { page, pageSize, skip, take } = pagination(sp, 25);
  const action = sp1(sp, "action");
  const entity = sp1(sp, "entity");
  const q = sp1(sp, "q");
  const range = istRange(sp1(sp, "from"), sp1(sp, "to"));

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(entity ? { entity } : {}),
    ...(range ? { createdAt: range } : {}),
    ...(q ? { OR: [{ actor: { username: { contains: q } } }, { actor: { email: { contains: q } } }, { entityId: { contains: q } }] } : {}),
  };

  const [total, logs, actions, entities] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { actor: { select: { username: true, role: true } } } }),
    prisma.auditLog.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.groupBy({ by: ["entity"], _count: { _all: true }, orderBy: { entity: "asc" } }),
  ]);

  const rows: AuditRow[] = logs.map((l) => ({
    id: l.id,
    at: l.createdAt.toISOString(),
    action: l.action,
    actor: l.actor?.username ?? null,
    actorRole: l.actor?.role ?? null,
    entity: l.entity,
    entityId: l.entityId,
    details: l.details,
    ip: l.ip,
  }));

  return (
    <>
      <PageHeader title="Audit Log" description="Every administrative action on payments, student status, passwords, bulk jobs, settlements and content, with the user, time and IP address (NFR-5)." />
      <Card>
        <FilterBar>
          <SearchInput placeholder="Actor username / email or entity ID…" className="sm:w-80" />
          <FilterSelect param="action" placeholder="All actions" label="Action" options={actions.map((a) => ({ value: a.action, label: `${actionLabel(a.action)} (${a._count._all})` }))} />
          <FilterSelect param="entity" placeholder="All entities" label="Entity" options={entities.map((e) => ({ value: e.entity, label: `${e.entity} (${e._count._all})` }))} />
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <DateFilter param="from" label="From date" />
            <span aria-hidden>–</span>
            <DateFilter param="to" label="To date" />
          </div>
        </FilterBar>
        <Table>
          <THead>
            <TR>
              <TH className="w-8">
                <span className="sr-only">Expand</span>
              </TH>
              <TH>When</TH>
              <TH>Action</TH>
              <TH>Actor</TH>
              <TH>Entity</TH>
              <TH className="hidden lg:table-cell">Summary</TH>
              <TH>IP</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={7}>
                <span className="inline-flex flex-col items-center gap-2">
                  <ScrollText className="size-6 text-slate-400" />
                  {action || entity || q || range ? "No audit entries match these filters." : "No audit entries yet."}
                </span>
              </EmptyRow>
            ) : (
              <AuditRows rows={rows} />
            )}
          </TBody>
        </Table>
        <Pagination page={page} pageSize={pageSize} total={total} />
      </Card>
    </>
  );
}
