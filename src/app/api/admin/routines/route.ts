import { prisma } from "@/lib/db";
import { ApiError, formFields, formFile, route, validate } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { deleteStoredFile, KIND_SETS, saveUpload } from "@/lib/files";
import { LIMITS } from "@/lib/constants";
import { fromISTInput } from "@/components/admin/ops/datetime";
import { checkDomain, readForm, routineSchema } from "./_shared";

/** Upload a routine (FR-ADM-12). Multipart: title, description, domainId, publishAt (IST), active, file. */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const form = await readForm(req);
  const body = validate(routineSchema, formFields(form));
  const file = formFile(form, "file");
  if (!file) throw new ApiError(422, "Attach the routine file", { file: "Attach a PDF, JPG, PNG or WEBP file" });
  await checkDomain(body.domainId);
  const saved = await saveUpload(file, { purpose: "ROUTINE", allowed: KIND_SETS.routine, maxBytes: LIMITS.routineBytes, ownerUserId: auth.user.id, label: "Routine file" });
  try {
    const r = await prisma.routine.create({
      data: { title: body.title, description: body.description, domainId: body.domainId, publishAt: fromISTInput(body.publishAt)!, active: body.active, fileId: saved.id },
    });
    await audit(auth.user.id, "CONTENT", "Routine", r.id, { operation: "CREATE", title: r.title, domainId: r.domainId, active: r.active, publishAt: r.publishAt });
    return { id: r.id };
  } catch (e) {
    await deleteStoredFile(saved.id);
    throw e;
  }
});
