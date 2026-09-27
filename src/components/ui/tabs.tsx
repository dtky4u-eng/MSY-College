"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "./cn";

export interface TabItem {
  key: string;
  label: React.ReactNode;
  count?: number;
}

/** Controlled tabs (client state). */
export function Tabs({ items, value, onChange, className }: { items: TabItem[]; value: string; onChange: (k: string) => void; className?: string }) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto border-b border-slate-200 scrollbar-thin", className)} role="tablist">
      {items.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
            value === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] tabular-nums", value === t.key ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Tabs bound to a URL search param (works with server components). */
export function LinkTabs({ items, param = "tab", className }: { items: TabItem[]; param?: string; className?: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get(param) ?? items[0]?.key;
  return (
    <div className={cn("flex gap-1 overflow-x-auto border-b border-slate-200 scrollbar-thin", className)}>
      {items.map((t) => {
        const next = new URLSearchParams(sp.toString());
        next.set(param, t.key);
        next.delete("page");
        return (
          <Link
            key={t.key}
            href={`${pathname}?${next.toString()}`}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              current === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 tabular-nums">{t.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}
