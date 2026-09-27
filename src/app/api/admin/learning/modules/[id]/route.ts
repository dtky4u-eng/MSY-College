import { prisma } from "@/lib/db";
import { ApiError, notFound, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { moduleUpdateSchema } from "@/components/admin/core/learning/schemas";
import { assertModuleDeletable, deleteFiles, resourceFileIds, rethrowUnique } from "@/components/admin/core/learning/server";

/** Update a module's number, name or description. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const mod = await prisma.module.findUnique({ where: { id } });
  if (!mod) throw notFound("Module not found");
  const body = await parseBody(req, moduleUpdateSchema);
  const taken = `Module ${body.number} already exists in this domain`;
  const clash = await prisma.module.findUnique({ where: { domainId_number: { domainId: mod.domainId, number: body.number } } });
  if (clash && clash.id !== id) throw new ApiError(409, taken, { number: taken });

  await prisma.module
    .update({ where: { id }, data: { number: body.number, name: body.name, description: body.description } })
    .catch((e) => rethrowUnique(e, { number: { field: "number", message: taken } }));
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of ["number", "name", "description"] as const) if (mod[k] !== body[k]) changes[k] = { from: mod[k], to: body[k] };
  if (Object.keys(changes).length) await audit(auth.user.id, "CONTENT", "Module", id, { action: "UPDATE", domainId: mod.domainId, changes });
  return { id };
});

/** Delete a module (with its chapters, resources and quizzes) when no learner activity depends on it. */
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const mod = await prisma.module.findUnique({ where: { id }, include: { _count: { select: { chapters: true } } } });
  if (!mod) throw notFound("Module not found");
  await assertModuleDeletable(id);
  const files = await resourceFileIds({ moduleId: id });
  await prisma.module.delete({ where: { id } });
  await deleteFiles(files);
  await audit(auth.user.id, "CONTENT", "Module", id, { action: "DELETE", domainId: mod.domainId, number: mod.number, name: mod.name, chapters: mod._count.chapters });
  return { deleted: true, domainId: mod.domainId };
});
