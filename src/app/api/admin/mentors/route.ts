import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { hashPassword, requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertUserUnique, rethrowUnique } from "@/components/admin/core/server-data";
import { createMentorSchema } from "./_schema";

/** Create a mentor and their login (FR-ADM-5). Username defaults to the employee ID in lower case. */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, createMentorSchema);
  const username = (body.username ?? body.employeeId).toLowerCase();

  const [domain, college, dupe] = await Promise.all([
    prisma.domain.findUnique({ where: { id: body.domainId } }),
    body.collegeId ? prisma.college.findUnique({ where: { id: body.collegeId } }) : Promise.resolve(null),
    prisma.mentor.findUnique({ where: { employeeId: body.employeeId } }),
  ]);
  if (!domain) throw new ApiError(422, "Choose a valid domain", { domainId: "Choose a valid domain" });
  if (body.collegeId && !college) throw new ApiError(422, "Choose a valid college", { collegeId: "Choose a valid college" });
  if (dupe) throw new ApiError(409, "This employee ID is already in use", { employeeId: "This employee ID is already in use" });
  await assertUserUnique({ username, email: body.email ?? null, emailField: "email" });

  try {
    const mentor = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { username, email: body.email ?? null, passwordHash: await hashPassword(body.password), role: "MENTOR", active: body.active },
      });
      return tx.mentor.create({
        data: {
          userId: user.id,
          name: body.name,
          employeeId: body.employeeId,
          mobile: body.mobile ?? null,
          email: body.email ?? null,
          domainId: body.domainId,
          collegeId: body.collegeId ?? null,
          photoUrl: body.photoUrl ?? null,
          designation: body.designation ?? null,
          active: body.active,
        },
      });
    });
    await audit(auth.user.id, "MENTOR_CREATE", "Mentor", mentor.id, { employeeId: mentor.employeeId, name: mentor.name, domain: domain.code, username });
    return { id: mentor.id };
  } catch (err) {
    rethrowUnique(err, {
      employeeId: { field: "employeeId", message: "This employee ID is already in use" },
      username: { field: "username", message: "This username is already in use" },
      email: { field: "email", message: "This email is already linked to another login" },
    });
  }
});
