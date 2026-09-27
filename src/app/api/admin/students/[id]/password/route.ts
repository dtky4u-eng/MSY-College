import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route, zPassword } from "@/lib/http";
import { hashPassword, requireApiRole, revokeAllSessions } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { findStudentOr404 } from "../../_helpers";

const schema = z
  .object({ password: zPassword, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

/** Set a new login password for a registered student and sign them out everywhere (FR-ADM-6, NFR-5). */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const auth = await requireApiRole("ADMIN");
  const { id } = await params;
  const { password } = await parseBody(req, schema);
  const s = await findStudentOr404(id);
  if (!s.userId) throw new ApiError(409, "This student has not registered yet, so there is no login account to update.");
  const user = await prisma.user.findUnique({ where: { id: s.userId }, select: { id: true, role: true, username: true } });
  if (!user || user.role !== "STUDENT") throw new ApiError(409, "The linked login account could not be found.");

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  await revokeAllSessions(user.id);
  await audit(auth.user.id, "PASSWORD_CHANGE", "User", user.id, { studentId: s.id, username: user.username, by: "ADMIN", sessionsRevoked: true });
  await notify([user.id], { title: "Your password was changed", body: "An administrator set a new password for your account. Contact the helpdesk if you did not request this.", kind: "SYSTEM" });
  return { ok: true };
});
