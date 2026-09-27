import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";

const paidWithLogin: Prisma.StudentWhereInput = { paymentStatus: "PAID", userId: { not: null }, user: { active: true } };

/** Search paid students who can receive messages (for the recipient picker). */
export const GET = route(async (req) => {
  await requireApiRole("ADMIN");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  const where: Prisma.StudentWhereInput = {
    ...paidWithLogin,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { registrationNumber: { contains: q.toUpperCase() } },
            { portalRegNo: { contains: q.toUpperCase() } },
            { mobile: { contains: q } },
            { email: { contains: q.toLowerCase() } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.student.findMany({
      where,
      take: 20,
      orderBy: { name: "asc" },
      select: { id: true, name: true, registrationNumber: true, portalRegNo: true, college: { select: { code: true } }, domain: { select: { code: true } } },
    }),
    prisma.student.count({ where: paidWithLogin }),
  ]);
  return {
    total,
    students: rows.map((s) => ({ id: s.id, name: s.name, regNo: s.portalRegNo ?? s.registrationNumber, college: s.college.code, domain: s.domain?.code ?? null })),
  };
});

const schema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(120, "Title must be at most 120 characters"),
    message: z.string().trim().min(5, "Message must be at least 5 characters").max(2000, "Message must be at most 2,000 characters"),
    audience: z.enum(["ALL_PAID", "SELECTED"]),
    studentIds: z.array(z.string().min(1)).max(1000).optional(),
  })
  .refine((v) => v.audience === "ALL_PAID" || (v.studentIds?.length ?? 0) > 0, { path: ["studentIds"], message: "Select at least one student" });

/** Send an announcement to all paid students or selected paid students (FR-ADM-2). */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, schema);
  const recipients = await prisma.student.findMany({
    where: { ...paidWithLogin, ...(body.audience === "SELECTED" ? { id: { in: [...new Set(body.studentIds)] } } : {}) },
    select: { id: true, userId: true },
  });
  if (!recipients.length) throw new ApiError(422, body.audience === "SELECTED" ? "None of the selected students can receive messages." : "There are no paid students to message yet.");
  const sent = await notify(
    recipients.map((r) => r.userId),
    { title: body.title, body: body.message, kind: "MESSAGE", link: "/student" },
  );
  await audit(auth.user.id, "MESSAGE", "Notification", null, {
    title: body.title,
    audience: body.audience,
    recipients: sent,
    ...(body.audience === "SELECTED" ? { studentIds: recipients.map((r) => r.id) } : {}),
  });
  return { sent };
});
