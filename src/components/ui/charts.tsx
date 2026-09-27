"use client";
// Chart wrappers (recharts) with a consistent look. Keep series to ≤ 6 colours.
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const CHART_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#64748b"];

const axis = { fontSize: 11, fill: "#64748b" };
const tooltipStyle = { borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px -12px rgb(15 23 42 / .25)", fontSize: 12 };

type Formatter = (v: number) => string;

export function TrendChart({
  data,
  xKey,
  series,
  height = 240,
  format,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; label: string; color?: string }[];
  height?: number;
  format?: Formatter;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? CHART_COLORS[i]} stopOpacity={0.25} />
              <stop offset="100%" stopColor={s.color ?? CHART_COLORS[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey={xKey} tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={format ? (v) => format(Number(v)) : undefined} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => (format ? format(Number(v)) : String(v))} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? CHART_COLORS[i]} strokeWidth={2} fill={`url(#g-${s.key})`} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarChartSimple({
  data,
  xKey,
  series,
  height = 240,
  format,
  horizontal,
  stacked,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; label: string; color?: string }[];
  height?: number;
  format?: Formatter;
  horizontal?: boolean;
  stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, left: horizontal ? 8 : -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={!!horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={axis} tickLine={false} axisLine={false} tickFormatter={format ? (v) => format(Number(v)) : undefined} />
            <YAxis
              type="category"
              dataKey={xKey}
              tick={axis}
              tickLine={false}
              axisLine={false}
              width={120}
              interval={0}
              tickFormatter={(v: string) => (String(v).length > 18 ? String(v).slice(0, 17) + "…" : String(v))}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={format ? (v) => format(Number(v)) : undefined} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} formatter={(v) => (format ? format(Number(v)) : String(v))} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? CHART_COLORS[i]} radius={stacked ? 0 : horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={36} stackId={stacked ? "s" : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 220, format }: { data: { name: string; value: number }[]; height?: number; format?: Formatter }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>No data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => (format ? format(Number(v)) : String(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}
