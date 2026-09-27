import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, badRequest, formFields, formFile, notFound, route, validate } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { saveUpload, deleteStoredFile } from "@/lib/files";
import { LIMITS, SETTLEMENT_MODES, SETTLEMENT_MODE_LABEL } from "@/lib/constants";
import { formatDate, formatINR, rupeesToPaise, toISTDateString } from "@/lib/format";
import { collegeBalance } from "@/app/admin/college-payments/_lib/finance";

const REF_REQUIRED = new Set(["BANK_TRANSFER", "UPI", "CHEQUE"]);

const schema = z
  .object({
    collegeId: z.string().min(1, "Select a college"),
    amount: z.coerce.number({ message: "Enter the amount in rupees" }).positive("Amount must be greater than zero"),
    mode: z.enum(SETTLEMENT_MODES, { message: "Select a payment mode" }),
    reference: z.string().trim().max(80, "Reference is too long").optional().default(""),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select the payment date"),
    remarks: z.string().trim().max(500, "Remarks must be 500 characters or fewer").optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (REF_REQUIRED.has(v.mode) && v.reference.length < 4) {
      ctx.addIssue({ code: "custom", path: ["reference"], message: v.mode === "CHEQUE" ? "Enter the cheque number" : "Enter the UTR / transaction reference" });
    }
    if (v.date > toISTDateString()) ctx.addIssue({ code: "custom", path: ["date"], message: "Payment date cannot be in the future" });
    if (!/^\d+(\.\d{1,2})?$/.test(String(v.amount))) ctx.addIssue({ code: "custom", path: ["amount"], message: "Use at most two decimal places" });
  });

/** Record a settlement paid to a college (FR-ADM-10, WF-5). Multipart: fields + optional `proof` file. */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Send the settlement as multipart form data");
  }
  const body = validate(schema, formFields(form));
  const balance = await collegeBalance(body.collegeId);
  if (!balance) throw notFound("College not found");
  const amount = rupeesToPaise(body.amount);
  if (balance.pending <= 0) throw new ApiError(422, "This college has no pending balance to settle.", { amount: "No pending balance" });
  if (amount > balance.pending) {
    throw new ApiError(422, `Amount cannot exceed the pending balance of ${formatINR(balance.pending)}.`, { amount: `Maximum ${formatINR(balance.pending)}` });
  }

  const proof = formFile(form, "proof");
  const file = proof
    ? await saveUpload(proof, { purpose: "SETTLEMENT_PROOF", allowed: ["pdf", "jpg", "png"], maxBytes: LIMITS.documentBytes, ownerUserId: auth.user.id, label: "Payment proof" })
    : null;

  let settlement;
  try {
    settlement = await prisma.collegeSettlement.create({
      data: {
        collegeId: body.collegeId,
        amount,
        mode: body.mode,
        reference: body.reference || null,
        remarks: body.remarks || null,
        proofFileId: file?.id ?? null,
        date: new Date(`${body.date}T12:00:00+05:30`),
        recordedById: auth.user.id,
      },
    });
  } catch (e) {
    await deleteStoredFile(file?.id);
    throw e;
  }

  await audit(auth.user.id, "SETTLEMENT", "CollegeSettlement", settlement.id, {
    collegeId: body.collegeId,
    college: balance.name,
    amount,
    mode: body.mode,
    reference: body.reference || null,
    date: body.date,
    pendingBefore: balance.pending,
    pendingAfter: balance.pending - amount,
    proofFileId: file?.id ?? null,
  });
  await notify([balance.adminUserId], {
    kind: "PAYMENT",
    title: "Settlement payment received",
    body: `MSY College has recorded a settlement of ${formatINR(amount)} via ${SETTLEMENT_MODE_LABEL[body.mode]}${body.reference ? ` (ref. ${body.reference})` : ""} dated ${formatDate(body.date)}.`,
    link: "/college/payments",
  });
  return { id: settlement.id, pending: balance.pending - amount };
});
