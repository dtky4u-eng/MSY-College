import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";

const MASTER_TYPES = ["SESSION", "SEMESTER", "PROGRAMME"] as const;

const createSchema = z
  .object({
    type: z.enum(MASTER_TYPES, { message: "Choose a type" }),
    value: z.string().trim().min(1, "Value is required").max(40, "Value is too long"),
    label: z.string().trim().max(80, "Label is too long").optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "SESSION" && !/^\d{4}-\d{2}$/.test(v.value)) ctx.addIssue({ code: "custom", path: ["value"], message: "Use the format YYYY-YY, e.g. 2025-29" });
    if (v.type === "SEMESTER" && !/^\d{1,2}$/.test(v.value)) ctx.addIssue({ code: "custom", path: ["value"], message: "Enter the semester number, e.g. 4" });
  });

const reorderSchema = z.object({ type: z.enum(MASTER_TYPES), ids: z.array(z.string().min(1)).min(1).max(200) });

/** Add a master-data option (G-4). */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, createSchema);
  const exists = await prisma.masterOption.findUnique({ where: { type_value: { type: body.type, value: body.value } } });
  if (exists) throw new ApiError(409, "This value already exists", { value: "This value already exists" });
  const last = await prisma.masterOption.findFirst({ where: { type: body.type }, orderBy: { sort: "desc" } });
  const label = body.label || (body.type === "SEMESTER" ? `Semester ${body.value}` : body.value);
  const opt = await prisma.masterOption.create({ data: { type: body.type, value: body.value, label, sort: (last?.sort ?? -1) + 1, active: true } });
  await audit(auth.user.id, "SETTINGS", "MasterOption", opt.id, { action: "CREATE", type: opt.type, value: opt.value, label: opt.label });
  return opt;
});

/** Reorder options of one type. */
export const PUT = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, reorderSchema);
  const existing = await prisma.masterOption.findMany({ where: { type: body.type }, select: { id: true } });
  const ids = new Set(existing.map((e) => e.id));
  if (body.ids.length !== ids.size || body.ids.some((id) => !ids.has(id))) throw new ApiError(422, "The option list has changed. Refresh the page and try again.");
  await prisma.$transaction(body.ids.map((id, i) => prisma.masterOption.update({ where: { id }, data: { sort: i } })));
  await audit(auth.user.id, "SETTINGS", "MasterOption", null, { action: "REORDER", type: body.type, ids: body.ids });
  return { ok: true };
});
