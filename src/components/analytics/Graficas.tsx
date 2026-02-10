"use client";

import React from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsChart } from "@/src/services/analytics/types";

const PIE_COLORS = ["#111827", "#6D28D9", "#0EA5E9", "#22C55E", "#F97316", "#EF4444", "#A3A3A3"];

function fmtNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(n);
}

function AnalyticsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<any>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const p0 = payload[0] ?? {};
  const name = String(p0?.name ?? label ?? "");
  const value = p0?.value ?? p0?.payload?.value;

  return (
    <div className="rounded-2xl border border-black/10 bg-black px-4 py-3 shadow-2xl">
      <div className="text-[10px] font-black uppercase tracking-widest text-white/60">{name}</div>
      <div className="mt-1 text-lg font-black tracking-tight text-white">{fmtNumber(value)}</div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-8 overflow-hidden">
      <div className="flex items-end justify-between gap-6 mb-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Gráfica</p>
          <h3 className="text-2xl font-black tracking-tighter text-black">{title}</h3>
          {subtitle ? <p className="text-xs font-bold text-black/50 mt-1">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-gray-50/70 rounded-[2rem] border border-black/5 p-10 text-center">
      <p className="text-sm font-black text-black/60">{message}</p>
    </div>
  );
}

export function Graficas({
  charts,
  loading,
}: {
  charts: AnalyticsChart[];
  loading: boolean;
}) {
  if (loading) {
    return <EmptyState message="Cargando gráficas..." />;
  }

  if (!charts?.length) {
    return <EmptyState message="Aún no hay datos suficientes para graficar." />;
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {charts.map((chart) => (
        <Card key={chart.id} title={chart.title} subtitle={chart.subtitle}>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              {chart.kind === "pie" ? (
                <PieChart>
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Pie
                    data={chart.data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {chart.data.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              ) : (
                <BarChart data={chart.data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Tooltip content={<AnalyticsTooltip />} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fontWeight: 800, fill: "rgba(0,0,0,0.55)" }}
                    interval={0}
                    angle={-18}
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11, fontWeight: 800, fill: "rgba(0,0,0,0.35)" }} />
                  <Bar dataKey="value" radius={[12, 12, 12, 12]} fill="var(--accents)" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </Card>
      ))}
    </div>
  );
}

