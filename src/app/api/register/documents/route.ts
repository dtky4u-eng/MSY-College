import { prisma } from "@/lib/db";
import { ApiError, formFile, route } from "@/lib/http";
import { KIND_SETS, deleteStoredFile, saveUpload } from "@/lib/files";
import { LIMITS } from "@/lib/constants";
import { assertEditable, assertReached, regStateOrThrow, requireRegStudent } from "@/lib/registration";

const KINDS = {
  photo: { purpose: "PHOTO", allowed: KIND_SETS.image, maxBytes: LIMITS.imageBytes, label: "Passport photo", column: "photoFileId" },
  admitCard: {
    purpose: "ADMIT_CARD",
    allowed: KIND_SETS.imageOrPdf.filter((k) => k !== "webp"),
    maxBytes: LIMITS.documentBytes,
    label: "Admit card",
    column: "admitCardFileId",
  },
} as const;

/** Step 4 — upload the passport photo or admit card (multipart: kind=photo|admitCard, file). */
export const POST = route(async (req) => {
  const student = await requireRegStudent();
  assertEditable(student);
  assertReached(student, 4);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "Upload a file");
  }
  const kind = String(form.get("kind") ?? "");
  if (kind !== "photo" && kind !== "admitCard") throw new ApiError(422, "Unknown document type");
  const cfg = KINDS[kind];
  const file = formFile(form, "file");
  if (!file) throw new ApiError(422, `Choose a ${cfg.label.toLowerCase()} to upload`, { [kind]: `${cfg.label} is required` });

  const saved = await saveUpload(file, {
    purpose: cfg.purpose,
    allowed: [...cfg.allowed],
    maxBytes: cfg.maxBytes,
    label: cfg.label,
    ownerUserId: student.userId,
    studentId: student.id,
  });

  const previous = student[cfg.column];
  const hasOther = kind === "photo" ? Boolean(student.admitCardFileId) : Boolean(student.photoFileId);
  const res = await prisma.student.updateMany({
    where: { id: student.id, registrationLocked: false, paymentStatus: { not: "PAID" } },
    data: { [cfg.column]: saved.id, ...(hasOther ? { nextStep: Math.max(student.nextStep, 5) } : {}) },
  });
  if (res.count === 0) {
    await deleteStoredFile(saved.id);
    throw new ApiError(409, "Your registration is locked and can no longer be edited.", { code: "LOCKED" });
  }
  if (previous && previous !== saved.id) await deleteStoredFile(previous).catch(() => undefined);

  return { state: await regStateOrThrow(student.id) };
});
