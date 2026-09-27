"use client";
import { Check } from "lucide-react";
import { useT } from "@/components/i18n";
import { REG_STEPS } from "@/lib/constants";
import { cn } from "@/components/ui/cn";

/** 6-step progress indicator. `reachable` = highest step the student may open. */
export function Stepper({ current, reachable, done, onSelect }: { current: number; reachable: number; done: (n: number) => boolean; onSelect: (n: number) => void }) {
  const t = useT();
  const pct = ((Math.min(current, 6) - 1) / 5) * 100;
  return (
    <nav aria-label="Registration progress" className="mb-6">
      <div className="mb-3 flex items-center justify-between sm:hidden">
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">{t("reg.stepOf", { n: Math.min(current, 6) })}</p>
        <p className="text-sm font-semibold text-slate-900">{t(`reg.step.${REG_STEPS[Math.min(current, 6) - 1]}`)}</p>
      </div>
      <div className="relative sm:hidden">
        <div className="h-1.5 rounded-full bg-slate-200" />
        <div className="absolute inset-y-0 left-0 h-1.5 rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ol className="hidden items-center sm:flex">
        {REG_STEPS.map((key, i) => {
          const n = i + 1;
          const isCurrent = n === current;
          const isDone = done(n) && !isCurrent;
          const clickable = n > 1 && n <= reachable && !isCurrent;
          return (
            <li key={key} className={cn("flex items-center", n < 6 && "flex-1")}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onSelect(n)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn("group flex items-center gap-2 rounded-lg py-1 pr-2 text-left", clickable ? "cursor-pointer" : "cursor-default")}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 transition-colors",
                    isCurrent && "bg-brand-600 text-white ring-brand-600 shadow-sm shadow-brand-600/30",
                    isDone && "bg-emerald-50 text-emerald-700 ring-emerald-300",
                    !isCurrent && !isDone && "bg-white text-slate-500 ring-slate-300",
                    clickable && "group-hover:ring-brand-400",
                  )}
                >
                  {isDone ? <Check className="size-4" /> : n}
                </span>
                <span className={cn("hidden text-sm font-medium whitespace-nowrap md:inline", isCurrent ? "text-slate-900" : isDone ? "text-slate-700" : "text-slate-500")}>
                  {t(`reg.step.${key}`)}
                </span>
              </button>
              {n < 6 && <span className={cn("mx-2 h-px flex-1", done(n) ? "bg-emerald-300" : "bg-slate-200")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
