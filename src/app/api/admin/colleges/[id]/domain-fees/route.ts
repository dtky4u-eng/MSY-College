import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, notFound, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { rupeesToPaise } from "@/lib/format";
import { audit } from "@/lib/audit";

const MAX_FEE_RUPEES = 1_000_000;
const feeRupees = z.coerce
  .number({ message: "Enter a valid amount" })
  .refine((v) => Number.isFinite(v), "Enter a valid amount")
  .refine((v) => v > 0, "Fee must be greater than ₹0")
  .refine((v) => v <= MAX_FEE_RUPEES, "Fee is too large")
  .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, "Use at most 2 decimal places");

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    fees: z.array(z.object({ domainId: z.string().min(1), fee: feeRupees.nullable() })).max(500),
  }),
  z.object({
    action: z.literal("bulk"),
    domainIds: z.union([z.literal("all"), z.array(z.string().min(1)).min(1, "Select at least one domain")]),
    fee: feeRupees,
  }),
  z.object({
    action: z.literal("reset"),
    domainIds: z.union([z.literal("all"), z.array(z.string().min(1)).min(1, "Select at least one domain")]),
  }),
]);

/** Per-college domain fee overrides (FR-ADM-4). Amounts arrive in rupees and are stored in paise. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const college = await prisma.college.findUnique({ where: { id }, select: { id: true, code: true } });
  if (!college) throw notFound("College not found");
  const body = await parseBody(req, schema);

  const allDomains = await prisma.domain.findMany({ select: { id: true, code: true } });
  const known = new Map(allDomains.map((d) => [d.id, d.code]));
  const existing = new Map((await prisma.collegeDomainFee.findMany({ where: { collegeId: id } })).map((f) => [f.domainId, f.fee]));

  const pickIds = (ids: "all" | string[]) => {
    const list = ids === "all" ? allDomains.map((d) => d.id) : [...new Set(ids)];
    const unknown = list.filter((d) => !known.has(d));
    if (unknown.length) throw new ApiError(422, "One or more domains no longer exist. Refresh the page and try again.");
    return list;
  };

  const changes: { domain: string; from: number | null; to: number | null }[] = [];

  if (body.action === "save") {
    const ids = pickIds(body.fees.map((f) => f.domainId));
    const byId = new Map(body.fees.map((f) => [f.domainId, f.fee]));
    await prisma.$transaction(async (tx) => {
      for (const domainId of ids) {
        const rupees = byId.get(domainId) ?? null;
        const before = existing.get(domainId) ?? null;
        if (rupees === null) {
          if (before !== null) {
            await tx.collegeDomainFee.delete({ where: { collegeId_domainId: { collegeId: id, domainId } } });
            changes.push({ domain: known.get(domainId)!, from: before, to: null });
          }
          continue;
        }
        const paise = rupeesToPaise(rupees);
        if (before === paise) continue;
        await tx.collegeDomainFee.upsert({
          where: { collegeId_domainId: { collegeId: id, domainId } },
          update: { fee: paise },
          create: { collegeId: id, domainId, fee: paise },
        });
        changes.push({ domain: known.get(domainId)!, from: before, to: paise });
      }
    });
  } else if (body.action === "bulk") {
    const ids = pickIds(body.domainIds);
    const paise = rupeesToPaise(body.fee);
    await prisma.$transaction(
      ids.map((domainId) =>
        prisma.collegeDomainFee.upsert({
          where: { collegeId_domainId: { collegeId: id, domainId } },
          update: { fee: paise },
          create: { collegeId: id, domainId, fee: paise },
        }),
      ),
    );
    for (const d of ids) if (existing.get(d) !== paise) changes.push({ domain: known.get(d)!, from: existing.get(d) ?? null, to: paise });
  } else {
    const ids = pickIds(body.domainIds);
    await prisma.collegeDomainFee.deleteMany({ where: { collegeId: id, domainId: { in: ids } } });
    for (const d of ids) if (existing.has(d)) changes.push({ domain: known.get(d)!, from: existing.get(d)!, to: null });
  }

  if (changes.length) {
    await audit(auth.user.id, "DOMAIN_FEE", "College", id, { code: college.code, action: body.action.toUpperCase(), changes });
  }
  return { changed: changes.length };
});
