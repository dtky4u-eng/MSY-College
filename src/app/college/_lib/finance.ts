// College-scoped finance and date-bucket helpers (FR-COL-1, FR-COL-5, WF-5).
import "server-only";
import { prisma } from "@/lib/db";
import { toISTDateString } from "@/lib/format";

export interface CollegeFinance {
  collection: number; // paise — successful student payments
  paidCount: number;
  earned: number; // college share of the collection
  rknexora: number; // MSY College share of the collection
  received: number; // settled to the college so far
  pending: number; // earned − received
  settlementCount: number;
  progress: number; // % of earned share already received
}

/** Earned share = successful student payments × college share % (WF-5). */
export async function collegeFinance(college: { id: string; collegeShare: number }): Promise<CollegeFinance> {
  const [paid, settled] = await Promise.all([
    prisma.payment.aggregate({ where: { status: "SUCCESS", student: { collegeId: college.id } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.collegeSettlement.aggregate({ where: { collegeId: college.id }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const collection = paid._sum.amount ?? 0;
  const earned = Math.round((collection * college.collegeShare) / 100);
  const received = settled._sum.amount ?? 0;
  return {
    collection,
    paidCount: paid._count._all,
    earned,
    rknexora: collection - earned,
    received,
    pending: Math.max(0, earned - received),
    settlementCount: settled._count._all,
    progress: earned > 0 ? Math.min(100, Math.round((received / earned) * 1000) / 10) : 0,
  };
}

/** The last `n` calendar months (IST), oldest first, as { key: "YYYY-MM", label: "Sep 26" }. */
export function lastMonths(n = 12): { key: string; label: string }[] {
  const [y, m] = toISTDateString().split("-").map(Number) as [number, number];
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    let mm = m - i;
    let yy = y;
    while (mm <= 0) {
      mm += 12;
      yy--;
    }
    const label = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(yy, mm - 1, 15)));
    out.push({ key: `${yy}-${String(mm).padStart(2, "0")}`, label });
  }
  return out;
}

/** First instant of the oldest month returned by lastMonths(n). */
export function monthsStart(n = 12): Date {
  const first = lastMonths(n)[0]!.key;
  return new Date(`${first}-01T00:00:00+05:30`);
}

export const monthKey = (d: Date) => toISTDateString(d).slice(0, 7);

/** Registration wizard step names (nextStep values). */
export const STEP_NAME: Record<number, string> = {
  1: "Verification",
  2: "Personal details",
  3: "Domain selection",
  4: "Documents",
  5: "Review & confirm",
  6: "Payment",
  7: "Completed",
};
