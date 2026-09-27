import { ATTENDANCE_LABEL } from "@/lib/constants";
import { addDays, istWeekday } from "@/lib/format";
import { cn } from "@/components/ui/cn";

const TONE: Record<string, string> = {
  PRESENT: "bg-emerald-500 text-white",
  HALF_DAY: "bg-amber-400 text-white",
  ABSENT: "bg-rose-500 text-white",
  LEAVE: "bg-sky-500 text-white",
  NOT_MARKED: "bg-slate-100 text-slate-500",
  OFF: "text-slate-300",
  FUTURE: "text-slate-400 ring-1 ring-inset ring-slate-100",
};

/** Month grids for an internship window, colouring each day by attendance status (server component). */
export function AttendanceCalendar({ start, end, today, rows }: { start: string; end: string; today: string; rows: { date: string; status: string; remarks: string | null }[] }) {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const months: string[] = [];
  let cur = start.slice(0, 7);
  const last = end.slice(0, 7);
  let guard = 0;
  while (cur <= last && guard++ < 24) {
    months.push(cur);
    const [y, m] = cur.split("-").map(Number) as [number, number];
    cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {months.map((mk) => {
          const first = `${mk}-01`;
          const offset = istWeekday(first);
          const days: string[] = [];
          for (let d = first; d.startsWith(mk); d = addDays(d, 1)) days.push(d);
          const label = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${first}T12:00:00Z`));
          return (
            <div key={mk}>
              <p className="mb-2 text-sm font-semibold text-slate-800">{label}</p>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <span key={i} className="py-0.5 font-medium text-slate-400">{d}</span>
                ))}
                {Array.from({ length: offset }).map((_, i) => (
                  <span key={`e${i}`} />
                ))}
                {days.map((d) => {
                  const inWindow = d >= start && d <= end;
                  const row = byDate.get(d);
                  const sunday = istWeekday(d) === 0;
                  const key = row ? row.status : !inWindow || sunday ? "OFF" : d > today ? "FUTURE" : d === today ? "FUTURE" : "NOT_MARKED";
                  const title = row ? `${d}: ${ATTENDANCE_LABEL[row.status as keyof typeof ATTENDANCE_LABEL] ?? row.status}${row.remarks ? ` — ${row.remarks}` : ""}` : inWindow && !sunday && d < today ? `${d}: Not marked` : d;
                  return (
                    <span key={d} title={title} className={cn("flex aspect-square items-center justify-center rounded-md font-medium tabular-nums", TONE[key], d === today && "ring-2 ring-brand-500")}>
                      {Number(d.slice(8))}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
        {(["PRESENT", "HALF_DAY", "ABSENT", "LEAVE", "NOT_MARKED"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn("size-3 rounded", TONE[k])} /> {ATTENDANCE_LABEL[k]}
          </span>
        ))}
      </div>
    </div>
  );
}
