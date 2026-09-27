import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { effectiveFee } from "@/lib/fees";
import { assertEditable, assertReached, regStateOrThrow, requireRegStudent } from "@/lib/registration";

const schema = z.object({
  declaration: z.literal(true, { error: "Please accept the declaration to continue" }),
});

/** Step 5 — confirm and lock the registration permanently (FR-REG-1, NFR-4). */
export const POST = route(async (req) => {
  const student = await requireRegStudent();
  assertEditable(student);
  assertReached(student, 5);
  await parseBody(req, schema);

  const missing: string[] = [];
  if (!student.userId) missing.push("login details");
  if (!student.fatherName || !student.gender || !student.dob || !student.programme || !student.majorSubject || !student.session || !student.semester) {
    missing.push("personal / academic details");
  }
  if (!student.mobile || !student.email) missing.push("contact details");
  if (!student.domainId) missing.push("internship domain");
  if (!student.photoFileId) missing.push("passport photo");
  if (!student.admitCardFileId) missing.push("admit card");
  if (missing.length) throw new ApiError(422, `Please complete: ${missing.join(", ")}.`, { code: "INCOMPLETE" });

  // Capture the fee in force at confirmation time.
  const fee = await effectiveFee(student.collegeId, student.domainId!);
  if (fee <= 0) throw new ApiError(422, "The fee for your domain is not configured yet. Please contact support.");

  const res = await prisma.student.updateMany({
    where: { id: student.id, registrationLocked: false, paymentStatus: { not: "PAID" } },
    data: { registrationLocked: true, lockedAt: new Date(), nextStep: 6, feeAmount: fee },
  });
  if (res.count === 0) throw new ApiError(409, "Your registration is already confirmed.", { code: "LOCKED" });
  return { state: await regStateOrThrow(student.id) };
});
