import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route, zPassword } from "@/lib/http";
import { hashPassword, requireApiRole, revokeAllSessions, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: zPassword, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

/** Change own password; other sessions are signed out (NFR-2). */
export const POST = route(async (req) => {
  const auth = await requireApiRole();
  const body = await parseBody(req, schema);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
  if (!(await verifyPassword(body.currentPassword, user.passwordHash))) throw new ApiError(422, "Current password is incorrect", { currentPassword: "Current password is incorrect" });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } });
  await revokeAllSessions(user.id, auth.sessionId);
  await audit(user.id, "PASSWORD_CHANGE", "User", user.id, { self: true });
  return { changed: true };
});
