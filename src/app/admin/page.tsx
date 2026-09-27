import Link from "next/link";
import {
  Ban,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  GraduationCap,
  Hourglass,
  IndianRupee,
  Percent,
  PlayCircle,
  UserCog,
  UserX,
  Wallet,
} from "lucide-react";
import { requirePageRole } from "@/lib/auth";
import { formatINR, formatNumber } from "@/lib/format";
import { PageHeader, Alert } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { Table, THead, TBody, TR, TH, TD, EmptyRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { dashboardData } from "@/components/admin/core/dashboard-data";
import { SendMessageButton } from "@/components/admin/core/send-message";
import { DomainChart, RegistrationsChart, RevenueChart, StatusDonut } from "@/components/admin/core/dashboard-charts";

export const metadata = { title: "Admin dashboard" };

export default async function AdminDashboard() {
  await requirePageRole("ADMIN");
  const d = await dashboardData();
  const k = d.kpis;
  const yearRevenue = d.trend.reduce((a, t) => a + t.revenue, 0);

  return (
    <>
      <PageHeader title="Admin dashboard" description="Programme-wide overview of colleges, students, internships and revenue." actions={<SendMessageButton paidCount={k.paid} />} />

      {(k.unassigned > 0 || k.awaitingStart > 0 || k.pendingColleges > 0) && (
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          {k.unassigned > 0 && (
            <Alert tone="warning" title={`${formatNumber(k.unassigned)} paid student${k.unassigned === 1 ? "" : "s"} without a mentor`} action={<ButtonLink href="/admin/mentors" size="xs" variant="outline">Assign</ButtonLink>}>
              Assign mentors so reviews and assessments can begin.
            </Alert>
          )}
          {k.awaitingStart > 0 && (
            <Alert tone="info" title={`${formatNumber(k.awaitingStart)} awaiting a start date`} action={<ButtonLink href="/admin/internships" size="xs" variant="outline">Schedule</ButtonLink>}>
              Paid students waiting for their internship to begin.
            </Alert>
          )}
          {k.pendingColleges > 0 && (
            <Alert tone="info" title={`${formatNumber(k.pendingColleges)} pending college${k.pendingColleges === 1 ? "" : "s"}`} action={<ButtonLink href="/admin/colleges?status=PENDING" size="xs" variant="outline">Review</ButtonLink>}>
              Colleges waiting to be activated.
            </Alert>
          )}
        </div>
      )}

      <StatGrid>
        <StatCard label="Total students" value={formatNumber(k.students)} icon={<GraduationCap />} href="/admin/students" />
        <StatCard label="Colleges" value={formatNumber(k.colleges)} icon={<Building2 />} tone="violet" hint={`${formatNumber(k.pendingColleges)} pending`} href="/admin/colleges" />
        <StatCard label="Active mentors" value={formatNumber(k.mentors)} icon={<UserCog />} tone="teal" href="/admin/mentors" />
        <StatCard label="Active domains" value={formatNumber(k.domains)} icon={<BookOpen />} tone="blue" href="/admin/learning" />
        <StatCard label="Active internships" value={formatNumber(k.activeInternships)} icon={<PlayCircle />} tone="green" href="/admin/internships?tab=active" />
        <StatCard label="Completion rate" value={`${k.completionRate}%`} icon={<CheckCircle2 />} tone="brand" hint={`${formatNumber(k.completed)} completed of ${formatNumber(k.paid)} paid`} />
        <StatCard label="Payment rate" value={`${k.paymentRate}%`} icon={<Percent />} tone="green" hint={`${formatNumber(k.paid)} of ${formatNumber(k.students)} students`} />
        <StatCard label="Total revenue" value={formatINR(k.revenue)} icon={<IndianRupee />} tone="amber" hint={`${formatINR(yearRevenue)} in the last 12 months`} href="/admin/payments" />
        <StatCard label="Paid students" value={formatNumber(k.paid)} icon={<CreditCard />} tone="green" href="/admin/students?payment=PAID" />
        <StatCard label="Pending (not paid)" value={formatNumber(k.pending)} icon={<Hourglass />} tone="amber" href="/admin/students?payment=UNPAID" />
        <StatCard label="Unassigned (paid, no mentor)" value={formatNumber(k.unassigned)} icon={<UserX />} tone={k.unassigned ? "red" : "gray"} />
        <StatCard label="Blocked students" value={formatNumber(k.blocked)} icon={<Ban />} tone={k.blocked ? "red" : "gray"} href="/admin/students?status=BLOCKED" />
      </StatGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Registrations" description="Confirmed registrations and successful payments, last 12 months" icon={<Clock className="size-5" />} />
          <CardBody>
            <RegistrationsChart data={d.trend.map((t) => ({ month: t.month, registrations: t.registrations, payments: t.payments }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Revenue" description="Successful payments by month, last 12 months" icon={<Wallet className="size-5" />} />
          <CardBody>
            <RevenueChart data={d.trend.map((t) => ({ month: t.month, revenue: t.revenue }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Domain distribution" description="Paid students per domain (top 10)" />
          <CardBody>
            <DomainChart data={d.domainDist} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Student status" description="All students by internship status" />
          <CardBody>
            <StatusDonut data={d.statusDist} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Top colleges" description="Ranked by revenue from successful payments" actions={<ButtonLink href="/admin/colleges" variant="ghost" size="sm">All colleges</ButtonLink>} />
        <Table>
          <THead>
            <tr>
              <TH>#</TH>
              <TH>College</TH>
              <TH>Status</TH>
              <TH className="text-right">Students</TH>
              <TH className="text-right">Paid students</TH>
              <TH className="text-right">Revenue</TH>
              <TH className="text-right">College share</TH>
            </tr>
          </THead>
          <TBody>
            {d.topColleges.length === 0 && <EmptyRow colSpan={7}>No colleges yet.</EmptyRow>}
            {d.topColleges.map((c, i) => (
              <TR key={c.id}>
                <TD className="text-slate-400 tabular-nums">{i + 1}</TD>
                <TD>
                  <Link href={`/admin/colleges/${c.id}/edit`} className="font-medium text-slate-900 hover:text-brand-700">
                    {c.name}
                  </Link>
                  <div className="font-mono text-xs text-slate-500">{c.code}</div>
                </TD>
                <TD>
                  <StatusBadge status={c.status} />
                </TD>
                <TD className="text-right tabular-nums">{formatNumber(c.students)}</TD>
                <TD className="text-right tabular-nums">{formatNumber(c.paid)}</TD>
                <TD className="text-right font-medium tabular-nums">{formatINR(c.revenue)}</TD>
                <TD className="text-right tabular-nums">
                  {formatINR(Math.round((c.revenue * c.collegeShare) / 100))} <span className="text-xs text-slate-400">({c.collegeShare}%)</span>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
