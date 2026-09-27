"use client";
// Charts whose values are money in paise. Formatters cannot cross the server → client boundary,
// so these thin wrappers attach the INR formatter on the client.
import { BarChartSimple, DonutChart, TrendChart } from "@/components/ui/charts";
import { formatINR } from "@/lib/format";

const inr = (v: number) => formatINR(v);

type Series = { key: string; label: string; color?: string }[];

export function MoneyTrendChart(props: { data: Record<string, string | number>[]; xKey: string; series: Series; height?: number }) {
  return <TrendChart {...props} format={inr} />;
}

export function MoneyBarChart(props: { data: Record<string, string | number>[]; xKey: string; series: Series; height?: number; horizontal?: boolean; stacked?: boolean }) {
  return <BarChartSimple {...props} format={inr} />;
}

export function MoneyDonutChart(props: { data: { name: string; value: number }[]; height?: number }) {
  return <DonutChart {...props} format={inr} />;
}
