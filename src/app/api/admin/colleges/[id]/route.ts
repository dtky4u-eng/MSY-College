import { prisma } from "@/lib/db";
import { ApiError, conflict, formFields, formFile, notFound, route, validate } from "@/lib/http";
import { hashPassword, requireApiRole, revokeAllSessions } from "@/lib/auth";
import { KIND_SETS, deleteStoredFile, saveUpload } from "@/lib/files";
import { LIMITS } from "@/lib/constants";
import { audit } from "@/lib/audit";
import { assertUserUnique, rethrowUnique } from "@/components/admin/core/server-data";
import { updateCollegeSchema } from "../_schema";

const TRACKED = ["name", "university", "principal", "coordinator", "email", "mobile", "state", "district", "pincode", "address", "collegeShare", "rknexoraShare", "status", "logoFileId"] as const;

/** Update a college (code is immutable) and its login; optional password reset (FR-ADM-3). */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const college = await prisma.college.findUnique({ where: { id }, include: { adminUser: true } });
  if (!college) throw notFound("College not found");

  const form = await req.formData().catch(() => {
    throw new ApiError(400, "Invalid form data");
  });
  const body = validate(updateCollegeSchema, formFields(form));
  if (body.code !== undefined && body.code.trim().toUpperCase() !== college.code) {
    throw new ApiError(422, "College code cannot be changed after creation", { code: "College code cannot be changed after creation" });
  }

  const loginEmail = body.loginEmail ?? null;
  const user = college.adminUser;
  await assertUserUnique({ username: body.username, email: loginEmail, exceptUserId: user?.id });
  if (!user && !body.newPassword) {
    throw new ApiError(422, "Set a password to create the college-admin login", { newPassword: "Set a password to create the college-admin login" });
  }

  const logo = formFile(form, "logo");
  const logoFile = logo
    ? await saveUpload(logo, { purpose: "LOGO", allowed: KIND_SETS.image, maxBytes: LIMITS.imageBytes, ownerUserId: auth.user.id, label: "Logo" })
    : null;
  const removeLogo = body.removeLogo === "1";
  const nextLogoId = logoFile ? logoFile.id : removeLogo ? null : college.logoFileId;

  const data = {
    name: body.name,
    university: body.university,
    principal: body.principal ?? null,
    coordinator: body.coordinator ?? null,
    email: body.email ?? null,
    mobile: body.mobile ?? null,
    state: body.state ?? null,
    district: body.district ?? null,
    pincode: body.pincode ?? null,
    address: body.address ?? null,
    collegeShare: body.collegeShare,
    rknexoraShare: body.rknexoraShare,
    status: body.status,
    logoFileId: nextLogoId,
  };

  let passwordChanged = false;
  let createdLogin = false;
  try {
    await prisma.$transaction(async (tx) => {
      let adminUserId = user?.id ?? null;
      if (user) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            username: body.username,
            email: loginEmail,
            ...(body.newPassword ? { passwordHash: await hashPassword(body.newPassword) } : {}),
          },
        });
        passwordChanged = Boolean(body.newPassword);
      } else {
        const created = await tx.user.create({
          data: { username: body.username, email: loginEmail, passwordHash: await hashPassword(body.newPassword!), role: "COLLEGE" },
        });
        adminUserId = created.id;
        createdLogin = true;
      }
      await tx.college.update({ where: { id }, data: { ...data, adminUserId } });
    });
  } catch (err) {
    await deleteStoredFile(logoFile?.id);
    rethrowUnique(err, {
      username: { field: "username", message: "This username is already in use" },
      email: { field: "loginEmail", message: "This email is already linked to another login" },
    });
  }

  if (college.logoFileId && college.logoFileId !== nextLogoId) await deleteStoredFile(college.logoFileId);

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of TRACKED) {
    const before = college[k];
    const after = data[k];
    if (before !== after) changes[k] = { from: before, to: after };
  }
  if (user && user.username !== body.username) changes.username = { from: user.username, to: body.username };
  if (user && (user.email ?? null) !== loginEmail) changes.loginEmail = { from: user.email, to: loginEmail };
  if (Object.keys(changes).length || createdLogin) {
    await audit(auth.user.id, "COLLEGE_UPDATE", "College", id, { code: college.code, changes, ...(createdLogin ? { createdLogin: body.username } : {}) });
  }
  if (passwordChanged && user) {
    await revokeAllSessions(user.id);
    await audit(auth.user.id, "PASSWORD_CHANGE", "User", user.id, { target: "COLLEGE", collegeId: id, username: body.username });
  }
  return { id, passwordChanged };
});

/** Delete a college that has no students, settlements or mentors yet. Otherwise mark it inactive. */
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const college = await prisma.college.findUnique({
    where: { id },
    include: { _count: { select: { students: true, settlements: true, mentors: true } } },
  });
  if (!college) throw notFound("College not found");
  const { students, settlements, mentors } = college._count;
  if (students || settlements || mentors) {
    const parts = [
      students && `${students} student${students === 1 ? "" : "s"}`,
      mentors && `${mentors} mentor${mentors === 1 ? "" : "s"}`,
      settlements && `${settlements} settlement${settlements === 1 ? "" : "s"}`,
    ].filter(Boolean);
    throw conflict(`This college has ${parts.join(", ")} and cannot be deleted. Set its status to Inactive instead.`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.college.delete({ where: { id } });
    if (college.adminUserId) {
      await tx.session.deleteMany({ where: { userId: college.adminUserId } });
      await tx.notification.deleteMany({ where: { userId: college.adminUserId } });
      await tx.user.update({ where: { id: college.adminUserId }, data: { active: false, username: `deleted-${college.adminUserId}`, email: null } });
    }
  });
  await deleteStoredFile(college.logoFileId);
  await audit(auth.user.id, "COLLEGE_UPDATE", "College", id, { action: "DELETE", code: college.code, name: college.name });
  return { deleted: true };
});
