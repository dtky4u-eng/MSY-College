import { cn } from "./cn";

export function ProgressBar({
  value,
  className,
  tone = "brand",
  size = "md",
  showLabel,
}: {
  value: number;
  className?: string;
  tone?: "brand" | "green" | "amber" | "red";
  size?: "sm" | "md";
  showLabel?: boolean;
}) {
  const v = Math.max(0, Math.min(100, value || 0));
  const bar = { brand: "bg-brand-600", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-rose-500" }[tone];
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("w-full overflow-hidden rounded-full bg-slate-100", size === "sm" ? "h-1.5" : "h-2")}>
        <div className={cn("h-full rounded-full transition-[width] duration-500", bar)} style={{ width: `${v}%` }} />
      </div>
      {showLabel && <span className="w-10 shrink-0 text-right text-xs font-medium text-slate-600 tabular-nums">{Math.round(v)}%</span>}
    </div>
  );
}

export function ProgressRing({ value, size = 96, stroke = 9, label, sub }: { value: number; size?: number; stroke?: number; label?: React.ReactNode; sub?: React.ReactNode }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-slate-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          className="fill-none stroke-brand-600 transition-[stroke-dashoffset] duration-700"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-xl font-bold text-slate-900 tabular-nums">{label ?? `${Math.round(v)}%`}</span>
        {sub && <span className="text-[11px] text-slate-500">{sub}</span>}
      </div>
    </div>
  );
}
