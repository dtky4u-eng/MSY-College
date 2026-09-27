// College settlement arithmetic (WF-5): earned share = successful student payments × college share %.
import "server-only";
import { prisma } from "@/lib/db";

export interface CollegeBalance {
  id: string;
  name: string;
  code: string;
  status: string;
  collegeShare: number;
  adminUserId: string | null;
  paidStudents: number;
  collection: number; // paise
  earned: number; // paise
  received: number; // paise
  pending: number; // paise
  settlements: number;
  lastSettlementAt: Date | null;
  progress: number; // percent of earned share settled
}

export async function collegeBalances(collegeId?: string): Promise<CollegeBalance[]> {
  const where = collegeId ? { id: collegeId } : {};
  const [colleges, payments, settlements] = await Promise.all([
    prisma.college.findMany({ where, orderBy: { name: "asc" }, select: { id: true, name: true, code: true, status: true, collegeShare: true, adminUserId: true } }),
    prisma.payment.findMany({
      where: { status: "SUCCESS", ...(collegeId ? { student: { collegeId } } : {}) },
      select: { amount: true, studentId: true, student: { select: { collegeId: true } } },
    }),
    prisma.collegeSettlement.groupBy({
      by: ["collegeId"],
      where: collegeId ? { collegeId } : {},
      _sum: { amount: true },
      _count: { _all: true },
      _max: { date: true },
    }),
  ]);
  const coll = new Map<string, { amount: number; students: Set<string> }>();
  for (const p of payments) {
    const c = coll.get(p.student.collegeId) ?? { amount: 0, students: new Set<string>() };
    c.amount += p.amount;
    c.students.add(p.studentId);
    coll.set(p.student.collegeId, c);
  }
  const st = new Map(settlements.map((s) => [s.collegeId, s]));
  return colleges.map((c) => {
    const collection = coll.get(c.id)?.amount ?? 0;
    const earned = Math.round((collection * c.collegeShare) / 100);
    const received = st.get(c.id)?._sum.amount ?? 0;
    const pending = Math.max(0, earned - received);
    return {
      ...c,
      paidStudents: coll.get(c.id)?.students.size ?? 0,
      collection,
      earned,
      received,
      pending,
      settlements: st.get(c.id)?._count._all ?? 0,
      lastSettlementAt: st.get(c.id)?._max.date ?? null,
      progress: earned > 0 ? Math.min(100, Math.round((received / earned) * 1000) / 10) : 0,
    };
  });
}

export async function collegeBalance(collegeId: string): Promise<CollegeBalance | null> {
  return (await collegeBalances(collegeId))[0] ?? null;
}
