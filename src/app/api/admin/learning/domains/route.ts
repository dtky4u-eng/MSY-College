import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rupeesToPaise } from "@/lib/format";
import { domainSchema } from "@/components/admin/core/learning/schemas";
import { rethrowUnique } from "@/components/admin/core/learning/server";

const CODE_TAKEN = { code: { field: "code", message: "This domain code is already in use" } };

/** Create a domain under a sector (FR-ADM-8). */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, domainSchema);
  const sector = await prisma.sector.findUnique({ where: { id: body.sectorId } });
  if (!sector) throw new ApiError(422, "Choose a valid sector", { sectorId: "Choose a valid sector" });
  if (await prisma.domain.findUnique({ where: { code: body.code } })) throw new ApiError(409, CODE_TAKEN.code.message, { code: CODE_TAKEN.code.message });

  const domain = await prisma.domain
    .create({
      data: {
        code: body.code,
        name: body.name,
        description: body.description,
        sectorId: body.sectorId,
        durationHours: body.durationHours,
        defaultFee: rupeesToPaise(body.defaultFee),
        active: body.active,
        featured: body.featured,
      },
    })
    .catch((e) => rethrowUnique(e, CODE_TAKEN));
  await audit(auth.user.id, "CONTENT", "Domain", domain.id, { action: "CREATE", code: domain.code, name: domain.name, sector: sector.name, defaultFee: domain.defaultFee });
  return { id: domain.id };
});
