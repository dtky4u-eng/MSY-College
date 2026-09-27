// Server-side lookups shared by the admin operations pages (filters and selects).
import "server-only";
import { prisma } from "@/lib/db";

export interface Option {
  value: string;
  label: string;
}

export async function collegeOptions(): Promise<Option[]> {
  const rows = await prisma.college.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } });
  return rows.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }));
}

export async function domainOptions(): Promise<Option[]> {
  const rows = await prisma.domain.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } });
  return rows.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }));
}

export async function masterOptions(type: "SESSION" | "SEMESTER" | "PROGRAMME"): Promise<Option[]> {
  const rows = await prisma.masterOption.findMany({ where: { type }, orderBy: [{ sort: "asc" }, { value: "asc" }], select: { value: true, label: true } });
  return rows.map((r) => ({ value: r.value, label: type === "SEMESTER" && /^\d+$/.test(r.label) ? `Semester ${r.label}` : r.label }));
}

/** All option lists used by student filters. */
export async function studentFilterOptions() {
  const [colleges, domains, sessions, semesters] = await Promise.all([collegeOptions(), domainOptions(), masterOptions("SESSION"), masterOptions("SEMESTER")]);
  return { colleges, domains, sessions, semesters };
}

/** Parse "YYYY-MM-DD" query values into an IST day range. */
export function istRange(from?: string | null, to?: string | null): { gte?: Date; lte?: Date } | undefined {
  const ok = (v?: string | null) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
  const range: { gte?: Date; lte?: Date } = {};
  if (ok(from)) range.gte = new Date(`${from}T00:00:00+05:30`);
  if (ok(to)) range.lte = new Date(`${to}T23:59:59.999+05:30`);
  return range.gte || range.lte ? range : undefined;
}

export const sp1 = (sp: Record<string, string | string[] | undefined>, k: string): string | undefined => {
  const v = sp[k];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
};
