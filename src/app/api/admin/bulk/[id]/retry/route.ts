import { prisma } from "@/lib/db";
import { conflict, notFound, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseJson } from "@/lib/json";
import { bulkFiltersSchema, bulkOperationSchema, bulkOptionsSchema, createBulkJob, operationLabel } from "@/lib/jobs/bulk";

/** Re-run a finished job as a new job with the same filters, options and reason. */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const job = await prisma.bulkJob.findUnique({ where: { id } });
  if (!job) throw notFound("Job not found");
  if (["QUEUED", "RUNNING"].includes(job.status)) throw conflict("This job is still running.");
  const type = bulkOperationSchema.parse(job.type);
  const filters = bulkFiltersSchema.parse(parseJson(job.filters, {}));
  const rawOptions = parseJson<Record<string, unknown>>(job.options, {});
  const options = bulkOptionsSchema.parse(rawOptions);
  const reason = typeof rawOptions.reason === "string" ? rawOptions.reason : null;
  const next = await createBulkJob({ type, filters, options, reason, actorId: auth.user.id, retryOfId: job.id });
  await audit(auth.user.id, "BULK_JOB", "BulkJob", next.id, { operation: "RETRY", type, title: operationLabel(type), retryOfId: job.id, reason, total: next.total });
  return { id: next.id, total: next.total };
});
