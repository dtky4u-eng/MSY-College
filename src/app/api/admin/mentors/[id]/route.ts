import { prisma } from "@/lib/db";
import { ApiError, conflict, notFound, parseBody, route } from "@/lib/http";
import { hashPassword, requireApiRole, revokeAllSessions } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertUserUnique, rethrowUnique } from "@/components/admin/core/server-data";
import { updateMentorSchema } from "../_schema";

const TRACKED = ["name", "employeeId", "mobile", "email", "domainId", "collegeId", "photoUrl", "designation", "active"] as const;

/** Update a mentor and their login; optional password reset (FR-ADM-5). */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const mentor = await prisma.mentor.findUnique({ where: { id }, include: { user: true, _count: { select: { students: true } } } });
  if (!mentor) throw notFound("Mentor not found");
  const body = await parseBody(req, updateMentorSchema);
  const username = (body.username ?? body.employeeId).toLowerCase();

  if (body.domainId !== mentor.domainId) {
    if (mentor._count.students > 0) {
      throw new ApiError(
        409,
        `This mentor has ${mentor._count.students} assigned student(s). Remove or reassign them before changing the domain.`,
        { domainId: "Remove assigned students before changing the domain" },
      );
    }
    if (!(await prisma.domain.findUnique({ where: { id: body.domainId } }))) throw new ApiError(422, "Choose a valid domain", { domainId: "Choose a valid domain" });
  }
  if (body.collegeId && !(await prisma.college.findUnique({ where: { id: body.collegeId } }))) {
    throw new ApiError(422, "Choose a valid college", { collegeId: "Choose a valid college" });
  }
  if (body.employeeId !== mentor.employeeId && (await prisma.mentor.findUnique({ where: { employeeId: body.employeeId } }))) {
    throw new ApiError(409, "This employee ID is already in use", { employeeId: "This employee ID is already in use" });
  }
  await assertUserUnique({ username, email: body.email ?? null, exceptUserId: mentor.userId, emailField: "email" });

  const data = {
    name: body.name,
    employeeId: body.employeeId,
    mobile: body.mobile ?? null,
    email: body.email ?? null,
    domainId: body.domainId,
    collegeId: body.collegeId ?? null,
    photoUrl: body.photoUrl ?? null,
    designation: body.designation ?? null,
    active: body.active,
  };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.mentor.update({ where: { id }, data });
      await tx.user.update({
        where: { id: mentor.userId },
        data: {
          username,
          email: body.email ?? null,
          active: body.active,
          ...(body.newPassword ? { passwordHash: await hashPassword(body.newPassword) } : {}),
        },
      });
    });
  } catch (err) {
    rethrowUnique(err, {
      employeeId: { field: "employeeId", message: "This employee ID is already in use" },
      username: { field: "username", message: "This username is already in use" },
      email: { field: "email", message: "This email is already linked to another login" },
    });
  }

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of TRACKED) if (mentor[k] !== data[k]) changes[k] = { from: mentor[k], to: data[k] };
  if (mentor.user.username !== username) changes.username = { from: mentor.user.username, to: username };
  if (Object.keys(changes).length) await audit(auth.user.id, "MENTOR_UPDATE", "Mentor", id, { employeeId: data.employeeId, changes });

  if (body.newPassword) {
    await revokeAllSessions(mentor.userId);
    await audit(auth.user.id, "PASSWORD_CHANGE", "User", mentor.userId, { target: "MENTOR", mentorId: id, username });
  } else if (mentor.active && !body.active) {
    await revokeAllSessions(mentor.userId);
  }
  return { id, passwordChanged: Boolean(body.newPassword) };
});

/** Delete a mentor who has never been assigned students or written assessments; otherwise deactivate. */
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const mentor = await prisma.mentor.findUnique({ where: { id }, include: { _count: { select: { students: true, assessments: true } } } });
  if (!mentor) throw notFound("Mentor not found");
  if (mentor._count.students || mentor._count.assessments) {
    throw conflict(
      mentor._count.students
        ? `This mentor has ${mentor._count.students} assigned student(s) and cannot be deleted. Remove the students first or mark the mentor inactive.`
        : "This mentor has submitted assessments and cannot be deleted. Mark the mentor inactive instead.",
    );
  }
  await prisma.$transaction(async (tx) => {
    await tx.mentor.delete({ where: { id } });
    await tx.session.deleteMany({ where: { userId: mentor.userId } });
    await tx.notification.deleteMany({ where: { userId: mentor.userId } });
    await tx.user.update({ where: { id: mentor.userId }, data: { active: false, username: `deleted-${mentor.userId}`, email: null } });
  });
  await audit(auth.user.id, "MENTOR_UPDATE", "Mentor", id, { action: "DELETE", employeeId: mentor.employeeId, name: mentor.name });
  return { deleted: true };
});
