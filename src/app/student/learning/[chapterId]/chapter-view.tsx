"use client";
// Chapter player: resource tabs, engagement heartbeats (FR-STU-6), requirement meters and completion (WF-2).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Code2, Download, ExternalLink, Eye, FileText, Info, Link2, NotebookText, Paperclip, PlayCircle, Video } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { Alert, EmptyState } from "@/components/ui/page";
import { cn } from "@/components/ui/cn";
import { useT } from "@/components/i18n";
import { Markdown } from "@/components/student/markdown";
import { formatDuration } from "@/components/student/utils";
import { QuizPanel, type QuizPanelInfo } from "./quiz-panel";

export interface ChapterResource {
  id: string;
  title: string;
  type: string;
  url: string | null;
  embedUrl: string | null;
  fileUrl: string | null;
  downloadUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mime: string | null;
  content: string | null;
  downloadable: boolean;
  primary: boolean;
}

const HEARTBEAT_MS = 15_000;
type Kind = "watch" | "read" | null;

const ICON: Record<string, typeof Video> = { VIDEO: Video, PDF: FileText, NOTES: NotebookText, LINK: Link2, CODE: Code2, OTHER: Paperclip };

function human(bytes: number | null) {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ChapterView(props: {
  chapterId: string;
  moduleName: string;
  resources: ChapterResource[];
  tracking: boolean;
  canAct: boolean;
  minWatchSeconds: number;
  minReadSeconds: number;
  watchSeconds: number;
  readSeconds: number;
  completed: boolean;
  completedVia: string | null;
  quiz: QuizPanelInfo | null;
}) {
  const t = useT();
  const router = useRouter();
  const { run, loading } = useAction();
  const { resources, chapterId, minWatchSeconds, minReadSeconds } = props;
  const [activeId, setActiveId] = useState(resources[0]?.id ?? "");
  const [watch, setWatch] = useState(props.watchSeconds);
  const [read, setRead] = useState(props.readSeconds);
  const [playing, setPlaying] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => setWatch(props.watchSeconds), [props.watchSeconds]);
  useEffect(() => setRead(props.readSeconds), [props.readSeconds]);

  const active = resources.find((r) => r.id === activeId) ?? resources[0] ?? null;
  const isMp4 = Boolean(active?.type === "VIDEO" && active.fileUrl && (active.mime?.startsWith("video/") ?? false));
  const isYouTube = Boolean(active?.type === "VIDEO" && !isMp4 && active.embedUrl);

  // Which clock is running right now (G-6: YouTube counts while its panel is open and the page is visible).
  const kind: Kind = useMemo(() => {
    if (!active || !props.tracking) return null;
    if (active.type === "VIDEO") {
      if (isMp4) return playing ? "watch" : null;
      return isYouTube ? "watch" : null;
    }
    if (active.type === "NOTES" || active.type === "PDF") return "read";
    return null;
  }, [active, props.tracking, isMp4, isYouTube, playing]);

  // ── Heartbeats ──
  const acc = useRef<{ watch: number; read: number }>({ watch: 0, read: 0 });
  const kindRef = useRef<Kind>(kind);
  kindRef.current = kind;
  const stopped = useRef(false);

  const flush = useCallback(
    async (which: "watch" | "read") => {
      const seconds = Math.floor(acc.current[which]);
      if (seconds < 1 || stopped.current) return;
      acc.current[which] -= seconds;
      try {
        const r = await api<{ watchSeconds: number; readSeconds: number }>("/api/student/learning/heartbeat", { body: { chapterId, kind: which, seconds: Math.min(seconds, 120) } });
        setWatch(r.watchSeconds);
        setRead(r.readSeconds);
        setTrackError(null);
      } catch (e) {
        if (e instanceof ApiClientError && (e.status === 403 || e.status === 404 || e.status === 409)) {
          stopped.current = true;
          setTrackError(e.message);
        }
        // network errors: drop this beat silently; the next one will retry
      }
    },
    [chapterId],
  );

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!props.tracking) return;
    const tick = setInterval(() => {
      const k = kindRef.current;
      if (k && document.visibilityState === "visible") acc.current[k] += 1;
    }, 1000);
    const beat = setInterval(() => {
      void flush("watch");
      void flush("read");
    }, HEARTBEAT_MS);
    const onHide = () => {
      if (document.visibilityState !== "visible") {
        void flush("watch");
        void flush("read");
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(tick);
      clearInterval(beat);
      document.removeEventListener("visibilitychange", onHide);
      void flush("watch");
      void flush("read");
    };
  }, [props.tracking, flush]);

  // When the running clock changes (e.g. video → notes), send what the previous one collected right away,
  // so the server's elapsed-time window is not shared between two kinds in one beat.
  const prevKind = useRef<Kind>(kind);
  useEffect(() => {
    const p = prevKind.current;
    prevKind.current = kind;
    if (p && p !== kind) void flush(p);
  }, [kind, flush]);

  // Switching resources stops MP4 playback state.
  useEffect(() => setPlaying(false), [activeId]);

  const watchMet = watch >= minWatchSeconds;
  const readMet = read >= minReadSeconds;
  const requirementsMet = watchMet && readMet;
  const hasRequirements = minWatchSeconds > 0 || minReadSeconds > 0;

  const markComplete = async () => {
    await flush("watch");
    await flush("read");
    await run(() => api(`/api/student/learning/${chapterId}/complete`, { method: "POST" }), { success: t("learn.markedComplete"), refresh: true });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="min-w-0 space-y-6 xl:col-span-2">
        <Card className="overflow-hidden">
          {resources.length === 0 ? (
            <EmptyState icon={<FileText />} title={t("learn.noResources")} description={t("learn.noResourcesDesc")} />
          ) : (
            <>
              <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2 scrollbar-thin" role="tablist" aria-label={t("learn.resources")}>
                {resources.map((r) => {
                  const I = ICON[r.type] ?? Paperclip;
                  const sel = r.id === active?.id;
                  return (
                    <button
                      key={r.id}
                      role="tab"
                      aria-selected={sel}
                      onClick={() => setActiveId(r.id)}
                      className={cn(
                        "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                        sel ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700",
                      )}
                    >
                      <I className="size-4" />
                      <span className="max-w-[180px] truncate">{t(`res.${r.type}`)}</span>
                    </button>
                  );
                })}
              </div>
              {active && (
                <div role="tabpanel">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
                    <h2 className="text-[15px] font-semibold text-slate-900">{active.title}</h2>
                    {kind && visible && (
                      <Badge tone="green" dot>
                        {kind === "watch" ? t("learn.trackingWatch") : t("learn.trackingRead")}
                      </Badge>
                    )}
                  </div>
                  <div className="p-5">
                    <ResourceBody r={active} isMp4={isMp4} isYouTube={isYouTube} onPlaying={setPlaying} />
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
        {props.quiz && <QuizPanel quiz={props.quiz} canAct={props.canAct} requirementsMet={requirementsMet} completed={props.completed} beforeStart={async () => { await flush("watch"); await flush("read"); }} />}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title={t("learn.requirements")} description={props.moduleName} />
          <CardBody className="space-y-5">
            {props.completed ? (
              <Alert tone="success" icon={<CheckCircle2 />} title={t("learn.chapterCompleted")}>
                {props.completedVia === "QUIZ" ? t("learn.completedViaQuiz") : t("learn.completedManual")}
              </Alert>
            ) : null}
            {!hasRequirements && <p className="text-sm text-slate-500">{t("learn.noRequirements")}</p>}
            {minWatchSeconds > 0 && (
              <Meter icon={<PlayCircle className="size-4" />} label={t("learn.watchTime")} value={watch} target={minWatchSeconds} met={watchMet} />
            )}
            {minReadSeconds > 0 && <Meter icon={<Eye className="size-4" />} label={t("learn.readTime")} value={read} target={minReadSeconds} met={readMet} />}
            {trackError && <Alert tone="warning">{trackError}</Alert>}
            {props.tracking ? (
              <p className="flex gap-2 text-xs text-slate-500">
                <Info className="mt-0.5 size-3.5 shrink-0" /> {t("learn.trackingHint")}
              </p>
            ) : (
              <p className="flex gap-2 text-xs text-slate-500">
                <Info className="mt-0.5 size-3.5 shrink-0" /> {t("learn.trackingOff")}
              </p>
            )}
            {!props.quiz && !props.completed && props.canAct && (
              <div>
                <Button className="w-full" variant="success" icon={<CheckCircle2 className="size-4" />} disabled={!requirementsMet} loading={loading} onClick={markComplete}>
                  {t("learn.markComplete")}
                </Button>
                {!requirementsMet && <p className="mt-2 text-xs text-slate-500">{t("learn.markCompleteHint")}</p>}
              </div>
            )}
            {props.quiz && !props.completed && (
              <p className="text-xs text-slate-500">{requirementsMet ? t("learn.quizReady") : t("learn.quizNeedsReq")}</p>
            )}
            {props.completed && (
              <Button variant="outline" className="w-full" onClick={() => router.push("/student/learning")}>
                {t("learn.backToModules")}
              </Button>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Meter({ icon, label, value, target, met }: { icon: React.ReactNode; label: string; value: number; target: number; met: boolean }) {
  const t = useT();
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-slate-700">
          {icon} {label}
        </span>
        <span className={cn("text-xs font-semibold tabular-nums", met ? "text-emerald-600" : "text-slate-500")}>
          {formatDuration(Math.min(value, target))} / {formatDuration(target)}
        </span>
      </div>
      <ProgressBar value={(value / Math.max(1, target)) * 100} tone={met ? "green" : "brand"} />
      {met && (
        <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
          <CheckCircle2 className="size-3.5" /> {t("learn.met")}
        </p>
      )}
    </div>
  );
}

function ResourceBody({ r, isMp4, isYouTube, onPlaying }: { r: ChapterResource; isMp4: boolean; isYouTube: boolean; onPlaying: (p: boolean) => void }) {
  const t = useT();
  if (r.type === "VIDEO") {
    if (isMp4 && r.fileUrl)
      return (
        <div className="space-y-3">
          <video
            src={r.fileUrl}
            controls
            playsInline
            preload="metadata"
            controlsList={r.downloadable ? undefined : "nodownload"}
            onPlay={() => onPlaying(true)}
            onPause={() => onPlaying(false)}
            onEnded={() => onPlaying(false)}
            className="aspect-video w-full rounded-xl bg-black"
          >
            {t("learn.videoUnsupported")}
          </video>
          <p className="text-xs text-slate-500">{t("learn.mp4Hint")}</p>
          {r.downloadUrl && <DownloadRow r={r} />}
        </div>
      );
    if (isYouTube && r.embedUrl)
      return (
        <div className="space-y-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
            <iframe
              src={r.embedUrl}
              title={r.title}
              className="absolute inset-0 size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          <p className="text-xs text-slate-500">{t("learn.youtubeHint")}</p>
        </div>
      );
    if (r.url) return <ExternalCard r={r} />;
    return <p className="text-sm text-slate-500">{t("learn.resourceMissing")}</p>;
  }
  if (r.type === "PDF") {
    if (r.fileUrl)
      return (
        <div className="space-y-3">
          <iframe src={`${r.fileUrl}#toolbar=${r.downloadable ? 1 : 0}`} title={r.title} className="h-[70vh] min-h-[420px] w-full rounded-xl border border-slate-200 bg-slate-50" />
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={r.fileUrl} external target="_blank" rel="noopener" variant="outline" size="sm" icon={<ExternalLink className="size-4" />}>
              {t("learn.openNewTab")}
            </ButtonLink>
            {r.downloadUrl && (
              <ButtonLink href={r.downloadUrl} external variant="secondary" size="sm" icon={<Download className="size-4" />}>
                {t("action.download")} {r.fileSize ? `(${human(r.fileSize)})` : ""}
              </ButtonLink>
            )}
          </div>
        </div>
      );
    if (r.url) return <ExternalCard r={r} />;
    return <p className="text-sm text-slate-500">{t("learn.resourceMissing")}</p>;
  }
  if (r.type === "NOTES") {
    return (
      <div className="space-y-3">
        {r.content ? <Markdown source={r.content} /> : <p className="text-sm text-slate-500">{t("learn.notesEmpty")}</p>}
        {r.downloadUrl && <DownloadRow r={r} />}
      </div>
    );
  }
  if (r.type === "LINK") return <ExternalCard r={r} />;
  // CODE / OTHER
  return (
    <div className="space-y-3">
      {r.content && <Markdown source={r.content} />}
      {r.downloadUrl ? <DownloadRow r={r} /> : r.url ? <ExternalCard r={r} /> : !r.content ? <p className="text-sm text-slate-500">{t("learn.notDownloadable")}</p> : null}
    </div>
  );
}

function DownloadRow({ r }: { r: ChapterResource }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <Paperclip className="size-5 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{r.fileName ?? r.title}</p>
        {r.fileSize ? <p className="text-xs text-slate-500">{human(r.fileSize)}</p> : null}
      </div>
      <ButtonLink href={r.downloadUrl!} external variant="secondary" size="sm" icon={<Download className="size-4" />}>
        {t("action.download")}
      </ButtonLink>
    </div>
  );
}

function ExternalCard({ r }: { r: ChapterResource }) {
  const t = useT();
  if (!r.url) return <p className="text-sm text-slate-500">{t("learn.resourceMissing")}</p>;
  let host = r.url;
  try {
    host = new URL(r.url).hostname;
  } catch {
    /* keep raw */
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <ExternalLink className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{r.title}</p>
        <p className="truncate text-xs text-slate-500">{host}</p>
      </div>
      <ButtonLink href={r.url} external target="_blank" rel="noopener noreferrer" size="sm" icon={<ExternalLink className="size-4" />}>
        {t("learn.openLink")}
      </ButtonLink>
    </div>
  );
}
