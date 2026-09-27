// Client-side validation mirroring the server schemas (the server re-validates every request).
import { addDays, toISTDateString } from "@/lib/format";

export const MOBILE_RE = /^[6-9]\d{9}$/;
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isRealYmd(v: string): boolean {
  if (!YMD_RE.test(v)) return false;
  const d = new Date(v + "T00:00:00+05:30");
  return !isNaN(d.getTime()) && toISTDateString(d) === v;
}

/** Default end date: start + N weeks − 1 day (same rule as `defaultEndDate` on the server). */
export function defaultEndYmd(start: string, weeks: number): string {
  return addDays(start, weeks * 7 - 1);
}

export function dateRangeErrors(start: string, end: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!start) e.startDate = "Choose a start date";
  else if (!isRealYmd(start)) e.startDate = "Use a valid date";
  if (!end) e.endDate = "Choose an end date";
  else if (!isRealYmd(end)) e.endDate = "Use a valid date";
  else if (start && isRealYmd(start) && end < start) e.endDate = "End date must be on or after the start date";
  else if (start && isRealYmd(start) && end > addDays(start, 366)) e.endDate = "An internship cannot be longer than one year";
  return e;
}

export function durationLabel(start: string, end: string): string | null {
  if (!isRealYmd(start) || !isRealYmd(end) || end < start) return null;
  const days = Math.round((new Date(end + "T00:00:00+05:30").getTime() - new Date(start + "T00:00:00+05:30").getTime()) / 86400000) + 1;
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  return `${days} day${days === 1 ? "" : "s"}${weeks ? ` (${weeks} week${weeks === 1 ? "" : "s"}${rest ? ` ${rest} day${rest === 1 ? "" : "s"}` : ""})` : ""}`;
}
