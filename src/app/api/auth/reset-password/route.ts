import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route, zPassword } from "@/lib/http";
import { clientIp, hashPassword, revokeAllSessions, sha256 } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

const schema = z
  .object({
    token: z.string().trim().min(10, "This reset link is invalid"),
    password: zPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

/** AR-4: complete a password reset with a valid, unexpired, unused token. */
export const POST = route(async (req) => {
  rateLimit(`reset:${clientIp(await headers()) ?? "local"}`, 20, 15 * 60 * 1000);
  const body = await parseBody(req, schema);
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(body.token) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    throw new ApiError(400, "This reset link is invalid or has expired. Please request a new one.", { code: "INVALID_TOKEN" });
  }
  const passwordHash = await hashPassword(body.password);
  const now = new Date();
  const claimed = await prisma.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: now } });
  if (claimed.count === 0) throw new ApiError(400, "This reset link has already been used. Please request a new one.", { code: "INVALID_TOKEN" });
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
    prisma.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: now } }),
  ]);
  await revokeAllSessions(reset.userId);
  await audit(reset.userId, "PASSWORD_RESET", "User", reset.userId, { via: "email_link" });
  return { ok: true };
});
