import { prisma } from "@/lib/db";
import { ApiError, notFound, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rupeesToPaise } from "@/lib/format";
import { domainSchema } from "@/components/admin/core/learning/schemas";
import { assertDomainDeletable, deleteFiles, resourceFileIds, rethrowUnique } from "@/components/admin/core/learning/server";

const CODE_TAKEN = { code: { field: "code", message: "This domain code is already in use" } };
const TRACKED = ["code", "name", "description", "sectorId", "durationHours", "defaultFee", "active", "featured"] as const;

/** Update a domain. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const domain = await prisma.domain.findUnique({ where: { id } });
  if (!domain) throw notFound("Domain not found");
  const body = await parseBody(req, domainSchema);
  if (!(await prisma.sector.findUnique({ where: { id: body.sectorId } }))) throw new ApiError(422, "Choose a valid sector", { sectorId: "Choose a valid sector" });
  const clash = await prisma.domain.findUnique({ where: { code: body.code } });
  if (clash && clash.id !== id) throw new ApiError(409, CODE_TAKEN.code.message, { code: CODE_TAKEN.code.message });

  const data = {
    code: body.code,
    name: body.name,
    description: body.description,
    sectorId: body.sectorId,
    durationHours: body.durationHours,
    defaultFee: rupeesToPaise(body.defaultFee),
    active: body.active,
    featured: body.featured,
  };
  await prisma.domain.update({ where: { id }, data }).catch((e) => rethrowUnique(e, CODE_TAKEN));

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of TRACKED) if (domain[k] !== data[k]) changes[k] = { from: domain[k], to: data[k] };
  if (Object.keys(changes).length) await audit(auth.user.id, "CONTENT", "Domain", id, { action: "UPDATE", code: data.code, changes });
  return { id };
});

/** Delete a domain that has no students, mentors, delivery records or learning activity. */
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const domain = await prisma.domain.findUnique({ where: { id }, include: { _count: { select: { modules: true } } } });
  if (!domain) throw notFound("Domain not found");
  await assertDomainDeletable(id);
  const files = await resourceFileIds({ module: { domainId: id } });
  await prisma.domain.delete({ where: { id } });
  await deleteFiles(files);
  await audit(auth.user.id, "CONTENT", "Domain", id, { action: "DELETE", code: domain.code, name: domain.name, modules: domain._count.modules, filesRemoved: files.length });
  return { deleted: true };
});
