import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { moduleCreateSchema } from "@/components/admin/core/learning/schemas";
import { rethrowUnique } from "@/components/admin/core/learning/server";

/** Add a module to a domain. */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, moduleCreateSchema);
  const domain = await prisma.domain.findUnique({ where: { id: body.domainId }, select: { id: true, code: true } });
  if (!domain) throw new ApiError(422, "Domain not found", { domainId: "Domain not found" });
  const taken = `Module ${body.number} already exists in this domain`;
  if (await prisma.module.findUnique({ where: { domainId_number: { domainId: domain.id, number: body.number } } })) throw new ApiError(409, taken, { number: taken });

  const mod = await prisma.module
    .create({ data: { domainId: domain.id, number: body.number, name: body.name, description: body.description } })
    .catch((e) => rethrowUnique(e, { number: { field: "number", message: taken } }));
  await audit(auth.user.id, "CONTENT", "Module", mod.id, { action: "CREATE", domain: domain.code, number: mod.number, name: mod.name });
  return { id: mod.id };
});
