"use client";
// URL-driven list controls: search box, select filters and pagination. They update the query string,
// so server components re-render with the new searchParams.
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { cn } from "./cn";

function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };
  return { sp, update, pending };
}

export function SearchInput({ param = "q", placeholder = "Search…", className }: { param?: string; placeholder?: string; className?: string }) {
  const { sp, update, pending } = useQueryUpdater();
  const [value, setValue] = useState(sp.get(param) ?? "");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => update({ [param]: value.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-9 pl-9 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none"
      />
      {pending ? (
        <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-slate-400" />
      ) : value ? (
        <button onClick={() => setValue("")} className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear">
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function FilterSelect({
  param,
  options,
  placeholder = "All",
  className,
  label,
}: {
  param: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  label?: string;
}) {
  const { sp, update } = useQueryUpdater();
  return (
    <select
      aria-label={label ?? placeholder}
      value={sp.get(param) ?? ""}
      onChange={(e) => update({ [param]: e.target.value || null })}
      className={cn(
        "h-10 max-w-full min-w-0 truncate rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm text-slate-700 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none",
        className,
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function DateFilter({ param, label, className }: { param: string; label?: string; className?: string }) {
  const { sp, update } = useQueryUpdater();
  return (
    <input
      type="date"
      aria-label={label}
      title={label}
      value={sp.get(param) ?? ""}
      onChange={(e) => update({ [param]: e.target.value || null })}
      className={cn("h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-brand-500 focus:outline-none", className)}
    />
  );
}

export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3", className)}>{children}</div>;
}

export function Pagination({ page, pageSize, total, className }: { page: number; pageSize: number; total: number; className?: string }) {
  const { update, pending } = useQueryUpdater();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-600", className)}>
      <span className="tabular-nums">
        {pending && <Loader2 className="mr-1.5 inline size-3.5 animate-spin" />}
        Showing <b>{from}</b>–<b>{to}</b> of <b>{total}</b>
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => update({ page: String(page - 1) })}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft className="size-4" /> Prev
        </button>
        <span className="px-2 tabular-nums">
          {page} / {pages}
        </span>
        <button
          disabled={page >= pages}
          onClick={() => update({ page: String(page + 1) })}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          Next <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
