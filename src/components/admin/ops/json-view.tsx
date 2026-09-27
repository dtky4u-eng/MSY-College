import { cn } from "@/components/ui/cn";

/** Pretty-printed JSON block for raw gateway payloads and audit details. */
export function JsonView({ value, className, emptyLabel = "No data" }: { value: unknown; className?: string; emptyLabel?: string }) {
  let data = value;
  if (typeof value === "string") {
    try {
      data = JSON.parse(value);
    } catch {
      data = value;
    }
  }
  const empty = data === null || data === undefined || data === "" || (typeof data === "object" && Object.keys(data as object).length === 0);
  if (empty) return <p className={cn("rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500", className)}>{emptyLabel}</p>;
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <pre className={cn("max-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-[11.5px] leading-relaxed text-slate-100 scrollbar-thin", className)}>
      {text}
    </pre>
  );
}
