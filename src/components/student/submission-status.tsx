// WF-3 review status block (server component): status, mentor feedback, marks, current file and version history.
import { FileText, History, Lock, MessageSquareText } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { fileUrl } from "@/lib/files";
import { formatDateTime } from "@/lib/format";
import { parseJson } from "@/lib/json";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";

interface HistoryEntry {
  fileId: string | null;
  submittedAt: string;
  status: string;
  feedback: string | null;
  marks?: number | null;
}

export async function SubmissionStatus({
  submission,
  maxMarks,
  late,
  className,
}: {
  submission: { status: string; feedback: string | null; marks: number | null; version: number; submittedAt: Date; reviewedAt: Date | null; fileId: string | null; history: string };
  maxMarks?: number | null;
  late?: boolean;
  className?: string;
}) {
  const t = await getT();
  const history = parseJson<HistoryEntry[]>(submission.history, []).slice().reverse();
  const s = submission;
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={s.status} label={t(`sub.${s.status}`)} />
        {s.version > 1 && <Badge tone="gray">{t("sub.version", { n: s.version })}</Badge>}
        {late && <Badge tone="amber">{t("sub.late")}</Badge>}
        {s.status === "APPROVED" && (
          <Badge tone="green">
            <Lock className="size-3" /> {t("sub.lockedBadge")}
          </Badge>
        )}
        {s.marks !== null && s.marks !== undefined && (
          <Badge tone="brand">{maxMarks ? t("sub.marksOf", { marks: s.marks, max: maxMarks }) : t("sub.marks", { marks: s.marks })}</Badge>
        )}
      </div>
      <p className="text-xs text-slate-500">
        {t("sub.submittedOn", { date: formatDateTime(s.submittedAt) })}
        {s.reviewedAt ? ` · ${t("sub.reviewedOn", { date: formatDateTime(s.reviewedAt) })}` : ""}
      </p>
      {s.fileId && (
        <a href={fileUrl(s.fileId)!} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
          <FileText className="size-4" /> {t("sub.viewFile")}
        </a>
      )}
      {s.feedback && (
        <div className={cn("rounded-xl border px-3.5 py-3 text-sm", s.status === "RESUBMIT" ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900")}>
          <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase opacity-80">
            <MessageSquareText className="size-3.5" /> {t("sub.mentorFeedback")}
          </p>
          <p className="whitespace-pre-line">{s.feedback}</p>
        </div>
      )}
      {s.status === "PENDING" && <p className="text-xs text-slate-500">{t("sub.pendingHint")}</p>}
      {history.length > 0 && (
        <details className="group rounded-xl border border-slate-200 px-3.5 py-2.5">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-slate-600">
            <History className="size-3.5" /> {t("sub.history", { n: history.length })}
          </summary>
          <ul className="mt-2 space-y-2">
            {history.map((h, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">{t("sub.version", { n: history.length - i })}</span>
                <span>{formatDateTime(h.submittedAt)}</span>
                <StatusBadge status={h.status} label={t(`sub.${h.status}`)} />
                {h.fileId && (
                  <a href={fileUrl(h.fileId)!} target="_blank" rel="noopener" className="text-brand-600 hover:underline">
                    {t("sub.viewFile")}
                  </a>
                )}
                {h.feedback && <p className="w-full text-slate-500 italic">“{h.feedback}”</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
