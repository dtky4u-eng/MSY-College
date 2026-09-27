// Shared helpers for the admin student APIs.
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { notFound, zYmd } from "@/lib/http";
import { istDate, toISTDateString } from "@/lib/format";

/** "YYYY-MM-DD" that is a real calendar date (rejects 2026-02-30). */
export const zRealYmd = zYmd.refine((v) => {
  const d = istDate(v);
  return !isNaN(d.getTime()) && toISTDateString(d) === v;
}, "Use a valid date");

/** Empty strings become null before validation (form inputs send ""). */
export const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const zOptText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, `Must be ${max} characters or fewer`).nullable().optional()).transform((v) => (v ? v : null));

export async function findStudentOr404(id: string) {
  const s = await prisma.student.findUnique({ where: { id } });
  if (!s) throw notFound("Student not found");
  return s;
}

type Plain = string | number | boolean | null;

/** Before/after diff of changed fields, for the audit trail. */
export function diffFields(before: Record<string, Plain>, after: Record<string, Plain>) {
  const changes: Record<string, { from: Plain; to: Plain }> = {};
  for (const k of Object.keys(after)) {
    if ((before[k] ?? null) !== (after[k] ?? null)) changes[k] = { from: before[k] ?? null, to: after[k] ?? null };
  }
  return changes;
}

export const ymdOrNull = (d: Date | null | undefined) => (d ? toISTDateString(d) : null);
