import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, route, validate, zEmail, zMobile10, zOptStr } from "@/lib/http";
import { requireCollege } from "@/lib/auth";
import { audit } from "@/lib/audit";

const optPincode = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine((v) => !v || /^\d{6}$/.test(v), "Pincode must be 6 digits")
  .transform((v) => (v ? v : null));

const schema = z.object({
  name: z.string().trim().min(3, "College name must be at least 3 characters").max(200),
  university: z.string().trim().min(2, "Enter the affiliating university").max(200),
  principal: zOptStr.pipe(z.string().max(120).nullable()),
  coordinator: zOptStr.pipe(z.string().max(120).nullable()),
  mobile: zMobile10,
  email: zEmail.pipe(z.string().max(160)),
  state: zOptStr.pipe(z.string().max(80).nullable()),
  district: zOptStr.pipe(z.string().max(80).nullable()),
  pincode: optPincode,
  address: zOptStr.pipe(z.string().max(500).nullable()),
});

/** Current college profile. */
export const GET = route(async () => {
  const { college } = await requireCollege("api");
  return college;
});

/** Update the college profile (FR-COL-6). The college code is immutable. */
export const PATCH = route(async (req) => {
  const { college, auth } = await requireCollege("api");
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if ("code" in r && r.code !== college.code) throw new ApiError(422, "College code cannot be changed", { code: "College code cannot be changed" });
    for (const k of ["collegeShare", "rknexoraShare", "status", "adminUserId", "logoFileId"]) {
      if (k in r) throw new ApiError(403, "Only MSY College administrators can change this setting");
    }
  }
  const body = validate(schema, raw);
  const updated = await prisma.college.update({ where: { id: college.id }, data: body });
  const changed = (Object.keys(body) as (keyof typeof body)[]).filter((k) => college[k] !== body[k]);
  if (changed.length) await audit(auth.user.id, "COLLEGE_UPDATE", "College", college.id, { fields: changed, by: "COLLEGE" });
  return updated;
});
