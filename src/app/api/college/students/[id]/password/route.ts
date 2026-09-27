import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, notFound, parseBody, route, zPassword } from "@/lib/http";
import { hashPassword, requireCollege, revokeAllSessions } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z
  .object({ newPassword: zPassword, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

/** Change the password of a student of the college's own college (FR-COL-3, AR-5, NFR-2, NFR-5). */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const { college, auth } = await requireCollege("api");
  const body = await parseBody(req, schema);
  const student = await prisma.student.findFirst({ where: { id, collegeId: college.id }, select: { id: true, userId: true, name: true } });
  if (!student) throw notFound("Student not found");
  if (!student.userId) throw new ApiError(409, "This student has not created a login yet");
  await prisma.user.update({ where: { id: student.userId }, data: { passwordHash: await hashPassword(body.newPassword) } });
  await revokeAllSessions(student.userId);
  await audit(auth.user.id, "PASSWORD_CHANGE", "Student", student.id, { by: "COLLEGE", collegeId: college.id, userId: student.userId });
  return { changed: true };
});
