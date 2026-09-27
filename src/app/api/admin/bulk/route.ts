import { z } from "zod";
import { ApiError, parseBody, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { CONFIRM_WORD, GENERATING_OPS, bulkFiltersSchema, bulkOperationSchema, bulkOptionsSchema, createBulkJob, operationLabel } from "@/lib/jobs/bulk";
import { listJobs } from "./_shared";

export const GET = route(async () => {
  await requireApiRole("ADMIN");
  return { jobs: await listJobs() };
});

const schema = z.object({
  type: bulkOperationSchema,
  filters: bulkFiltersSchema,
  options: bulkOptionsSchema.optional(),
  reason: z.string().trim().max(500, "Reason must be 500 characters or fewer").optional().default(""),
  confirm: z.string().trim().optional().default(""),
});

/** Create and start a bulk job (FR-ADM-13). Data-generating operations need a reason and the confirmation word (G-9). */
export const POST = route(async (req) => {
  const auth = await requireApiRole("ADMIN");
  const body = await parseBody(req, schema);
  const generating = GENERATING_OPS.has(body.type);
  if (generating) {
    const fields: Record<string, string> = {};
    if (body.reason.length < 10) fields.reason = "Explain why records are being generated (at least 10 characters)";
    if (body.confirm !== CONFIRM_WORD) fields.confirm = `Type ${CONFIRM_WORD} to confirm`;
    if (Object.keys(fields).length) throw new ApiError(422, Object.values(fields)[0]!, fields);
  }
  const job = await createBulkJob({ type: body.type, filters: body.filters, options: body.options ?? bulkOptionsSchema.parse({}), reason: body.reason || null, actorId: auth.user.id });
  await audit(auth.user.id, "BULK_JOB", "BulkJob", job.id, {
    operation: "CREATE",
    type: body.type,
    title: operationLabel(body.type),
    generating,
    reason: body.reason || null,
    total: job.total,
    filters: body.filters,
    options: body.options,
  });
  return { id: job.id, total: job.total };
});
