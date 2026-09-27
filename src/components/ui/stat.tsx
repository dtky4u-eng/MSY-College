import { cn } from "./cn";

type Tone = "brand" | "green" | "amber" | "red" | "blue" | "violet" | "teal" | "gray";

const toneCls: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-rose-50 text-rose-600",
  blue: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
  teal: "bg-teal-50 text-teal-600",
  gray: "bg-slate-100 text-slate-600",
};

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "brand",
  className,
  href,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  className?: string;
  href?: string;
}) {
  const body = (
    <div className={cn("flex h-full items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition", href && "hover:border-brand-200 hover:shadow-md", className)}>
      <div className="min-w-0">
        <p className="line-clamp-2 text-[13px] leading-snug font-medium text-slate-500">{label}</p>
        <p className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      {icon && <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl [&>svg]:size-5", toneCls[tone])}>{icon}</div>}
    </div>
  );
  return href ? (
    <a href={href} className="block">
      {body}
    </a>
  ) : (
    body
  );
}

export function StatGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4", className)}>{children}</div>;
}
