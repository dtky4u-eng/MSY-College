// Server helpers shared by the student portal pages and /api/student/* routes.
import "server-only";
import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { accessState } from "@/lib/student";
import { getT } from "@/lib/i18n/server";
import { toISTDateString } from "@/lib/format";
import { parseJson } from "@/lib/json";
import type { AccessState } from "@/lib/constants";
import type { TFn } from "@/lib/i18n";

export type StudentRecord = Awaited<ReturnType<typeof requireStudent>>["student"];

/** Page context: guard + derived access state + translator. */
export async function studentPage() {
  const { auth, student } = await requireStudent();
  const t = await getT();
  return { auth, student, state: accessState(student), t };
}

/** Human explanation of why an action is not allowed in the given state. */
export function stateBlockMessage(state: AccessState, t: TFn, blockedReason?: string | null): string {
  switch (state) {
    case "WAITING":
      return t("guard.waiting");
    case "NOT_STARTED":
      return t("guard.notStarted");
    case "COMPLETED":
      return t("guard.completed");
    case "BLOCKED":
      return blockedReason ? t("guard.blockedReason", { reason: blockedReason }) : t("guard.blocked");
    default:
      return "";
  }
}

/** API context for mutations: only ACTIVE students may act (FR-STU-2). Throws 403 with a helpful message. */
export async function requireActiveStudent() {
  const { auth, student } = await requireStudent("api");
  const t = await getT();
  const state = accessState(student);
  if (state !== "ACTIVE") throw new ApiError(403, stateBlockMessage(state, t, student.blockedReason));
  return { auth, student, t };
}

/** API context for read-only calls (any state). */
export async function requireAnyStudent() {
  const { auth, student } = await requireStudent("api");
  const t = await getT();
  return { auth, student, t, state: accessState(student) };
}

/** Internship window as IST calendar dates; end falls back to today when not set. */
export function internshipWindow(s: { internshipStart: Date | null; internshipEnd: Date | null }) {
  const today = toISTDateString();
  const start = s.internshipStart ? toISTDateString(s.internshipStart) : null;
  const end = s.internshipEnd ? toISTDateString(s.internshipEnd) : null;
  return { today, start, end };
}

/** Is a YYYY-MM-DD date inside the internship window and not in the future? Returns an error message or null. */
export function checkDateInWindow(ymd: string, s: { internshipStart: Date | null; internshipEnd: Date | null }, t: TFn): string | null {
  const { today, start, end } = internshipWindow(s);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || isNaN(new Date(ymd + "T00:00:00Z").getTime())) return t("err.invalidDate");
  if (ymd > today) return t("err.futureDate");
  if (start && ymd < start) return t("err.beforeStart");
  if (end && ymd > end) return t("err.afterEnd");
  return null;
}

export interface HistoryItem {
  fileId: string | null;
  submittedAt: string;
  status: string;
  feedback: string | null;
  marks?: number | null;
  title?: string | null;
  photoFileIds?: string[];
}

export const parseHistory = (h: string | null | undefined) => parseJson<HistoryItem[]>(h, []);

/** Mentor user id for notifications. */
export async function mentorUserId(mentorId: string | null | undefined): Promise<string | null> {
  if (!mentorId) return null;
  const m = await prisma.mentor.findUnique({ where: { id: mentorId }, select: { userId: true } });
  return m?.userId ?? null;
}
