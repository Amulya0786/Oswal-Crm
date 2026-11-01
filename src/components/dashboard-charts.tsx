"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#0B1F3A", "#E36A1E", "#0F7A68", "#3B5BDB", "#D97706", "#0E7490", "#7C3AED", "#BE123C"];

type Point = { name: string; value: number; href: string };

export function DashboardCharts({
  status,
  types,
  ageing,
  districts,
  trend,
}: {
  status: Point[];
  types: Point[];
  ageing: Point[];
  districts: Point[];
  trend: Point[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="By status" subtitle="Click a slice to open the list">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={status} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} onClick={(point) => point?.href && (window.location.href = point.href)}>
              {status.map((point, index) => (
                <Cell key={point.name} fill={COLORS[index % COLORS.length]} className="cursor-pointer" />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Open work by type" subtitle="Breakdown, installation, insurance, mobile app and scheme">
        <BarBlock data={types} />
      </ChartCard>
      <ChartCard title="Ageing of open complaints" subtitle="0–2, 3–7, 8–15 and more than 15 days">
        <BarBlock data={ageing} />
      </ChartCard>
      <ChartCard title="Open work by district" subtitle="Top districts in the current filter">
        <BarBlock data={districts} />
      </ChartCard>
      <ChartCard title="Complaints logged, last 14 days" subtitle="Asia/Kolkata">
        <BarBlock data={trend} />
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="font-display text-base font-semibold text-navy">{title}</h2>
      <p className="text-xs text-muted">{subtitle}</p>
      <div className="mt-3 h-64">{children}</div>
    </section>
  );
}

function BarBlock({ data }: { data: Point[] }) {
  const router = useRouter();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
        <CartesianGrid stroke="#E3E8F0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={data.length > 6 ? -25 : 0} height={data.length > 6 ? 56 : 30} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
        <Tooltip />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#0B1F3A" className="cursor-pointer" onClick={(point) => point?.href && router.push(point.href)} />
      </BarChart>
    </ResponsiveContainer>
  );
}
