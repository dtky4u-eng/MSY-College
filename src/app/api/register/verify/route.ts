import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { clientIp, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { normaliseRegNo, regStateOrThrow, setRegCookie } from "@/lib/registration";
import type { VerifyResponse } from "@/components/register/types";

const schema = z.object({
  registrationNumber: z.string().trim().min(1, "Enter your University / College Registration Number").max(60, "Registration number is too long"),
  password: z.string().max(128).optional(),
});

const field = (message: string, code: string, status = 422) => new ApiError(status, message, { registrationNumber: message, code });

/**
 * Step 1 — match the University/College Registration Number (admit card) against the record uploaded
 * by the college. Roll number, mobile number and MSY College number are rejected with specific guidance.
 */
export const POST = route(async (req): Promise<VerifyResponse> => {
  const body = await parseBody(req, schema);
  const ip = clientIp(await headers()) ?? "local";
  rateLimit(`reg-verify:${ip}`, 30, 10 * 60 * 1000);

  const raw = body.registrationNumber.trim();
  const regNo = normaliseRegNo(raw);
  rateLimit(`reg-verify:${regNo}`, 10, 10 * 60 * 1000);

  if (/^MSY\d+$/i.test(regNo)) {
    throw field(
      "This looks like an MSY College registration number. Please enter the University/College Registration Number printed on your admit card.",
      "PORTAL_NUMBER",
    );
  }

  const student =
    (await prisma.student.findUnique({ where: { registrationNumber: regNo }, include: { college: true } })) ??
    (raw !== regNo ? await prisma.student.findUnique({ where: { registrationNumber: raw }, include: { college: true } }) : null);

  if (!student) {
    const digits = regNo.replace(/^\+?91/, "");
    if (/^\d{10}$/.test(digits) && /^[6-9]/.test(digits)) {
      throw field("Mobile numbers are not accepted. Please enter the University/College Registration Number from your admit card.", "MOBILE");
    }
    const byRoll = await prisma.student.findFirst({ where: { OR: [{ rollNumber: raw }, { rollNumber: regNo }] }, select: { id: true } });
    if (byRoll) {
      throw field("This is a roll number. Please enter the University/College Registration Number from your admit card.", "ROLL_NUMBER");
    }
    throw field(
      "We could not find this registration number. Check it against your admit card, or ask your college to upload your record to MSY College.",
      "NOT_FOUND",
      404,
    );
  }

  if (student.paymentStatus === "PAID") return { alreadyRegistered: true };

  if (student.college.status !== "ACTIVE") {
    throw field(
      "Your college's onboarding with MSY College is not active yet, so registration is not open for your college. Please contact your college coordinator.",
      "COLLEGE_INACTIVE",
      403,
    );
  }

  // Security hardening: once credentials exist, resuming requires the password set in step 2.
  if (student.userId) {
    const user = await prisma.user.findUnique({ where: { id: student.userId } });
    if (user) {
      if (!body.password) return { needsPassword: true };
      rateLimit(`reg-verify-pw:${student.id}`, 8, 10 * 60 * 1000);
      if (!(await verifyPassword(body.password, user.passwordHash))) {
        throw new ApiError(401, "Incorrect password. Try again or reset your password.", { password: "Incorrect password", code: "BAD_PASSWORD" });
      }
    }
  }

  if (student.nextStep < 2) await prisma.student.update({ where: { id: student.id }, data: { nextStep: 2 } });
  await setRegCookie(student.id);
  return { state: await regStateOrThrow(student.id) };
});
