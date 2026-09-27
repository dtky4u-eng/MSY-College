import { prisma } from "@/lib/db";
import { ApiError, formFields, formFile, route, validate } from "@/lib/http";
import { hashPassword, requireApiRole } from "@/lib/auth";
import { KIND_SETS, deleteStoredFile, saveUpload } from "@/lib/files";
import { LIMITS } from "@/lib/constants";
import { audit } from "@/lib/audit";
import { assertUserUnique, rethrowUnique } from "@/components/admin/core/server-data";
import { createCollegeSchema } from "./_schema";

/** Create a college together with its college-admin login (FR-ADM-3). Multipart: fields + optional `logo`. */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const form = await req.formData().catch(() => {
    throw new ApiError(400, "Invalid form data");
  });
  const body = validate(createCollegeSchema, formFields(form));

  if (await prisma.college.findUnique({ where: { code: body.code } })) {
    throw new ApiError(409, "This college code is already in use", { code: "This college code is already in use" });
  }
  const loginEmail = body.loginEmail ?? null;
  await assertUserUnique({ username: body.username, email: loginEmail });

  const logo = formFile(form, "logo");
  const logoFile = logo
    ? await saveUpload(logo, { purpose: "LOGO", allowed: KIND_SETS.image, maxBytes: LIMITS.imageBytes, ownerUserId: auth.user.id, label: "Logo" })
    : null;

  try {
    const college = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { username: body.username, email: loginEmail, passwordHash: await hashPassword(body.password), role: "COLLEGE", active: true },
      });
      return tx.college.create({
        data: {
          code: body.code,
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
          logoFileId: logoFile?.id ?? null,
          adminUserId: user.id,
        },
      });
    });
    await audit(auth.user.id, "COLLEGE_CREATE", "College", college.id, {
      code: college.code,
      name: college.name,
      status: college.status,
      collegeShare: college.collegeShare,
      rknexoraShare: college.rknexoraShare,
      adminUsername: body.username,
    });
    return { id: college.id };
  } catch (err) {
    await deleteStoredFile(logoFile?.id);
    rethrowUnique(err, {
      code: { field: "code", message: "This college code is already in use" },
      username: { field: "username", message: "This username is already in use" },
      email: { field: "loginEmail", message: "This email is already linked to another login" },
    });
  }
});
