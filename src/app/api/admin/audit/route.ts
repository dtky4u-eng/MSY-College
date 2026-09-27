import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pagination, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { istRange } from "@/components/admin/ops/lookups";

/** Paginated audit log (NFR-5). Filters: action, entity, q (actor / entity id), from, to. */
export const GET = route(async (req) => {
  await requireApiRole("ADMIN");
  const sp = req.nextUrl.searchParams;
  const { page, pageSize, skip, take } = pagination(sp, 25);
  const q = sp.get("q")?.trim();
  const range = istRange(sp.get("from"), sp.get("to"));
  const where: Prisma.AuditLogWhereInput = {
    ...(sp.get("action") ? { action: sp.get("action")! } : {}),
    ...(sp.get("entity") ? { entity: sp.get("entity")! } : {}),
    ...(range ? { createdAt: range } : {}),
    ...(q ? { OR: [{ actor: { username: { contains: q } } }, { actor: { email: { contains: q } } }, { entityId: { contains: q } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { actor: { select: { username: true, role: true } } } }),
  ]);
  return {
    page,
    pageSize,
    total,
    rows: rows.map((r) => ({ id: r.id, at: r.createdAt, action: r.action, actor: r.actor?.username ?? null, actorRole: r.actor?.role ?? null, entity: r.entity, entityId: r.entityId, details: JSON.parse(r.details || "{}"), ip: r.ip })),
  };
});
