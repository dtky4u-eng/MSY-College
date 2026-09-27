import { prisma } from "@/lib/db";
import { notFound, route } from "@/lib/http";
import { requireApiRole } from "@/lib/auth";
import { reapStaleJobs } from "@/lib/jobs/bulk";
import { serializeJobs } from "../_shared";

/** Job detail including the full log. */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  await requireApiRole("ADMIN");
  await reapStaleJobs();
  const job = await prisma.bulkJob.findUnique({ where: { id } });
  if (!job) throw notFound("Job not found");
  return (await serializeJobs([job], true))[0];
});
