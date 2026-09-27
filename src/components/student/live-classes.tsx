"use client";
// FR-STU-13: live-class list + join/leave tracking shared by the dashboard and the reminder popup.
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, LogOut, Radio, Video } from "lucide-react";
import { api } from "@/lib/client/api";
import { formatDateTime, formatTime } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page";
import { useT } from "@/components/i18n";
import type { TFn } from "@/lib/i18n";

export interface LiveClassItem {
  id: string;
  title: string;
  description: string | null;
  trainer: string;
  meetingLink: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  popupMinutes: number;
  moduleName: string | null;
  chapterName: string | null;
  live: boolean;
  joinedAt: string | null;
  leftAt: string | null;
}

const safeLink = (href: string) => /^https?:\/\//i.test(href);

/** Opens from max(popupMinutes, 15) minutes before start, mirrors the server rule. */
export function joinOpen(c: LiveClassItem, now = Date.now()) {
  const start = new Date(c.startsAt).getTime();
  return now >= start - Math.max(c.popupMinutes, 15) * 60_000 && now < new Date(c.endsAt).getTime();
}

export function startsInLabel(c: LiveClassItem, t: TFn, now = Date.now()) {
  const start = new Date(c.startsAt).getTime();
  const end = new Date(c.endsAt).getTime();
  if (now >= end) return t("live.ended");
  if (now >= start) return t("live.liveNow");
  const mins = Math.ceil((start - now) / 60_000);
  if (mins < 60) return t("live.startsInMin", { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t("live.startsInHours", { n: hours });
  return formatDateTime(c.startsAt);
}

/** Join / leave actions with optimistic state. */
export function useLiveClassActions(onChange?: (id: string, patch: Partial<LiveClassItem>) => void) {
  const toast = useToast();
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);

  const join = useCallback(
    async (c: LiveClassItem) => {
      // Open synchronously inside the click so pop-up blockers allow it.
      if (safeLink(c.meetingLink)) window.open(c.meetingLink, "_blank", "noopener,noreferrer");
      setBusy(c.id);
      try {
        const r = await api<{ joinedAt: string }>(`/api/student/live-classes/${c.id}/join`, { method: "POST" });
        onChange?.(c.id, { joinedAt: r.joinedAt, leftAt: null });
        toast.success(t("live.joinedToast"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("error.generic"));
      } finally {
        setBusy(null);
      }
    },
    [onChange, toast, t],
  );

  const leave = useCallback(
    async (c: LiveClassItem) => {
      setBusy(c.id);
      try {
        const r = await api<{ leftAt: string }>(`/api/student/live-classes/${c.id}/leave`, { method: "POST" });
        onChange?.(c.id, { leftAt: r.leftAt });
        toast.success(t("live.leftToast"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("error.generic"));
      } finally {
        setBusy(null);
      }
    },
    [onChange, toast, t],
  );

  return { join, leave, busy };
}

/** Periodic clock for relative labels. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function LiveClassActions({ c, now, join, leave, busy, size = "sm" }: { c: LiveClassItem; now: number; join: (c: LiveClassItem) => void; leave: (c: LiveClassItem) => void; busy: string | null; size?: "sm" | "md" }) {
  const t = useT();
  const open = joinOpen(c, now);
  const inClass = Boolean(c.joinedAt && !c.leftAt);
  if (inClass)
    return (
      <div className="flex flex-wrap gap-2">
        <Button size={size} variant="secondary" icon={<Video className="size-4" />} onClick={() => join(c)} disabled={!open}>
          {t("live.rejoin")}
        </Button>
        <Button size={size} variant="outline" icon={<LogOut className="size-4" />} loading={busy === c.id} onClick={() => leave(c)}>
          {t("live.left")}
        </Button>
      </div>
    );
  return (
    <Button size={size} variant={open ? "primary" : "outline"} icon={<Video className="size-4" />} loading={busy === c.id} onClick={() => join(c)} disabled={!open} title={open ? undefined : t("live.joinOpensHint")}>
      {c.leftAt ? t("live.rejoin") : t("live.join")}
    </Button>
  );
}

/** Dashboard list of upcoming classes with Join. Initial data comes from the server; refreshes every 60 s. */
export function LiveClassList({ initial }: { initial: LiveClassItem[] }) {
  const t = useT();
  const [items, setItems] = useState(initial);
  const now = useNow(30_000);
  const patch = useCallback((id: string, p: Partial<LiveClassItem>) => setItems((s) => s.map((c) => (c.id === id ? { ...c, ...p } : c))), []);
  const { join, leave, busy } = useLiveClassActions(patch);

  useEffect(() => {
    const load = () =>
      api<{ items: LiveClassItem[] }>("/api/student/live-classes/upcoming")
        .then((d) => setItems(d.items))
        .catch(() => undefined);
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const visible = items.filter((c) => new Date(c.endsAt).getTime() > now);
  if (!visible.length) return <EmptyState icon={<CalendarClock />} title={t("live.emptyTitle")} description={t("live.emptyDesc")} className="py-10" />;
  return (
    <ul className="divide-y divide-slate-100">
      {visible.slice(0, 5).map((c) => {
        const live = new Date(c.startsAt).getTime() <= now;
        return (
          <li key={c.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <div className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-xl ${live ? "bg-rose-50 text-rose-600" : "bg-brand-50 text-brand-700"}`} aria-hidden>
              {live ? (
                <Radio className="size-5 animate-pulse" />
              ) : (
                <>
                  <span className="text-[10px] leading-none font-semibold uppercase">{new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(new Date(c.startsAt))}</span>
                  <span className="font-display text-base leading-tight font-bold">{new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(c.startsAt))}</span>
                </>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-900">{c.title}</p>
                {live ? <Badge tone="red" dot>{t("live.liveNow")}</Badge> : <Badge tone="brand">{startsInLabel(c, t, now)}</Badge>}
                {c.joinedAt && !c.leftAt && (
                  <Badge tone="green">
                    <CheckCircle2 className="size-3" /> {t("live.joined")}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatDateTime(c.startsAt)} – {formatTime(c.endsAt)} · {t("live.trainer")}: {c.trainer}
                {c.moduleName ? ` · ${c.moduleName}` : ""}
                {c.chapterName ? ` · ${c.chapterName}` : ""}
              </p>
            </div>
            <LiveClassActions c={c} now={now} join={join} leave={leave} busy={busy} />
          </li>
        );
      })}
    </ul>
  );
}
