"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Ban, Download, FileClock, ListChecks, RotateCcw, ScrollText } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { EmptyState, DetailList } from "@/components/ui/page";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { formatDateTime, formatTime, relativeTime } from "@/lib/format";
import type { JobView } from "@/app/api/admin/bulk/_shared";

const OPEN = new Set(["QUEUED", "RUNNING"]);

function useJobs(initial: JobView[]) {
  const [jobs, setJobs] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const res = await api<{ jobs: JobView[] }>("/api/admin/bulk");
      setJobs(res.jobs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh jobs");
    }
  }, []);
  const anyOpen = jobs.some((j) => OPEN.has(j.status));
  useEffect(() => {
    const onRefresh = () => void refresh();
    window.addEventListener("bulk:refresh", onRefresh);
    return () => window.removeEventListener("bulk:refresh", onRefresh);
  }, [refresh]);
  useEffect(() => {
    if (!anyOpen) return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [anyOpen, refresh]);
  return { jobs, refresh, error };
}

function sizeText(n: number | null) {
  if (!n) return "";
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function JobsPanel({ initial }: { initial: JobView[] }) {
  const { jobs, refresh, error } = useJobs(initial);
  const [logFor, setLogFor] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<JobView | null>(null);
  const cancel = useAction();
  const retry = useAction();

  return (
    <Card id="bulk-jobs" className="scroll-mt-20">
      <CardHeader
        title="Jobs"
        description={jobs.some((j) => OPEN.has(j.status)) ? "Live progress — refreshing every 2 seconds." : "Most recent 30 jobs."}
        icon={<ListChecks className="size-5" />}
        actions={
          <Button size="sm" variant="ghost" onClick={refresh}>
            Refresh
          </Button>
        }
      />
      {error && <p className="border-b border-rose-100 bg-rose-50 px-5 py-2 text-xs text-rose-700">{error}</p>}
      {jobs.length === 0 ? (
        <EmptyState icon={<FileClock />} title="No bulk jobs yet" description="Jobs you run appear here with live progress, logs and the result ZIP." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Operation</TH>
              <TH>Status</TH>
              <TH className="min-w-[200px]">Progress</TH>
              <TH>Started by</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {jobs.map((j) => {
              const pctDone = j.total ? Math.round((j.processed / j.total) * 100) : OPEN.has(j.status) ? 0 : 100;
              return (
                <TR key={j.id}>
                  <TD className="max-w-[280px]">
                    <p className="font-medium text-slate-900">{j.typeLabel}</p>
                    {j.reason && <p className="line-clamp-1 text-xs text-slate-500" title={j.reason}>“{j.reason}”</p>}
                    {j.retryOfId && <Badge tone="violet" className="mt-1">Retry</Badge>}
                  </TD>
                  <TD>
                    <StatusBadge status={j.status} />
                  </TD>
                  <TD>
                    <ProgressBar value={pctDone} size="sm" tone={j.status === "FAILED" ? "red" : j.failed ? "amber" : j.status === "COMPLETED" ? "green" : "brand"} showLabel />
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      {j.processed} / {j.total} processed{j.failed ? <span className="text-rose-600"> · {j.failed} failed</span> : null}
                    </p>
                    {j.lastLog && OPEN.has(j.status) && <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">{j.lastLog.message}</p>}
                  </TD>
                  <TD className="text-xs whitespace-nowrap">
                    <p className="text-slate-800">{j.createdBy}</p>
                    <p className="text-slate-500" title={formatDateTime(j.createdAt)}>
                      {relativeTime(j.createdAt)}
                    </p>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button size="xs" variant="outline" icon={<ScrollText className="size-3.5" />} onClick={() => setLogFor(j.id)}>
                        Log
                      </Button>
                      {j.resultUrl && (
                        <ButtonLink href={j.resultUrl} external size="xs" variant="secondary" icon={<Download className="size-3.5" />} title={`Download result ZIP ${sizeText(j.resultSize)}`}>
                          ZIP
                        </ButtonLink>
                      )}
                      {OPEN.has(j.status) ? (
                        <Button size="xs" variant="ghost" className="text-rose-600 hover:bg-rose-50" icon={<Ban className="size-3.5" />} onClick={() => setCancelFor(j)}>
                          Cancel
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={<RotateCcw className="size-3.5" />}
                          loading={retry.loading}
                          onClick={async () => {
                            const ok = await retry.run(() => api(`/api/admin/bulk/${j.id}/retry`, { method: "POST" }), { success: "Retry started", successDescription: "A new job was created with the same filters and options." });
                            if (ok) refresh();
                          }}
                        >
                          Retry
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
      <ConfirmDialog
        open={Boolean(cancelFor)}
        onClose={() => setCancelFor(null)}
        tone="danger"
        title="Cancel this job?"
        description={cancelFor ? `${cancelFor.typeLabel} · ${cancelFor.processed} of ${cancelFor.total} processed` : undefined}
        confirmLabel="Cancel job"
        loading={cancel.loading}
        onConfirm={async () => {
          if (!cancelFor) return;
          const ok = await cancel.run(() => api(`/api/admin/bulk/${cancelFor.id}/cancel`, { method: "POST" }), { success: "Cancellation requested" });
          if (ok) {
            setCancelFor(null);
            refresh();
          }
        }}
      >
        <p className="text-sm text-slate-600">The job stops before the next student. Records already created for processed students are kept, and a result ZIP is produced for the completed part.</p>
      </ConfirmDialog>
      {logFor && <LogModal id={logFor} onClose={() => setLogFor(null)} />}
    </Card>
  );
}

function LogModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [job, setJob] = useState<JobView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const j = await api<JobView>(`/api/admin/bulk/${id}`);
        if (stop) return;
        setJob(j);
        if (OPEN.has(j.status)) timer = setTimeout(load, 2000);
      } catch (e) {
        if (!stop) setErr(e instanceof Error ? e.message : "Could not load the job log");
      }
    };
    load();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [id]);
  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [job?.log?.length]);

  const f = job?.filters ?? {};
  const filterText = [
    f.collegeId && "college",
    f.domainId && "domain",
    f.session && `session ${String(f.session)}`,
    f.semester && `semester ${String(f.semester)}`,
    f.status && `status ${String(f.status).toLowerCase()}`,
    f.paymentStatus && String(f.paymentStatus).toLowerCase(),
    (f.startFrom || f.startTo) && `start ${String(f.startFrom ?? "…")} – ${String(f.startTo ?? "…")}`,
    Array.isArray(f.regNos) && f.regNos.length > 0 && `${f.regNos.length} reg. no(s).`,
  ].filter(Boolean);

  return (
    <Modal open onClose={onClose} size="xl" title={job ? `${job.typeLabel} job` : "Job log"} description={job ? `Created ${formatDateTime(job.createdAt)} by ${job.createdBy}` : undefined}>
      {err ? (
        <p className="text-sm text-rose-600">{err}</p>
      ) : !job ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <div className="space-y-4">
          <DetailList
            cols={3}
            items={[
              ["Status", <StatusBadge key="s" status={job.status} />],
              ["Progress", `${job.processed} / ${job.total} (${job.failed} failed)`],
              ["Finished", formatDateTime(job.finishedAt)],
              ["Filters", filterText.length ? filterText.join(", ") : "All students"],
              ["Reason", job.reason ?? "—"],
              ["Job ID", <span key="i" className="font-mono text-xs">{job.id}</span>],
            ]}
          />
          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-950 p-3 font-mono text-[11.5px] leading-relaxed scrollbar-thin" role="log" aria-live="polite">
            {(job.log ?? []).map((l, i) => (
              <p key={i} className={cn(l.level === "error" ? "text-rose-300" : l.level === "warn" ? "text-amber-300" : "text-slate-200")}>
                <span className="text-slate-500">{formatTime(l.at)}</span> {l.message}
              </p>
            ))}
            <div ref={endRef} />
          </div>
          {job.resultUrl && (
            <div className="flex justify-end">
              <ButtonLink href={job.resultUrl} external icon={<Download className="size-4" />}>
                Download result ZIP {sizeText(job.resultSize) && `(${sizeText(job.resultSize)})`}
              </ButtonLink>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
