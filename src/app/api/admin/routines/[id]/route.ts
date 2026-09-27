import { z } from "zod";
import { prisma } from "@/lib/db";
import { formFields, formFile, notFound, parseBody, route, validate } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { deleteStoredFile, KIND_SETS, saveUpload } from "@/lib/files";
import { LIMITS } from "@/lib/constants";
import { fromISTInput } from "@/components/admin/ops/datetime";
import { checkDomain, readForm, routineSchema } from "../_shared";

async function load(id: string) {
  const r = await prisma.routine.findUnique({ where: { id } });
  if (!r) throw notFound("Routine not found");
  return r;
}

/** Edit a routine; optionally replace its file (multipart). */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const existing = await load(id);
  const form = await readForm(req);
  const body = validate(routineSchema, formFields(form));
  await checkDomain(body.domainId);
  const file = formFile(form, "file");
  const saved = file ? await saveUpload(file, { purpose: "ROUTINE", allowed: KIND_SETS.routine, maxBytes: LIMITS.routineBytes, ownerUserId: auth.user.id, label: "Routine file" }) : null;
  try {
    await prisma.routine.update({
      where: { id },
      data: { title: body.title, description: body.description, domainId: body.domainId, publishAt: fromISTInput(body.publishAt)!, active: body.active, ...(saved ? { fileId: saved.id } : {}) },
    });
  } catch (e) {
    await deleteStoredFile(saved?.id);
    throw e;
  }
  if (saved) await deleteStoredFile(existing.fileId).catch(() => undefined);
  await audit(auth.user.id, "CONTENT", "Routine", id, { operation: "UPDATE", title: body.title, fileReplaced: Boolean(saved), active: body.active });
  return { id };
});

const toggleSchema = z.object({ active: z.boolean() });

/** Quick active / hidden toggle (JSON). */
export const PUT = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  await load(id);
  const { active } = await parseBody(req, toggleSchema);
  await prisma.routine.update({ where: { id }, data: { active } });
  await audit(auth.user.id, "CONTENT", "Routine", id, { operation: active ? "SHOW" : "HIDE" });
  return { id, active };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const r = await load(id);
  await prisma.routine.delete({ where: { id } });
  await deleteStoredFile(r.fileId).catch(() => undefined);
  await audit(auth.user.id, "CONTENT", "Routine", id, { operation: "DELETE", title: r.title });
  return { id };
});
