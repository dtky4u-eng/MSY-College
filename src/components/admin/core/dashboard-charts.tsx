"use client";
import { BarChartSimple, DonutChart, TrendChart } from "@/components/ui/charts";

const inrShort = (paise: number) => {
  const r = paise / 100;
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(1)}Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(1)}L`;
  if (r >= 1e3) return `₹${(r / 1e3).toFixed(0)}k`;
  return `₹${r}`;
};

export function RegistrationsChart({ data }: { data: { month: string; registrations: number; payments: number }[] }) {
  return (
    <TrendChart
      data={data}
      xKey="month"
      height={260}
      series={[
        { key: "registrations", label: "Registrations" },
        { key: "payments", label: "Paid" },
      ]}
    />
  );
}

export function RevenueChart({ data }: { data: { month: string; revenue: number }[] }) {
  return <BarChartSimple data={data} xKey="month" height={260} series={[{ key: "revenue", label: "Revenue" }]} format={inrShort} />;
}

export function DomainChart({ data }: { data: { name: string; students: number }[] }) {
  if (!data.length) return <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">No paid students yet</div>;
  return <BarChartSimple data={data} xKey="name" horizontal height={Math.max(200, data.length * 34)} series={[{ key: "students", label: "Paid students" }]} />;
}

export function StatusDonut({ data }: { data: { name: string; value: number }[] }) {
  return <DonutChart data={data} height={260} />;
}
