import { cn } from "@/components/ui/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="rkg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#3730a3" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#rkg)" />
      <path d="M16 46V18h7.6L32 32.4 40.4 18H48v28h-6.8V30.2L34.8 41h-5.6l-6.4-10.8V46z" fill="#fff" />
      <circle cx="52" cy="12" r="3.5" fill="#fbbf24" />
    </svg>
  );
}

export function Wordmark({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Logo className="size-9" />
      <span className="leading-tight">
        <span className={cn("block font-display text-lg font-extrabold tracking-tight", light ? "text-white" : "text-slate-900")}>
          MSY <span className={light ? "text-accent-400" : "text-brand-600"}>College</span>
        </span>
        <span className={cn("block text-[10.5px] font-medium tracking-wide", light ? "text-brand-200" : "text-slate-500")}>NEP 2020 Internship ERP</span>
      </span>
    </span>
  );
}
