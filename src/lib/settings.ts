// Key/value application settings stored in the Setting table.
import "server-only";
import { prisma } from "./db";
import { parseJson } from "./json";

/** Certificate eligibility rules — the spec leaves these open, so they are admin-configurable. */
export interface EligibilityRules {
  minAttendancePercent: number; // of working days in the internship window
  minHoursPercent: number; // logbook hours as % of domain duration hours
  minQuizAverage: number; // average best-attempt % across chapter quizzes
  requireAllChapters: boolean;
  requireProjectApproved: boolean;
  requireReportApproved: boolean;
  requireMentorRecommendation: boolean;
}

export const DEFAULT_ELIGIBILITY: EligibilityRules = {
  minAttendancePercent: 75,
  minHoursPercent: 100,
  minQuizAverage: 50,
  requireAllChapters: true,
  requireProjectApproved: true,
  requireReportApproved: true,
  requireMentorRecommendation: true,
};

export interface InternshipSettings {
  defaultWeeks: number; // end date default = start + N weeks
  checkInFrom: string; // "HH:MM" IST
  halfDayBelowHours: number; // check-in → check-out shorter than this = half day
}

export const DEFAULT_INTERNSHIP: InternshipSettings = { defaultWeeks: 6, checkInFrom: "06:00", halfDayBelowHours: 4 };

export interface PaymentSettings {
  gateway: "auto" | "razorpay" | "cashfree" | "sandbox";
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  const val = parseJson<T>(row.value, fallback);
  return typeof fallback === "object" && fallback !== null && !Array.isArray(fallback) ? { ...fallback, ...val } : val;
}

export async function setSetting<T>(key: string, value: T) {
  await prisma.setting.upsert({
    where: { key },
    update: { value: JSON.stringify(value) },
    create: { key, value: JSON.stringify(value) },
  });
}

export const getEligibilityRules = () => getSetting<EligibilityRules>("eligibility", DEFAULT_ELIGIBILITY);
export const getInternshipSettings = () => getSetting<InternshipSettings>("internship", DEFAULT_INTERNSHIP);

/** Atomic counter for human-readable sequence numbers. */
export async function nextSequence(name: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const key = `seq:${name}`;
    const row = await tx.setting.findUnique({ where: { key } });
    const next = (row ? Number(parseJson<number>(row.value, 0)) || 0 : 0) + 1;
    await tx.setting.upsert({ where: { key }, update: { value: JSON.stringify(next) }, create: { key, value: JSON.stringify(next) } });
    return next;
  });
}
