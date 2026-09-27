import Link from "next/link";
import { Activity, Banknote, CheckCircle2, Clock, FileSpreadsheet, GraduationCap, IndianRupee, TrendingUp, UserCheck, Users, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCollege } from "@/lib/auth";
import { learningPercentMany } from "@/lib/student";
import { formatDate, formatINR, formatNumber, pct } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { DonutChart, TrendChart } from "@/components/ui/charts";
import { MoneyBarChart, MoneyDonutChart } from "@/components/college/money-charts";
import { collegeFinance, lastMonths, monthKey, monthsStart } from "./_lib/finance";

export const metadata = { title: "College Dashboard" };

export default async function CollegeDashboard() {
  const { college } = await requireCollege();
  const where = { collegeId: college.id };
  const since = monthsStart(12);

  const [total, active, completed, unpaid, paid, withMentor, registrations, domainGroups, domains, payments, recent, paidStudents, finance] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.count({ where: { ...where, status: "ACTIVE" } }),
    prisma.student.count({ where: { ...where, status: "COMPLETED" } }),
    prisma.student.count({ where: { ...where, paymentStatus: "UNPAID" } }),
    prisma.student.count({ where: { ...where, paymentStatus: "PAID" } }),
    prisma.student.count({ where: { ...where, mentorId: { not: null } } }),
    prisma.student.findMany({ where: { ...where, registeredAt: { gte: since } }, select: { registeredAt: true } }),
    prisma.student.groupBy({ by: ["domainId"], where: { ...where, domainId: { not: null } }, _count: { _all: true } }),
    prisma.domain.findMany({ select: { id: true, name: true, code: true } }),
    prisma.payment.findMany({ where: { status: "SUCCESS", student: where }, select: { amount: true, paidAt: true, createdAt: true, student: { select: { domainId: true } } } }),
    prisma.student.findMany({ where, orderBy: { createdAt: "desc" }, take: 8, include: { domain: { select: { name: true } }, mentor: { select: { name: true } } } }),
    prisma.student.findMany({ where: { ...where, paymentStatus: "PAID" }, select: { id: true, domainId: true } }),
    collegeFinance(college),
  ]);

  const progressMap = await learningPercentMany([...paidStudents, ...recent.map((r) => ({ id: r.id, domainId: r.domainId }))]);
  const avgProgress = paidStudents.length ? Math.round((paidStudents.reduce((a, s) => a + (progressMap.get(s.id) ?? 0), 0) / paidStudents.length) * 10) / 10 : 0;
  const domainName = new Map(domains.map((d) => [d.id, d.name]));

  const months = lastMonths(12);
  const regByMonth = new Map<string, number>();
  for (const r of registrations) if (r.registeredAt) regByMonth.set(monthKey(r.registeredAt), (regByMonth.get(monthKey(r.registeredAt)) ?? 0) + 1);
  const trend = months.map((m) => ({ month: m.label, registrations: regByMonth.get(m.key) ?? 0 }));

  const revByMonth = new Map<string, number>();
  const revByDomain = new Map<string, number>();
  for (const p of payments) {
    const k = monthKey(p.paidAt ?? p.createdAt);
    revByMonth.set(k, (revByMonth.get(k) ?? 0) + p.amount);
    const d = p.student.domainId ? domainName.get(p.student.domainId) ?? "Other" : "Other";
    revByDomain.set(d, (revByDomain.get(d) ?? 0) + p.amount);
  }
  const share = college.collegeShare / 100;
  const monthlyRevenue = months.map((m) => {
    const v = revByMonth.get(m.key) ?? 0;
    return { month: m.label, collection: v, share: Math.round(v * share) };
  });
  const domainRevenue = [...revByDomain.entries()].sort((a, b) => b[1] - a[1]).map(([domain, v]) => ({ domain, collection: v, share: Math.round(v * share) }));
  const distribution = domainGroups
    .map((g) => ({ name: domainName.get(g.domainId!) ?? "Unknown", value: g._count._all }))
    .sort((a, b) => b.value - a.value);

  if (total === 0) {
    return (
      <>
        <PageHeader title="Internship ERP Management" description={`Welcome, ${college.name}.`} />
        <Card>
          <EmptyState
            icon={<FileSpreadsheet />}
            title="Upload your student database to get started"
            description="Students can register for their internship only after their record has been uploaded by the college."
            action={<ButtonLink href="/college/upload" icon={<FileSpreadsheet className="size-4" />}>Upload students</ButtonLink>}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Internship ERP Management"
        description={`Overview of ${college.name} — registrations, internship progress and revenue.`}
        actions={
          <>
            <ButtonLink href="/college/registrations" variant="outline" icon={<Activity className="size-4" />}>Registrations</ButtonLink>
            <ButtonLink href="/college/upload" icon={<FileSpreadsheet className="size-4" />}>Upload students</ButtonLink>
          </>
        }
      />

      <StatGrid>
        <StatCard label="Total students" value={formatNumber(total)} icon={<Users />} hint={`${formatNumber(paid)} registered & paid`} href="/college/students" />
        <StatCard label="Active internships" value={formatNumber(active)} icon={<GraduationCap />} tone="green" hint={`${formatNumber(completed)} completed`} href="/college/students?status=ACTIVE" />
        <StatCard label="Average progress" value={`${avgProgress}%`} icon={<TrendingUp />} tone="violet" hint="Learning progress of registered students" />
        <StatCard label="College revenue" value={formatINR(finance.earned)} icon={<IndianRupee />} tone="teal" hint={`${college.collegeShare}% share of collection`} href="/college/payments" />
      </StatGrid>

      <StatGrid className="mt-3 sm:mt-4">
        <StatCard label="Pending students" value={formatNumber(unpaid)} icon={<Clock />} tone="amber" hint="Uploaded, not yet registered or paid" href="/college/registrations" />
        <StatCard label="Mentor assigned" value={formatNumber(withMentor)} icon={<UserCheck />} tone="blue" hint={`${pct(withMentor, paid)}% of registered students`} />
        <StatCard label="Total collection" value={formatINR(finance.collection)} icon={<Wallet />} tone="brand" hint={`${formatNumber(finance.paidCount)} successful payments`} />
        <StatCard label="Pending settlement" value={formatINR(finance.pending)} icon={<Banknote />} tone="red" hint={`${formatINR(finance.received)} received`} href="/college/payments" />
      </StatGrid>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Registration trend" description="Students who completed registration and payment, last 12 months" />
          <CardBody>
            <TrendChart data={trend} xKey="month" series={[{ key: "registrations", label: "Registrations" }]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Domain distribution" description="Students by selected internship domain" />
          <CardBody>
            <DonutChart data={distribution} height={240} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Payment summary" description="Registration fee status of uploaded students" icon={<CheckCircle2 className="size-5" />} />
          <CardBody className="space-y-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Metric label="Paid" value={formatNumber(paid)} tone="text-emerald-600" />
              <Metric label="Unpaid" value={formatNumber(unpaid)} tone="text-amber-600" />
              <Metric label="Collection" value={formatINR(finance.collection)} />
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-slate-600">Payment rate</span>
                <span className="font-semibold text-slate-900 tabular-nums">{pct(paid, total)}%</span>
              </div>
              <ProgressBar value={pct(paid, total)} tone="green" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Revenue split" description={`Total collection shared ${college.collegeShare}% college / ${college.rknexoraShare}% MSY College`} icon={<IndianRupee className="size-5" />} />
          <CardBody className="grid items-center gap-4 sm:grid-cols-2">
            <MoneyDonutChart
              height={200}
              data={[
                { name: "College share", value: finance.earned },
                { name: "MSY College share", value: finance.rknexora },
              ]}
            />
            <dl className="space-y-3 text-sm">
              <SplitRow label="Total collection" value={formatINR(finance.collection)} strong />
              <SplitRow label="MSY College share" value={formatINR(finance.rknexora)} />
              <SplitRow label="College share (earned)" value={formatINR(finance.earned)} />
              <SplitRow label="Received so far" value={formatINR(finance.received)} />
            </dl>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Monthly revenue" description="Collection and college share, last 12 months" />
          <CardBody>
            <MoneyBarChart
              data={monthlyRevenue}
              xKey="month"
              series={[
                { key: "collection", label: "Collection" },
                { key: "share", label: "College share" },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Domain-wise revenue" description="Collection by internship domain" />
          <CardBody>
            {domainRevenue.length ? (
              <MoneyBarChart
                horizontal
                height={Math.max(200, domainRevenue.length * 44)}
                data={domainRevenue}
                xKey="domain"
                series={[
                  { key: "collection", label: "Collection" },
                  { key: "share", label: "College share" },
                ]}
              />
            ) : (
              <p className="py-16 text-center text-sm text-slate-400">No payments yet</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent students" description="Latest records added to your student database" actions={<ButtonLink href="/college/students" variant="outline" size="sm">View all</ButtonLink>} />
        <Table>
          <THead>
            <tr>
              <TH>Student</TH>
              <TH>Domain</TH>
              <TH>Mentor</TH>
              <TH>Progress</TH>
              <TH>Payment</TH>
              <TH>Status</TH>
              <TH>Added</TH>
            </tr>
          </THead>
          <TBody>
            {recent.map((s) => (
              <TR key={s.id}>
                <TD>
                  <Link href={`/college/students/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700">{s.name}</Link>
                  <div className="text-xs text-slate-500">{s.registrationNumber}</div>
                </TD>
                <TD>{s.domain?.name ?? <span className="text-slate-400">Not selected</span>}</TD>
                <TD>{s.mentor?.name ?? <span className="text-slate-400">—</span>}</TD>
                <TD className="min-w-32"><ProgressBar value={progressMap.get(s.id) ?? 0} size="sm" showLabel /></TD>
                <TD><StatusBadge status={s.paymentStatus} /></TD>
                <TD><StatusBadge status={s.status} /></TD>
                <TD className="whitespace-nowrap text-slate-500">{formatDate(s.createdAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-3">
      <p className={`font-display text-lg font-bold tabular-nums ${tone ?? "text-slate-900"}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function SplitRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
      <dt className="text-slate-600">{label}</dt>
      <dd className={strong ? "font-bold text-slate-900 tabular-nums" : "font-medium text-slate-800 tabular-nums"}>{value}</dd>
    </div>
  );
}
