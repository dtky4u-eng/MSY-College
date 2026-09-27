"use client";
// FR-STU-13: live-class reminder. Polls every 60 s and pops up when a class of the student's domain starts within
// its popupMinutes (and has not ended). Join opens the meeting in a new tab and records the join; "I've left the class"
// records the leave. Dismissal is remembered per class id in localStorage.
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Radio, UserRound } from "lucide-react";
import { api } from "@/lib/client/api";
import { formatDateTime, formatTime } from "@/lib/format";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n";
import { LiveClassActions, startsInLabel, useLiveClassActions, useNow, type LiveClassItem } from "./live-classes";

const STORAGE_KEY = "rk_live_dismissed";

function readDismissed(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const v = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function writeDismissed(map: Record<string, number>) {
  try {
    // Drop entries older than 7 days so storage stays small.
    const cutoff = Date.now() - 7 * 86_400_000;
    const pruned = Object.fromEntries(Object.entries(map).filter(([, at]) => at > cutoff));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    /* storage unavailable — dismissal lasts for this page view only */
  }
}

export function LiveClassPopup() {
  const t = useT();
  const [items, setItems] = useState<LiveClassItem[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  const now = useNow(15_000);

  const load = useCallback(async () => {
    try {
      const d = await api<{ items: LiveClassItem[] }>("/api/student/live-classes/upcoming");
      setItems(d.items);
    } catch {
      /* offline or signed out — try again on the next tick */
    }
  }, []);

  useEffect(() => {
    setDismissed(readDismissed());
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const patch = useCallback((id: string, p: Partial<LiveClassItem>) => setItems((s) => s.map((c) => (c.id === id ? { ...c, ...p } : c))), []);
  const { join, leave, busy } = useLiveClassActions(patch);

  const current = useMemo(
    () =>
      items.find((c) => {
        const start = new Date(c.startsAt).getTime();
        const end = new Date(c.endsAt).getTime();
        return !dismissed[c.id] && now >= start - c.popupMinutes * 60_000 && now < end;
      }) ?? null,
    [items, dismissed, now],
  );

  const dismiss = () => {
    if (!current) return;
    const next = { ...dismissed, [current.id]: Date.now() };
    setDismissed(next);
    writeDismissed(next);
  };

  if (!current) return null;
  const live = new Date(current.startsAt).getTime() <= now;
  return (
    <Modal
      open
      onClose={dismiss}
      title={
        <span className="flex items-center gap-2">
          {live ? <Radio className="size-5 animate-pulse text-rose-600" /> : <CalendarClock className="size-5 text-brand-600" />}
          {live ? t("live.popupLiveTitle") : t("live.popupSoonTitle")}
        </span>
      }
      description={t("live.popupDesc")}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={dismiss}>
            {t("live.dismiss")}
          </Button>
          <LiveClassActions c={current} now={now} join={join} leave={leave} busy={busy} size="md" />
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-slate-900">{current.title}</p>
          {live ? <Badge tone="red" dot>{t("live.liveNow")}</Badge> : <Badge tone="brand">{startsInLabel(current, t, now)}</Badge>}
        </div>
        {current.description && <p className="text-sm text-slate-600">{current.description}</p>}
        <dl className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">{t("live.time")}</dt>
            <dd className="font-medium text-slate-800">
              {formatDateTime(current.startsAt)} – {formatTime(current.endsAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t("live.trainer")}</dt>
            <dd className="flex items-center gap-1 font-medium text-slate-800">
              <UserRound className="size-3.5 text-slate-400" /> {current.trainer}
            </dd>
          </div>
          {(current.moduleName || current.chapterName) && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">{t("live.topic")}</dt>
              <dd className="font-medium text-slate-800">{[current.moduleName, current.chapterName].filter(Boolean).join(" · ")}</dd>
            </div>
          )}
        </dl>
        {current.joinedAt && !current.leftAt && <p className="text-xs text-emerald-700">{t("live.joinedHint")}</p>}
      </div>
    </Modal>
  );
}
