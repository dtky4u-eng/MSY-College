import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireAnyStudent } from "@/app/student/_lib/server";

/** FR-STU-12: a student may edit only their mobile (10–15 digits) and email; everything else is read-only. */
export const PATCH = route(async (req) => {
  const { auth, student, t } = await requireAnyStudent();
  const schema = z
    .object({
      mobile: z.string().trim().regex(/^\+?\d{10,15}$/, t("profile.err.mobile")),
      email: z.string().trim().toLowerCase().max(160, t("profile.err.email")).email(t("profile.err.email")),
    })
    .strict();
  const body = await parseBody(req, schema);
  const clash = await prisma.user.findFirst({ where: { email: body.email, NOT: { id: auth.user.id } }, select: { id: true } });
  if (clash) throw new ApiError(409, t("profile.err.emailTaken"), { email: t("profile.err.emailTaken") });
  await prisma.$transaction([
    prisma.student.update({ where: { id: student.id }, data: { mobile: body.mobile, email: body.email } }),
    prisma.user.update({ where: { id: auth.user.id }, data: { email: body.email } }),
  ]);
  return { mobile: body.mobile, email: body.email };
});
