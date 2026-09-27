import { prisma } from "@/lib/db";
import { conflict, notFound, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseJson } from "@/lib/json";
import { isRunnerActive, type JobLogEntry } from "@/lib/jobs/bulk";

/** Request cancellation; the runner stops before the next student. */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const auth = await requireApiRole("ADMIN");
  const job = await prisma.bulkJob.findUnique({ where: { id } });
  if (!job) throw notFound("Job not found");
  if (!["QUEUED", "RUNNING"].includes(job.status)) throw conflict("Only queued or running jobs can be cancelled.");
  const log = parseJson<JobLogEntry[]>(job.log, []);
  log.push({ at: new Date().toISOString(), level: "warn", message: `Cancellation requested by ${auth.user.username}.` });
  const running = isRunnerActive(id);
  await prisma.bulkJob.update({
    where: { id },
    // Without an active runner nothing will finalise the job, so close it here.
    data: { status: "CANCELLED", log: JSON.stringify(log.slice(-2000)), ...(running ? {} : { finishedAt: new Date() }) },
  });
  await audit(auth.user.id, "BULK_JOB", "BulkJob", id, { operation: "CANCEL", type: job.type, processed: job.processed, total: job.total });
  return { id, status: "CANCELLED" };
});
