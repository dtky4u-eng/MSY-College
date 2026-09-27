"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/client/api";
import { relativeTime } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import { useT } from "@/components/i18n";

interface Note {
  id: string;
  title: string;
  body: string;
  kind: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

/** FR-STU-13: unread count, mark read, mark all read. Polls every 60 s. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();

  const load = useCallback(async () => {
    try {
      const d = await api<{ items: Note[]; unread: number }>("/api/notifications");
      setItems(d.items);
      setUnread(d.unread);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const markRead = async (ids: string[] | "all") => {
    setItems((s) => s.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnread((u) => (ids === "all" ? 0 : Math.max(0, u - ids.length)));
    await api("/api/notifications/read", { body: ids === "all" ? { all: true } : { ids } }).catch(() => load());
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        aria-label={`${t("notifications.title")} (${unread})`}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-[18px] font-bold text-white ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 mt-2 animate-fade-in rounded-xl border border-slate-200 bg-white shadow-pop sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{t("notifications.title")}</p>
            {unread > 0 && (
              <button onClick={() => markRead("all")} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                <CheckCheck className="size-3.5" /> {t("notifications.markAll")}
              </button>
            )}
          </div>
          <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto scrollbar-thin">
            {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500">{t("notifications.empty")}</li>}
            {items.map((n) => {
              const inner = (
                <div className={cn("flex gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50", !n.read && "bg-brand-50/40")}>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-500")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    <p className="mt-0.5 line-clamp-3 text-[13px] text-slate-600">{n.body}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{relativeTime(n.createdAt)}</p>
                  </div>
                </div>
              );
              return (
                <li key={n.id} onClick={() => !n.read && markRead([n.id])}>
                  {n.link ? (
                    <Link href={n.link} onClick={() => setOpen(false)}>
                      {inner}
                    </Link>
                  ) : (
                    <button className="w-full">{inner}</button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
