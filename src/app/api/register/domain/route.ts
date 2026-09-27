import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { effectiveFee } from "@/lib/fees";
import { assertEditable, assertReached, regStateOrThrow, requireRegStudent } from "@/lib/registration";

const schema = z.object({ domainId: z.string().trim().min(1, "Please select a domain") });

/** Step 3 — pick exactly one internship domain; any stream may pick any domain. */
export const POST = route(async (req) => {
  const student = await requireRegStudent();
  assertEditable(student);
  assertReached(student, 3);
  const { domainId } = await parseBody(req, schema);

  const domain = await prisma.domain.findFirst({ where: { id: domainId, active: true }, select: { id: true } });
  if (!domain) throw new ApiError(422, "This domain is not open for registration", { domainId: "Select an available domain" });
  const fee = await effectiveFee(student.collegeId, domain.id);
  if (fee <= 0) throw new ApiError(422, "The fee for this domain is not configured yet. Please choose another domain or contact support.");

  const res = await prisma.student.updateMany({
    where: { id: student.id, registrationLocked: false, paymentStatus: { not: "PAID" } },
    data: { domainId: domain.id, feeAmount: fee, nextStep: Math.max(student.nextStep, 4) },
  });
  if (res.count === 0) throw new ApiError(409, "Your registration is locked and can no longer be edited.", { code: "LOCKED" });
  return { state: await regStateOrThrow(student.id) };
});
