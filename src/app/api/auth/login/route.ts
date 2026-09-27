import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { clientIp, startSession, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your username, email or registration number"),
  password: z.string().min(1, "Enter your password"),
});

/** AR-1: login by username, email or MSY College registration number. */
export const POST = route(async (req) => {
  const { identifier, password } = await parseBody(req, schema);
  const ip = clientIp(await headers()) ?? "local";
  rateLimit(`login:${ip}`, 30, 10 * 60 * 1000);
  rateLimit(`login:${identifier.toLowerCase()}`, 8, 10 * 60 * 1000);

  const id = identifier.trim();
  const user =
    (await prisma.user.findFirst({ where: { OR: [{ username: id }, { username: id.toLowerCase() }, { email: id.toLowerCase() }] } })) ??
    (await prisma.student.findUnique({ where: { portalRegNo: id.toUpperCase() }, include: { user: true } }))?.user ??
    null;

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new ApiError(401, "Invalid credentials. Check your username / email / registration number and password.");
  }

  if (!user.active) {
    if (user.role === "STUDENT") {
      throw new ApiError(403, "Your account is not active yet. Complete the registration payment to activate it.", { code: "PAYMENT_PENDING" });
    }
    throw new ApiError(403, "Your account has been deactivated. Please contact MSY College support.");
  }

  const redirect = await startSession(user);
  return { redirect, role: user.role };
});
