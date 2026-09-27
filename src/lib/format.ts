// Formatting and date helpers shared by server and client code.
// All calendar dates are handled in IST (Asia/Kolkata) because the programme runs in India.

export const TZ = "Asia/Kolkata";

/** Paise → "₹1,499" (drops .00). */
export function formatINR(paise: number | null | undefined, opts: { decimals?: boolean } = {}): string {
  const rupees = (paise ?? 0) / 100;
  const hasFraction = Math.round(rupees * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: opts.decimals || hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export const rupeesToPaise = (r: number) => Math.round(r * 100);
export const paiseToRupees = (p: number) => Math.round(p) / 100;

export function formatNumber(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN").format(n ?? 0);
}

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!d) return "—";
  const date = typeof d === "string" ? (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T00:00:00+05:30") : new Date(d)) : d;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ, ...opts }).format(date);
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return formatDate(d, { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function formatTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: TZ }).format(date);
}

/** Date → "YYYY-MM-DD" in IST. */
export function toISTDateString(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "YYYY-MM-DD" → Date at IST midnight. */
export function istDate(ymd: string): Date {
  return new Date(ymd + "T00:00:00+05:30");
}

export function addDays(ymd: string, days: number): string {
  const d = istDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return toISTDateString(d);
}

/** Day of week (0 = Sunday) for an IST calendar date. */
export function istWeekday(ymd: string): number {
  return new Date(ymd + "T12:00:00+05:30").getUTCDay();
}

/** Working days (Mon–Sat) between two IST dates inclusive. */
export function workingDaysBetween(fromYmd: string, toYmd: string): string[] {
  const out: string[] = [];
  if (fromYmd > toYmd) return out;
  let cur = fromYmd;
  let guard = 0;
  while (cur <= toYmd && guard++ < 2000) {
    if (istWeekday(cur) !== 0) out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function relativeTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = (Date.now() - date.getTime()) / 1000;
  const abs = Math.abs(diff);
  const fmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return fmt.format(-Math.round(diff), "second");
  if (abs < 3600) return fmt.format(-Math.round(diff / 60), "minute");
  if (abs < 86400) return fmt.format(-Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return fmt.format(-Math.round(diff / 86400), "day");
  return formatDate(date);
}

export function hoursFromSeconds(s: number): number {
  return Math.round((s / 3600) * 10) / 10;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}
