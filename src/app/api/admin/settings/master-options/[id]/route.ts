import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({
  label: z.string().trim().min(1, "Label is required").max(80, "Label is too long").optional(),
  active: z.boolean().optional(),
});

/** Edit an option's label or toggle it active. The stored value is immutable because student records reference it. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const opt = await prisma.masterOption.findUnique({ where: { id } });
  if (!opt) throw notFound("Option not found");
  const body = await parseBody(req, schema);
  const updated = await prisma.masterOption.update({ where: { id }, data: { ...(body.label !== undefined ? { label: body.label } : {}), ...(body.active !== undefined ? { active: body.active } : {}) } });
  await audit(auth.user.id, "SETTINGS", "MasterOption", id, {
    action: "UPDATE",
    type: opt.type,
    value: opt.value,
    ...(body.label !== undefined && body.label !== opt.label ? { label: { from: opt.label, to: body.label } } : {}),
    ...(body.active !== undefined && body.active !== opt.active ? { active: { from: opt.active, to: body.active } } : {}),
  });
  return updated;
});
