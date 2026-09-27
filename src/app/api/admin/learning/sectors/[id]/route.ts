import { prisma } from "@/lib/db";
import { conflict, notFound, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sectorSchema } from "@/components/admin/core/learning/schemas";
import { assertSectorNameFree, rethrowUnique } from "@/components/admin/core/learning/server";
import { plural } from "@/components/admin/core/learning/shared";

/** Rename a sector. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const sector = await prisma.sector.findUnique({ where: { id } });
  if (!sector) throw notFound("Sector not found");
  const body = await parseBody(req, sectorSchema);
  await assertSectorNameFree(body.name, id);
  await prisma.sector
    .update({ where: { id }, data: { name: body.name } })
    .catch((e) => rethrowUnique(e, { name: { field: "name", message: "A sector with this name already exists" } }));
  if (sector.name !== body.name) await audit(auth.user.id, "CONTENT", "Sector", id, { action: "UPDATE", name: { from: sector.name, to: body.name } });
  return { id };
});

/** Delete an empty sector; sectors with domains are protected. */
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const sector = await prisma.sector.findUnique({ where: { id }, include: { _count: { select: { domains: true } } } });
  if (!sector) throw notFound("Sector not found");
  if (sector._count.domains > 0) {
    throw conflict(`This sector has ${plural(sector._count.domains, "domain")} and cannot be deleted. Move or delete its domains first.`);
  }
  await prisma.sector.delete({ where: { id } });
  await audit(auth.user.id, "CONTENT", "Sector", id, { action: "DELETE", name: sector.name });
  return { deleted: true };
});
