import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { parseBody, route } from "@/lib/http";
import { clientIp, randomToken, sha256 } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { sendMail } from "@/lib/mail";
import { appUrl } from "@/lib/payments";

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your username, email or registration number").max(120),
});

const RESET_TTL_MS = 30 * 60 * 1000;
const GENERIC = "If an account matches the details you entered, we have sent a password reset link to its registered email address. The link is valid for 30 minutes.";

async function findAccount(identifier: string) {
  const id = identifier.trim();
  const lower = id.toLowerCase();
  const user = await prisma.user.findFirst({ where: { OR: [{ username: id }, { username: lower }, { email: lower }] }, include: { student: true } });
  if (user) return user;
  const student =
    (await prisma.student.findUnique({ where: { portalRegNo: id.toUpperCase() }, include: { user: { include: { student: true } } } })) ??
    (await prisma.student.findFirst({ where: { email: lower, userId: { not: null } }, include: { user: { include: { student: true } } } }));
  return student?.user ?? null;
}

/**
 * AR-4: email a single-use reset link. The response is always the same (no account enumeration);
 * only a hash of the token is stored.
 */
export const POST = route(async (req) => {
  const { identifier } = await parseBody(req, schema);
  const ip = clientIp(await headers()) ?? "local";
  rateLimit(`forgot:${ip}`, 10, 15 * 60 * 1000);
  rateLimit(`forgot:${identifier.toLowerCase()}`, 3, 15 * 60 * 1000);

  const user = await findAccount(identifier);
  const to = user ? (user.email ?? user.student?.email ?? null) : null;
  if (user && to) {
    const token = randomToken(32);
    await prisma.$transaction([
      // Only the newest link works.
      prisma.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } }),
    ]);
    const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const name = user.student?.name ?? user.username;
    await sendMail({
      to,
      subject: "Reset your MSY College password",
      text: `Dear ${name},\n\nWe received a request to reset the password for your MSY College account (username: ${user.username}).\n\nOpen this link to choose a new password (valid for 30 minutes, single use):\n${link}\n\nIf you did not request this, you can ignore this email — your password will not change.\n\nTeam MSY College\nHelpdesk: +91 9693275424 · helpdesk@msycollege.org`,
    }).catch((e) => console.error("[forgot-password] mail failed", e));
  }
  return { message: GENERIC };
});
