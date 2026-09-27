import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route, zEmail, zMobile10, zPassword, zUsername, zYmd } from "@/lib/http";
import { hashPassword } from "@/lib/auth";
import { istDate, toISTDateString } from "@/lib/format";
import { assertEditable, assertReached, regStateOrThrow, requireRegStudent } from "@/lib/registration";

const text = (label: string, max = 100) =>
  z.string({ error: `${label} is required` }).trim().min(2, `${label} is required`).max(max, `${label} is too long`);
const pick = (label: string) => z.string({ error: `Select ${label}` }).trim().min(1, `Select ${label}`);

const schema = z
  .object({
    fatherName: text("Father's name"),
    gender: z.enum(["MALE", "FEMALE", "OTHER"], { error: "Select your gender" }),
    dob: zYmd,
    programme: pick("your programme"),
    majorSubject: text("Major subject"),
    session: pick("your session"),
    semester: pick("your semester"),
    mobile: zMobile10,
    email: zEmail,
    username: zUsername.transform((v) => v.toLowerCase()),
    password: z.union([zPassword, z.literal("")]).optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.password && v.password !== v.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
  });

async function allowed(type: string, value: string, current: string | null) {
  if (value === current) return true;
  return Boolean(await prisma.masterOption.findFirst({ where: { type, value, active: true }, select: { id: true } }));
}

/** Step 2 — confirm personal/academic details and create (or update) the student login. */
export const POST = route(async (req) => {
  const student = await requireRegStudent();
  assertEditable(student);
  assertReached(student, 2);
  const body = await parseBody(req, schema);

  // Date of birth sanity (age 14–60).
  const today = toISTDateString();
  const year = Number(today.slice(0, 4));
  const minDob = `${year - 60}${today.slice(4)}`;
  const maxDob = `${year - 14}${today.slice(4)}`;
  if (isNaN(istDate(body.dob).getTime()) || body.dob < minDob || body.dob > maxDob) {
    throw new ApiError(422, "Enter a valid date of birth", { dob: "Enter a valid date of birth" });
  }

  const [p, se, sm] = await Promise.all([
    allowed("PROGRAMME", body.programme, student.programme),
    allowed("SESSION", body.session, student.session),
    allowed("SEMESTER", body.semester, student.semester),
  ]);
  const bad: Record<string, string> = {};
  if (!p) bad.programme = "Select a valid programme";
  if (!se) bad.session = "Select a valid session";
  if (!sm) bad.semester = "Select a valid semester";
  if (Object.keys(bad).length) throw new ApiError(422, Object.values(bad)[0]!, bad);

  if (!student.userId && !body.password) {
    throw new ApiError(422, "Password must be at least 8 characters", { password: "Password must be at least 8 characters" });
  }

  // Friendly uniqueness checks (the unique indexes remain the final guard).
  const [byUsername, byEmail] = await Promise.all([
    prisma.user.findUnique({ where: { username: body.username }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: body.email }, select: { id: true } }),
  ]);
  if (byUsername && byUsername.id !== student.userId) {
    throw new ApiError(409, "This username is already taken. Please choose another.", { username: "This username is already taken", code: "USERNAME_TAKEN" });
  }
  if (byEmail && byEmail.id !== student.userId) {
    throw new ApiError(409, "This email is already linked to another account.", { email: "This email is already linked to another account", code: "EMAIL_TAKEN" });
  }

  const passwordHash = body.password ? await hashPassword(body.password) : null;
  try {
    await prisma.$transaction(async (tx) => {
      let userId = student.userId;
      if (userId) {
        await tx.user.update({
          where: { id: userId },
          data: { username: body.username, email: body.email, ...(passwordHash ? { passwordHash } : {}) },
        });
      } else {
        const user = await tx.user.create({
          data: { username: body.username, email: body.email, passwordHash: passwordHash!, role: "STUDENT", active: false },
        });
        userId = user.id;
      }
      // Re-check the lock inside the transaction to avoid racing a confirmation.
      const res = await tx.student.updateMany({
        where: { id: student.id, registrationLocked: false, paymentStatus: { not: "PAID" } },
        data: {
          userId,
          fatherName: body.fatherName,
          gender: body.gender,
          dob: istDate(body.dob),
          programme: body.programme,
          majorSubject: body.majorSubject,
          session: body.session,
          semester: body.semester,
          mobile: body.mobile,
          email: body.email,
          nextStep: Math.max(student.nextStep, 3),
        },
      });
      if (res.count === 0) throw new ApiError(409, "Your registration is locked and can no longer be edited.", { code: "LOCKED" });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "This username or email is already in use. Please choose another.", { username: "Already in use", code: "USERNAME_TAKEN" });
    }
    throw e;
  }

  return { state: await regStateOrThrow(student.id) };
});
