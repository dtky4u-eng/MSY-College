import "server-only";
import { prisma } from "./db";

/** Effective fee = college-specific fee if set, else the domain default (FR-ADM-4). Paise. */
export async function effectiveFee(collegeId: string, domainId: string): Promise<number> {
  const [custom, domain] = await Promise.all([
    prisma.collegeDomainFee.findUnique({ where: { collegeId_domainId: { collegeId, domainId } } }),
    prisma.domain.findUnique({ where: { id: domainId }, select: { defaultFee: true } }),
  ]);
  return custom?.fee ?? domain?.defaultFee ?? 0;
}

/** All active domains with the effective fee for a college. */
export async function domainsWithFees(collegeId: string) {
  const [domains, fees] = await Promise.all([
    prisma.domain.findMany({ where: { active: true }, include: { sector: true }, orderBy: [{ featured: "desc" }, { name: "asc" }] }),
    prisma.collegeDomainFee.findMany({ where: { collegeId } }),
  ]);
  const map = new Map(fees.map((f) => [f.domainId, f.fee]));
  return domains.map((d) => ({ ...d, fee: map.get(d.id) ?? d.defaultFee, customFee: map.has(d.id) }));
}
