// Admin dashboard metrics (FR-ADM-1). Shared by the /admin page and GET /api/admin/dashboard.
import "server-only";
import { prisma } from "@/lib/db";
import { pct, toISTDateString } from "@/lib/format";
import { paidByCollege, revenueByCollege } from "./server-data";

const MONTH_FMT = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "Asia/Kolkata" });

function last12Months(): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const [y, m] = toISTDateString().split("-").map(Number) as [number, number];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 15));
    out.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, label: MONTH_FMT.format(d) });
  }
  return out;
}

const STATUS_LABEL: Record<string, string> = { PENDING: "Pending", ACTIVE: "Active", COMPLETED: "Completed", BLOCKED: "Blocked" };

export async function dashboardData() {
  const now = new Date();
  const months = last12Months();
  const since = new Date(`${months[0]!.key}-01T00:00:00+05:30`);

  const [
    students,
    paid,
    blocked,
    completed,
    activeInternships,
    unassigned,
    colleges,
    pendingColleges,
    mentors,
    domains,
    revenueAgg,
    registered,
    payments,
    byStatus,
    byDomain,
    domainList,
    awaitingStart,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { paymentStatus: "PAID" } }),
    prisma.student.count({ where: { status: "BLOCKED" } }),
    prisma.student.count({ where: { status: "COMPLETED" } }),
    prisma.student.count({ where: { status: "ACTIVE", paymentStatus: "PAID", internshipStart: { lte: now } } }),
    prisma.student.count({ where: { paymentStatus: "PAID", mentorId: null, status: { notIn: ["COMPLETED", "BLOCKED"] } } }),
    prisma.college.count(),
    prisma.college.count({ where: { status: "PENDING" } }),
    prisma.mentor.count({ where: { active: true } }),
    prisma.domain.count({ where: { active: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
    prisma.student.findMany({ where: { registeredAt: { gte: since } }, select: { registeredAt: true } }),
    prisma.payment.findMany({ where: { status: "SUCCESS", paidAt: { gte: since } }, select: { paidAt: true, amount: true } }),
    prisma.student.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.student.groupBy({ by: ["domainId"], _count: { _all: true }, where: { paymentStatus: "PAID", domainId: { not: null } } }),
    prisma.domain.findMany({ select: { id: true, name: true, code: true } }),
    prisma.student.count({ where: { paymentStatus: "PAID", internshipStart: null, status: { notIn: ["COMPLETED", "BLOCKED"] } } }),
  ]);

  const monthly = new Map(months.map((m) => [m.key, { month: m.label, registrations: 0, payments: 0, revenue: 0 }]));
  for (const r of registered) {
    const k = toISTDateString(r.registeredAt!).slice(0, 7);
    const row = monthly.get(k);
    if (row) row.registrations++;
  }
  for (const p of payments) {
    const k = toISTDateString(p.paidAt!).slice(0, 7);
    const row = monthly.get(k);
    if (row) {
      row.payments++;
      row.revenue += p.amount;
    }
  }
  const trend = [...monthly.values()];

  const domainName = new Map(domainList.map((d) => [d.id, d]));
  const domainDist = byDomain
    .map((r) => ({ name: domainName.get(r.domainId!)?.name ?? "Unknown", students: r._count._all }))
    .sort((a, b) => b.students - a.students)
    .slice(0, 10);

  const statusDist = ["PENDING", "ACTIVE", "COMPLETED", "BLOCKED"].map((s) => ({
    name: STATUS_LABEL[s]!,
    value: byStatus.find((b) => b.status === s)?._count._all ?? 0,
  }));

  const [revMap, paidMap, collegeRows] = await Promise.all([
    revenueByCollege(),
    paidByCollege(),
    prisma.college.findMany({ select: { id: true, name: true, code: true, status: true, collegeShare: true, _count: { select: { students: true } } } }),
  ]);
  const topColleges = collegeRows
    .map((c) => ({ id: c.id, name: c.name, code: c.code, status: c.status, students: c._count.students, paid: paidMap.get(c.id) ?? 0, revenue: revMap.get(c.id) ?? 0, collegeShare: c.collegeShare }))
    .sort((a, b) => b.revenue - a.revenue || b.paid - a.paid)
    .slice(0, 8);

  return {
    kpis: {
      students,
      colleges,
      pendingColleges,
      mentors,
      domains,
      activeInternships,
      awaitingStart,
      completed,
      completionRate: pct(completed, paid),
      paymentRate: pct(paid, students),
      unassigned,
      paid,
      pending: students - paid,
      blocked,
      revenue: revenueAgg._sum.amount ?? 0,
    },
    trend,
    domainDist,
    statusDist,
    topColleges,
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
