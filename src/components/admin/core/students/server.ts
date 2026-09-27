// Server-side helpers shared by the admin Students and Internships pages.
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface Option {
  value: string;
  label: string;
}

export type MasterOptions = Record<"SESSION" | "SEMESTER" | "PROGRAMME", Option[]>;

/** Active admin-managed dropdown values (G-4), ordered by `sort`. */
export async function loadMasterOptions(): Promise<MasterOptions> {
  const rows = await prisma.masterOption.findMany({
    where: { active: true, type: { in: ["SESSION", "SEMESTER", "PROGRAMME"] } },
    orderBy: [{ sort: "asc" }, { label: "asc" }],
    select: { type: true, value: true, label: true },
  });
  const out: MasterOptions = { SESSION: [], SEMESTER: [], PROGRAMME: [] };
  for (const r of rows) out[r.type as keyof MasterOptions]?.push({ value: r.value, label: r.label });
  return out;
}

/** Keep a record's current value selectable even when it is no longer an active master option. */
export function withCurrent(options: Option[], current: string | null | undefined): Option[] {
  if (!current || options.some((o) => o.value === current)) return options;
  return [...options, { value: current, label: `${current} (not in master list)` }];
}

/** Session filter options: active master sessions plus any session values already on student records. */
export async function sessionFilterOptions(): Promise<Option[]> {
  const [master, used] = await Promise.all([
    prisma.masterOption.findMany({ where: { type: "SESSION" }, orderBy: [{ sort: "asc" }], select: { value: true, label: true, active: true } }),
    prisma.student.groupBy({ by: ["session"], where: { session: { not: null } } }),
  ]);
  const map = new Map<string, string>();
  for (const m of master) if (m.active) map.set(m.value, m.label);
  for (const u of used) if (u.session && !map.has(u.session)) map.set(u.session, u.session);
  return [...map.entries()].map(([value, label]) => ({ value, label }));
}

export async function collegeOptions(): Promise<Option[]> {
  const rows = await prisma.college.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true, status: true } });
  return rows.map((c) => ({ value: c.id, label: `${c.name} (${c.code})${c.status === "ACTIVE" ? "" : ` · ${c.status.toLowerCase()}`}` }));
}

export async function domainOptions(): Promise<(Option & { active: boolean })[]> {
  const rows = await prisma.domain.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true, active: true } });
  return rows.map((d) => ({ value: d.id, label: `${d.name} (${d.code})${d.active ? "" : " · inactive"}`, active: d.active }));
}

/** Free-text student search across name and identifiers (SQLite `contains`). */
export function studentSearchWhere(q: string | undefined): Prisma.StudentWhereInput {
  const term = q?.trim();
  if (!term) return {};
  const upper = term.toUpperCase();
  const digits = term.replace(/\D/g, "");
  return {
    OR: [
      { name: { contains: term } },
      { registrationNumber: { contains: upper } },
      { portalRegNo: { contains: upper } },
      { studentCode: { contains: upper } },
      { email: { contains: term.toLowerCase() } },
      ...(digits.length >= 3 ? [{ mobile: { contains: digits } }] : []),
    ],
  };
}

/** Read a single value from Next.js searchParams. */
export function spValue(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

export const REG_STEP_LABEL: Record<number, string> = {
  1: "Verify identity",
  2: "Personal details",
  3: "Choose domain",
  4: "Upload documents",
  5: "Review & confirm",
  6: "Payment",
  7: "Registration complete",
};
