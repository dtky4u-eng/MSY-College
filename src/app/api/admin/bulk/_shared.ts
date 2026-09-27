import "server-only";
import type { BulkJob } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fileUrl } from "@/lib/files";
import { parseJson } from "@/lib/json";
import { isRunnerActive, operationLabel, reapStaleJobs, type JobLogEntry } from "@/lib/jobs/bulk";

export interface JobView {
  id: string;
  type: string;
  typeLabel: string;
  status: string;
  total: number;
  processed: number;
  failed: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdBy: string;
  reason: string | null;
  filters: Record<string, unknown>;
  options: Record<string, unknown>;
  retryOfId: string | null;
  resultUrl: string | null;
  resultSize: number | null;
  lastLog: JobLogEntry | null;
  log?: JobLogEntry[];
  active: boolean;
}

export async function serializeJobs(jobs: BulkJob[], withLog = false): Promise<JobView[]> {
  const [users, files] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [...new Set(jobs.map((j) => j.createdById))] } }, select: { id: true, username: true } }),
    prisma.fileObject.findMany({ where: { id: { in: jobs.map((j) => j.resultFileId).filter((x): x is string => Boolean(x)) } }, select: { id: true, size: true } }),
  ]);
  const uname = new Map(users.map((u) => [u.id, u.username]));
  const fsize = new Map(files.map((f) => [f.id, f.size]));
  return jobs.map((j) => {
    const log = parseJson<JobLogEntry[]>(j.log, []);
    const options = parseJson<Record<string, unknown>>(j.options, {});
    const { reason, ...rest } = options;
    return {
      id: j.id,
      type: j.type,
      typeLabel: operationLabel(j.type),
      status: j.status,
      total: j.total,
      processed: j.processed,
      failed: j.failed,
      createdAt: j.createdAt.toISOString(),
      startedAt: j.startedAt?.toISOString() ?? null,
      finishedAt: j.finishedAt?.toISOString() ?? null,
      createdBy: uname.get(j.createdById) ?? "—",
      reason: typeof reason === "string" ? reason : null,
      filters: parseJson<Record<string, unknown>>(j.filters, {}),
      options: rest,
      retryOfId: j.retryOfId,
      resultUrl: j.resultFileId && fsize.has(j.resultFileId) ? fileUrl(j.resultFileId, true) : null,
      resultSize: j.resultFileId ? fsize.get(j.resultFileId) ?? null : null,
      lastLog: log[log.length - 1] ?? null,
      ...(withLog ? { log } : {}),
      active: isRunnerActive(j.id),
    };
  });
}

export async function listJobs(take = 30) {
  await reapStaleJobs();
  const jobs = await prisma.bulkJob.findMany({ orderBy: { createdAt: "desc" }, take });
  return serializeJobs(jobs);
}
