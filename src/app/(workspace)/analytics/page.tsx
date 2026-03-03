"use client"

import React, { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { BarChart3, RefreshCw } from "lucide-react"
import type { AnalyticsEntity, AnalyticsKpi } from "@/src/services/analytics/types"
import { useRealtimeAnalytics } from "@/src/lib/hooks/useRealtimeAnalytics"
import { Kpi, type KpiItem } from "@/src/components/analytics/Kpi"
import { Graficas } from "@/src/components/analytics/Graficas"
import { SectionTutorial, type SectionTutorialStep } from "@/src/components/workspace/tutorial/SectionTutorial"

const ANALYTICS_TUTORIAL_STEPS: SectionTutorialStep[] = [
  {
    id: "analytics-header",
    title: "Panel de analisis",
    description: "Aqui visualizas el resumen general del rendimiento de tu workspace.",
    selector: '[data-tutorial="analytics-header"]',
  },
  {
    id: "analytics-tabs",
    title: "Cambiar entidad",
    description: "Alterna entre prospectos, clientes y polizas para revisar cada area.",
    selector: '[data-tutorial="analytics-tabs"]',
  },
  {
    id: "analytics-kpis",
    title: "KPIs principales",
    description: "Estos indicadores muestran los numeros clave de la entidad seleccionada.",
    selector: '[data-tutorial="analytics-kpis"]',
  },
  {
    id: "analytics-charts",
    title: "Graficas",
    description: "Aqui encuentras tendencias y comparativos para tomar decisiones.",
    selector: '[data-tutorial="analytics-charts"]',
  },
]

function formatKpiValue(k: AnalyticsKpi) {
  if (k.format === "currency") {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(k.value)
  }
  if (k.format === "percent") {
    return `${k.value.toFixed(1)}%`
  }
  if (k.format === "number") {
    return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(k.value)
  }
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(k.value)
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<AnalyticsEntity>("prospectos")
  const { charts, kpis, loading, generatedAt, error, refetch } = useRealtimeAnalytics(tab)

  const kpiItems = useMemo<KpiItem[]>(
    () =>
      (kpis || []).map((k) => ({
        id: k.id,
        label: k.label,
        value: formatKpiValue(k),
        helper: k.helper,
        variant: k.variant,
      })),
    [kpis]
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-12 overflow-hidden relative"
      >
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-(--accents) blur-[90px] opacity-20" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8" data-tutorial="analytics-header">
          <div className="flex items-center gap-3">
          <div className="p-4 bg-black rounded-2xl shadow-xl">
            <BarChart3 className="text-(--accents)" size={26} />
          </div>
          <div>
            <p className="text-[10px] font-black text-black/30 uppercase tracking-[0.35em]">Workspace</p>
            <h2 className="text-4xl font-black text-black tracking-tighter italic uppercase">Analytics.</h2>
          </div>
        </div>

          <div className="flex items-center gap-3">
            <SectionTutorial
              steps={ANALYTICS_TUTORIAL_STEPS}
              ariaLabel="Tutorial de la seccion analisis"
              triggerClassName="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-black/10 bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all active:scale-95"
            />
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/80 transition-all active:scale-95"
              title="Refrescar"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refrescar
            </button>
            <div className="text-[10px] font-black uppercase tracking-widest text-black/40">
              {generatedAt ? `Actualizado: ${new Date(generatedAt).toLocaleString("es-MX")}` : "—"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-10" data-tutorial="analytics-tabs">
          {([
            { id: "prospectos", label: "Prospectos" },
            { id: "clientes", label: "Clientes" },
            { id: "polizas", label: "Pólizas" },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? "px-6 py-4 rounded-[2rem] bg-black text-white font-black text-[10px] uppercase tracking-widest shadow-sm"
                  : "px-6 py-4 rounded-[2rem] bg-gray-50/60 border border-black/5 text-black font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all"
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          <div data-tutorial="analytics-kpis">
            <Kpi items={kpiItems} />
          </div>

          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-[2rem] p-6">
              <p className="text-sm font-black text-red-700">Error: {error}</p>
            </div>
          ) : null}

          <div data-tutorial="analytics-charts">
            <Graficas charts={charts} loading={loading} />
          </div>
        </div>
      </motion.div>
    </div>
  )
}

