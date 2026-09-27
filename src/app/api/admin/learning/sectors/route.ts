import { prisma } from "@/lib/db";
import { parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sectorSchema } from "@/components/admin/core/learning/schemas";
import { assertSectorNameFree, rethrowUnique } from "@/components/admin/core/learning/server";

/** List sectors with domain counts. */
export const GET = route(async () => {
  await requireApiRole("ADMIN");
  const sectors = await prisma.sector.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { domains: true } } } });
  return sectors.map((s) => ({ id: s.id, name: s.name, domains: s._count.domains }));
});

/** Create a sector (FR-ADM-8). */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, sectorSchema);
  await assertSectorNameFree(body.name);
  const sector = await prisma.sector
    .create({ data: { name: body.name } })
    .catch((e) => rethrowUnique(e, { name: { field: "name", message: "A sector with this name already exists" } }));
  await audit(auth.user.id, "CONTENT", "Sector", sector.id, { action: "CREATE", name: sector.name });
  return { id: sector.id };
});
