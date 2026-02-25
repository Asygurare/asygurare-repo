"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Flag,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  X,
} from "lucide-react"
import { Toaster, toast } from "sonner"
import { supabaseClient } from "@/src/lib/supabase/client"
import { DATABASE } from "@/src/config"

type GoalFormat = "count" | "currency" | "percent" | "number"
type GoalPeriod = "month" | "week" | "custom" | "always"
type GoalStatus = "active" | "archived"

type GoalMetric =
  | "leads.new_count"
  | "tasks.calls_done"
  | "leads.converted_to_customers"
  | (string & {})

type GoalRow = {
  id: string
  user_id: string
  title: string
  metric: GoalMetric
  format: GoalFormat
  target_value: number
  /** Aporte manual que se suma al valor calculado (ej. +1 por "Actualizar manualmente"). */
  manual_additions?: number | null
  period_type: GoalPeriod
  month_year: string | null
  start_at: string | null
  end_at: string | null
  scope: any | null
  status: GoalStatus
  created_at: string
  updated_at: string
}

function safeNumber(x: any) {
  const n = typeof x === "number" ? x : parseFloat(String(x ?? ""))
  return Number.isFinite(n) ? n : 0
}

function fmtValue(format: GoalFormat, value: number) {
  if (format === "currency") {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value)
  }
  if (format === "percent") {
    return `${value.toFixed(1)}%`
  }
  if (format === "number") {
    return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(value)
  }
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(value)
}

function clampPct(x: number) {
  if (!Number.isFinite(x)) return 0
  return Math.max(0, Math.min(999, x))
}

function monthRange(monthYear: string) {
  // monthYear: YYYY-MM
  const [yy, mm] = monthYear.split("-").map((s) => parseInt(s, 10))
  if (!yy || !mm) return null
  const start = new Date(yy, mm - 1, 1, 0, 0, 0, 0)
  const end = new Date(yy, mm, 0, 23, 59, 59, 999)
  return { start, end }
}

function weekRange(anchorISO: string | null) {
  // anchorISO: YYYY-MM-DD
  const base = anchorISO ? new Date(`${anchorISO}T00:00:00`) : new Date()
  if (Number.isNaN(base.getTime())) return null
  // Monday-first
  const weekday = base.getDay() // 0 Sun ... 6 Sat
  const mondayFirstIndex = (weekday + 6) % 7 // 0 Mon ... 6 Sun
  const start = new Date(base)
  start.setDate(base.getDate() - mondayFirstIndex)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function metricMeta(metric: GoalMetric): { label: string; format: GoalFormat; href: string; icon: any; helper?: string } {
  switch (metric) {
    case "leads.new_count":
      return { label: "Prospectos nuevos", format: "count", href: "/prospectos", icon: Target, helper: "Creados en el periodo" }
    case "tasks.calls_done":
      return { label: "Llamadas completadas", format: "count", href: "/calendario", icon: CalendarDays, helper: "Tareas tipo Llamada en el periodo" }
    case "leads.converted_to_customers":
      return { label: "Prospectos convertidos", format: "count", href: "/clientes", icon: Target, helper: "Convertidos a Clientes en el periodo" }
    default:
      return { label: String(metric), format: "count", href: "/dashboard", icon: Target, helper: "Métrica no soportada (por ahora)" }
  }
}

async function computeMetricValue(args: {
  metric: GoalMetric
  userId: string
  period: GoalPeriod
  monthYear: string | null
  startAt: string | null
  endAt: string | null
}) {
  const { metric, userId, period, monthYear, startAt, endAt } = args

  const toDate = (raw: string, endOfDay: boolean) => {
    // Accepts either YYYY-MM-DD (from inputs) or a full ISO string from DB.
    const trimmed = String(raw || "").trim()
    if (!trimmed) return null
    const d =
      trimmed.includes("T")
        ? new Date(trimmed)
        : new Date(`${trimmed}T${endOfDay ? "23:59:59.999" : "00:00:00"}`)
    if (Number.isNaN(d.getTime())) return null
    return d
  }

  const getWindow = () => {
    if (period === "always") return null
    if (period === "month") {
      if (!monthYear) return null
      const r = monthRange(monthYear)
      return r ? { startISO: r.start.toISOString(), endISO: r.end.toISOString() } : null
    }
    if (period === "week") {
      // Use startAt as an anchor day (YYYY-MM-DD from <input type="date">), else current week
      const r = weekRange(startAt ? startAt.slice(0, 10) : null)
      return r ? { startISO: r.start.toISOString(), endISO: r.end.toISOString() } : null
    }
    if (period === "custom") {
      if (!startAt || !endAt) return null
      const s = toDate(startAt, false)
      const e = toDate(endAt, true)
      if (!s || !e) return null
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null
      return { startISO: s.toISOString(), endISO: e.toISOString() }
    }
    return null
  }

  const window = getWindow()

  if (metric === "leads.new_count") {
    let q = supabaseClient
      .from(DATABASE.TABLES.WS_LEADS)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
    if (window) q = q.gte("created_at", window.startISO).lte("created_at", window.endISO)
    const { count, error } = await q
    if (error) throw error
    return count || 0
  }

  if (metric === "tasks.calls_done") {
    let q = supabaseClient
      .from(DATABASE.TABLES.WS_TASKS)
      .select("id,kind,status,completed_at,due_at,user_id")
      .eq("user_id", userId)
      .eq("status", "done")

    // If a window exists, include tasks whose due_at OR completed_at falls inside.
    if (window) {
      q = q.or(
        `and(completed_at.gte.${window.startISO},completed_at.lte.${window.endISO}),and(due_at.gte.${window.startISO},due_at.lte.${window.endISO})`
      )
    }

    const { data, error } = await q
    if (error) throw error
    const rows = (data as any[]) || []
    return rows.filter((r) => String(r?.kind || "").toLowerCase() === "llamada").length
  }

  if (metric === "leads.converted_to_customers") {
    let q = supabaseClient
      .from(DATABASE.TABLES.WS_CUSTOMERS_2)
      .select("id,additional_fields,created_at,user_id")
      .eq("user_id", userId)
    if (window) q = q.gte("created_at", window.startISO).lte("created_at", window.endISO)
    const { data, error } = await q
    if (error) throw error
    const rows = (data as any[]) || []
    return rows.filter((c) => {
      const extra = c?.additional_fields
      return extra && typeof extra === "object" && String(extra?.converted_from_lead_id || "").trim()
    }).length
  }

  return 0
}

export default function MetasPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [goals, setGoals] = useState<GoalRow[]>([])
  const [progress, setProgress] = useState<Record<string, { current: number; pct: number; computedAt: string }>>({})

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<GoalRow | null>(null)
  const [savingManual, setSavingManual] = useState(false)
  const [manualModalGoalId, setManualModalGoalId] = useState<string | null>(null)

  const nowMonth = useMemo(() => new Date().toISOString().slice(0, 7), [])

  const [form, setForm] = useState<{
    title: string
    metric: GoalMetric
    target_value: string
    period_type: GoalPeriod
    month_year: string
    start_at: string
    end_at: string
    status: GoalStatus
  }>({
    title: "",
    metric: "leads.new_count",
    target_value: "0",
    period_type: "month",
    month_year: nowMonth,
    start_at: "",
    end_at: "",
    status: "active",
  })

  const openCreate = useCallback((preset?: Partial<typeof form>) => {
    setEditing(null)
    setForm((prev) => ({
      ...prev,
      title: "",
      metric: "leads.new_count",
      target_value: "0",
      period_type: "month",
      month_year: nowMonth,
      start_at: "",
      end_at: "",
      status: "active",
      ...(preset || {}),
    }))
    setIsModalOpen(true)
  }, [nowMonth])

  const openEdit = useCallback((g: GoalRow) => {
    setEditing(g)
    setForm({
      title: g.title || "",
      metric: g.metric,
      target_value: String(g.target_value ?? 0),
      period_type: g.period_type,
      month_year: g.month_year || nowMonth,
      start_at: g.start_at ? String(g.start_at).slice(0, 10) : "",
      end_at: g.end_at ? String(g.end_at).slice(0, 10) : "",
      status: g.status || "active",
    })
    setIsModalOpen(true)
  }, [nowMonth])

  const fetchGoals = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    try {
      const { data: userRes, error: userErr } = await supabaseClient.auth.getUser()
      if (userErr) throw userErr
      if (!userRes.user) throw new Error("Sesión no válida")

      const { data, error } = await supabaseClient
        .from(DATABASE.TABLES.WS_GOALS)
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setGoals((data as GoalRow[]) || [])
    } catch (e: any) {
      toast.error("No se pudieron cargar tus metas", { description: String(e?.message || e || "Error desconocido") })
      setGoals([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  const computeAllProgress = useCallback(async (rows: GoalRow[]) => {
    if (!rows.length) {
      setProgress({})
      return
    }
    setRefreshing(true)
    try {
      const { data: userRes, error: userErr } = await supabaseClient.auth.getUser()
      if (userErr) throw userErr
      const userId = userRes.user?.id
      if (!userId) throw new Error("Sesión no válida")

      const computedAt = new Date().toISOString()
      const results = await Promise.all(
        rows.map(async (g) => {
          const current = await computeMetricValue({
            metric: g.metric,
            userId,
            period: g.period_type,
            monthYear: g.month_year,
            startAt: g.start_at,
            endAt: g.end_at,
          })
          const target = safeNumber(g.target_value)
          const pct = target > 0 ? clampPct((current / target) * 100) : 0
          return [g.id, { current, pct, computedAt }] as const
        })
      )
      setProgress(Object.fromEntries(results))
    } catch (e: any) {
      toast.error("No se pudo calcular el avance", { description: String(e?.message || e || "Error desconocido") })
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      await fetchGoals()
    })()
  }, [fetchGoals])

  useEffect(() => {
    computeAllProgress(goals)
  }, [goals, computeAllProgress])

  const activeGoals = useMemo(() => goals.filter((g) => g.status !== "archived"), [goals])

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data: userRes, error: userErr } = await supabaseClient.auth.getUser()
      if (userErr) throw userErr
      const user = userRes.user
      if (!user?.id) throw new Error("Sesión no válida")

      const meta = metricMeta(form.metric)
      const target = safeNumber(form.target_value)
      if (!form.title.trim()) throw new Error("Ponle un título a tu meta")
      if (!(target > 0)) throw new Error("El objetivo debe ser mayor a 0")

      const payload: any = {
        user_id: user.id,
        title: form.title.trim(),
        metric: form.metric,
        format: meta.format,
        target_value: target,
        period_type: form.period_type,
        month_year: form.period_type === "month" ? (form.month_year || nowMonth) : null,
        start_at: form.period_type === "custom" || form.period_type === "week" ? (form.start_at ? `${form.start_at}T00:00:00` : null) : null,
        end_at: form.period_type === "custom" ? (form.end_at ? `${form.end_at}T23:59:59.999` : null) : null,
        status: form.status,
      }

      if (editing?.id) {
        const { error } = await supabaseClient.from(DATABASE.TABLES.WS_GOALS).update(payload).eq("id", editing.id)
        if (error) throw error
        toast.success("Meta actualizada")
      } else {
        const { error } = await supabaseClient.from(DATABASE.TABLES.WS_GOALS).insert([payload])
        if (error) throw error
        toast.success("Meta creada")
      }

      setIsModalOpen(false)
      setEditing(null)
      await fetchGoals({ silent: true })
    } catch (e: any) {
      toast.error("No se pudo guardar", { description: String(e?.message || e || "Error desconocido") })
    }
  }, [editing?.id, fetchGoals, form, nowMonth])

  const onDelete = useCallback(async (g: GoalRow) => {
    if (!confirm(`¿Eliminar "${g.title}"?`)) return
    try {
      const { error } = await supabaseClient.from(DATABASE.TABLES.WS_GOALS).delete().eq("id", g.id)
      if (error) throw error
      toast.success("Meta eliminada")
      await fetchGoals({ silent: true })
    } catch (e: any) {
      toast.error("No se pudo eliminar", { description: String(e?.message || e || "Error desconocido") })
    }
  }, [fetchGoals])

  /** +1 al aporte manual de la meta (ej. "Actualizar manualmente" en llamadas). */
  const addManualOne = useCallback(async (g: GoalRow) => {
    setSavingManual(true)
    try {
      const current = safeNumber(g.manual_additions)
      const { error } = await supabaseClient
        .from(DATABASE.TABLES.WS_GOALS)
        .update({ manual_additions: current + 1 })
        .eq("id", g.id)
      if (error) throw error
      await fetchGoals({ silent: true })
      toast.success("+1 registrado")
    } catch (e: any) {
      toast.error("No se pudo actualizar", { description: String(e?.message || e || "Error desconocido") })
    } finally {
      setSavingManual(false)
    }
  }, [fetchGoals])

  const templates = useMemo(
    () => [
      {
        title: "Prospectos nuevos",
        desc: "Cantidad creada en el mes",
        preset: { metric: "leads.new_count" as const, period_type: "month" as const, month_year: nowMonth, target_value: "40" },
        icon: Target,
      },
      {
        title: "Llamadas completadas",
        desc: "Actividad semanal (calls)",
        preset: { metric: "tasks.calls_done" as const, period_type: "week" as const, start_at: new Date().toISOString().slice(0, 10), target_value: "25" },
        icon: CalendarDays,
      },
    ],
    [nowMonth]
  )

  return (
    <div className="space-y-10 pb-20 p-6 max-w-[1400px] mx-auto min-h-screen animate-in fade-in duration-500">
      <Toaster richColors position="bottom-right" />

      {/* HEADER */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-black text-(--accents) flex items-center justify-center">
              <Flag size={22} />
            </div>
            <div>
              <h2 className="text-4xl font-black italic text-black uppercase tracking-tighter">Mis metas.</h2>
              <p className="text-black font-bold text-[10px] uppercase tracking-widest mt-1">Asygurare Intelligence</p>
            </div>
          </div>
        </div>

        <div className="bg-black p-8 rounded-[2.5rem] text-white flex flex-col justify-center">
          <p className="text-[10px] font-black text-(--accents) uppercase mb-1 tracking-widest">Metas activas</p>
          <h3 className="text-4xl font-black">{activeGoals.length.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black text-black/40 uppercase tracking-widest">Control</p>
            <p className="text-sm font-black text-black uppercase tracking-tight italic">Tablero de ejecución</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openCreate()}
              className="bg-black text-white px-6 py-4 rounded-[2rem] font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-(--accents) transition-all shadow-xl active:scale-95"
            >
              <Plus size={16} /> Nueva meta
            </button>
            <button
              onClick={() => computeAllProgress(goals)}
              className="bg-white border border-black/10 text-black px-5 py-4 rounded-[2rem] font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-gray-50 transition-all active:scale-95"
              title="Recalcular avance"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </section>

      {/* LIST */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-black/30 uppercase tracking-[0.35em]">Workspace</p>
            <h3 className="text-xl font-black text-black uppercase tracking-tighter italic">Tus metas</h3>
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-black/40">
            {Object.values(progress)[0]?.computedAt ? `Actualizado: ${new Date(Object.values(progress)[0]!.computedAt).toLocaleString("es-MX")}` : "—"}
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="animate-spin text-(--accents)" size={42} />
          </div>
        ) : goals.length === 0 ? (
          <div className="bg-white p-12 rounded-[3rem] border border-black/5 shadow-sm">
            <p className="text-2xl font-black text-black uppercase tracking-tighter italic">Todavía no tienes metas.</p>
            <p className="text-sm font-bold text-black/40 mt-2">
              Crea una meta y Asygurare va a medir tu avance con datos reales de Prospectos, Comunicación y Clientes.
            </p>
            <div className="mt-6">
              <button
                onClick={() => openCreate()}
                className="bg-black text-white px-10 py-6 rounded-[2rem] font-black flex items-center gap-3 hover:bg-(--accents) transition-all shadow-xl active:scale-95"
              >
                <Plus size={20} /> CREAR MI PRIMERA META
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {goals.map((g) => {
              const meta = metricMeta(g.metric)
              const pr = progress[g.id]
              const computedCurrent = pr?.current ?? 0
              const manualAdditions = safeNumber(g.manual_additions)
              const effectiveCurrent = computedCurrent + manualAdditions
              const target = safeNumber(g.target_value)
              const effectivePct = target > 0 ? clampPct((effectiveCurrent / target) * 100) : 0

              const periodLabel = (() => {
                if (g.period_type === "month") return g.month_year ? `Mes: ${g.month_year}` : "Mensual"
                if (g.period_type === "week") return "Semana"
                return g.start_at && g.end_at ? `Custom: ${String(g.start_at).slice(0, 10)} → ${String(g.end_at).slice(0, 10)}` : "Custom"
              })()

              const Icon = meta.icon
              const barWidth = `${Math.min(100, effectivePct)}%`
              const done = target > 0 && effectiveCurrent >= target
              const showBreakdown = manualAdditions > 0

              return (
                <div
                  key={g.id}
                  className="bg-white p-8 rounded-[3rem] border-2 border-transparent hover:border-(--accents)/30 transition-all shadow-md"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                    <div className="flex items-start gap-5 min-w-0">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-black/5 flex items-center justify-center text-(--accents) shrink-0">
                        <Icon size={22} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-2xl font-black text-black uppercase italic tracking-tighter truncate">{g.title}</p>
                          {done ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-(--accents)/10 text-(--accents) text-[10px] font-black uppercase tracking-widest">
                              <Check size={12} /> Cumplida
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] font-black text-black/40 uppercase tracking-widest mt-2">
                          {meta.label} · {periodLabel}
                        </p>
                        {meta.helper ? <p className="text-xs font-bold text-black/40 mt-1">{meta.helper}</p> : null}
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <Link
                            href={meta.href}
                            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-50 border border-black/5 text-black/70 hover:text-black hover:bg-white transition-all text-[10px] font-black uppercase tracking-widest"
                          >
                            Ver fuente <ChevronRight size={14} />
                          </Link>
                          <Link
                            href="/analytics"
                            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-black text-white hover:bg-black/80 transition-all text-[10px] font-black uppercase tracking-widest"
                          >
                            Analytics <BarChart3 size={14} />
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(g)}
                        className="p-4 rounded-2xl bg-gray-50 border border-black/5 text-black/50 hover:text-black hover:bg-white transition-all"
                        title="Editar"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => onDelete(g)}
                        className="p-4 rounded-2xl bg-gray-50 border border-black/5 text-black/50 hover:text-red-600 hover:bg-red-50 transition-all"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    {/* Porcentaje muy visible */}
                    <div className="md:col-span-4 flex flex-col items-center justify-center">
                      <div
                        className={`relative w-28 h-28 rounded-full flex items-center justify-center border-4 transition-all ${
                          done
                            ? "border-green-500 bg-green-50 text-green-700"
                            : effectivePct >= 75
                              ? "border-(--accents) bg-(--accents)/10 text-(--accents)"
                              : "border-black/10 bg-gray-50 text-black"
                        }`}
                      >
                        <span className="text-3xl font-black tabular-nums">
                          {effectivePct.toFixed(0)}
                          <span className="text-lg font-black opacity-80">%</span>
                        </span>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-black/50 mt-2">Avance</p>
                    </div>

                    {/* Botón Actualizar manualmente + Barra + Actual/Objetivo */}
                    <div className="md:col-span-8 space-y-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setManualModalGoalId(g.id)}
                          className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-(--accents)/10 border border-(--accents)/30 text-(--accents) font-black text-[10px] uppercase tracking-widest hover:bg-(--accents)/20 transition-all cursor-pointer"
                          title="Abrir desglose y agregar llamadas manualmente"
                        >
                          <Plus size={16} />
                          Actualizar manualmente
                        </button>
                      </div>
                      <div className="h-4 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            done ? "bg-green-500" : "bg-(--accents)"
                          }`}
                          style={{ width: barWidth }}
                        />
                      </div>
                      <div className="bg-black rounded-[2rem] p-5 text-white">
                        <p className="text-[10px] font-black text-(--accents) uppercase tracking-widest">Actual / Objetivo</p>
                        <p className="text-2xl font-black tracking-tighter mt-2">
                          {fmtValue(meta.format, effectiveCurrent)}{" "}
                          <span className="text-white/40 text-sm font-black">
                            / {fmtValue(meta.format, target)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Modal: Actualizar manualmente (círculo + desglose + botón +1) */}
      <AnimatePresence>
        {manualModalGoalId != null && (() => {
          const goal = goals.find((gg) => gg.id === manualModalGoalId)
          if (!goal) return null
          const meta = metricMeta(goal.metric)
          const computed = progress[goal.id]?.current ?? 0
          const manual = safeNumber(goal.manual_additions)
          const total = computed + manual
          const target = safeNumber(goal.target_value)
          const pct = target > 0 ? clampPct((total / target) * 100) : 0
          const done = target > 0 && total >= target
          return (
            <motion.div
              key="manual-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[998] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setManualModalGoalId(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-black/5 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="manual-modal-title"
              >
                <div className="p-6 border-b border-black/5 flex items-center justify-between">
                  <h3 id="manual-modal-title" className="text-lg font-black text-black uppercase tracking-tight">
                    Actualizar manualmente
                  </h3>
                  <button
                    type="button"
                    onClick={() => setManualModalGoalId(null)}
                    className="p-2 rounded-xl hover:bg-gray-100 text-black/60 hover:text-black transition-colors"
                    aria-label="Cerrar"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-8 space-y-6">
                  <p className="text-sm font-bold text-black/60 truncate">{goal.title}</p>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-28 h-28 rounded-full flex items-center justify-center border-4 transition-all ${
                        done
                          ? "border-green-500 bg-green-50 text-green-700"
                          : pct >= 75
                            ? "border-(--accents) bg-(--accents)/10 text-(--accents)"
                            : "border-black/10 bg-gray-50 text-black"
                      }`}
                    >
                      <span className="text-3xl font-black tabular-nums">
                        {pct.toFixed(0)}
                        <span className="text-lg font-black opacity-80">%</span>
                      </span>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/50 mt-2">Avance</p>
                  </div>
                  <div className="space-y-2 rounded-2xl bg-gray-50 border border-black/5 p-4">
                    <p className="text-sm font-black text-black">
                      <span className="text-black/50 font-bold text-xs uppercase tracking-widest">Eventos en calendario</span>
                      <span className="block text-xl">{fmtValue(meta.format, computed)}</span>
                    </p>
                    <p className="text-sm font-black text-black">
                      <span className="text-black/50 font-bold text-xs uppercase tracking-widest">Agregados manualmente</span>
                      <span className="block text-xl">{fmtValue(meta.format, manual)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addManualOne(goal)}
                    disabled={savingManual}
                    className="w-full py-4 rounded-2xl bg-(--accents) text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
                  >
                    <Plus size={18} />
                    Agregar 1 llamada manualmente
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualModalGoalId(null)}
                    className="w-full py-3 rounded-xl border-2 border-black/10 text-black/70 font-black text-xs uppercase tracking-widest hover:bg-black/5 transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm p-4 sm:p-8 overflow-y-auto"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
              className="bg-white w-full max-w-2xl mx-auto rounded-[3rem] border border-black/5 shadow-2xl overflow-y-auto max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-4rem)] overscroll-contain"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 sm:p-10 border-b border-black/5 flex items-start justify-between gap-6">
                <div>
                  <p className="text-[10px] font-black text-black/30 uppercase tracking-[0.35em]">Metas</p>
                  <h3 className="text-3xl font-black text-black uppercase italic tracking-tighter">
                    {editing ? "Editar meta" : "Nueva meta"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 rounded-2xl bg-gray-50 border border-black/5 text-black/40 hover:text-black transition-all"
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={onSubmit} className="p-8 sm:p-10 space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Título</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Ej: Llamadas de la semana"
                      className="mt-2 w-full bg-white p-5 rounded-[2rem] border border-black/10 font-black text-black outline-none focus:ring-2 focus:ring-(--accents)/20 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Métrica</label>
                      <select
                        value={form.metric}
                        onChange={(e) => setForm((p) => ({ ...p, metric: e.target.value as GoalMetric }))}
                        className="mt-2 w-full bg-white p-5 rounded-[2rem] border border-black/10 font-black text-black outline-none focus:ring-2 focus:ring-(--accents)/20 transition-all"
                      >
                        {(
                          [
                            "leads.new_count",
                            "tasks.calls_done",
                            "leads.converted_to_customers",
                          ] as GoalMetric[]
                        ).map((m) => (
                          <option key={m} value={m}>
                            {metricMeta(m).label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Objetivo</label>
                      <input
                        value={form.target_value}
                        onChange={(e) => setForm((p) => ({ ...p, target_value: e.target.value }))}
                        type="number"
                        step="0.01"
                        min="0"
                        className="mt-2 w-full bg-white p-5 rounded-[2rem] border border-black/10 font-black text-black outline-none focus:ring-2 focus:ring-(--accents)/20 transition-all"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Periodo</label>
                      <select
                        value={form.period_type}
                        onChange={(e) => setForm((p) => ({ ...p, period_type: e.target.value as GoalPeriod }))}
                        className="mt-2 w-full bg-white p-5 rounded-[2rem] border border-black/10 font-black text-black outline-none focus:ring-2 focus:ring-(--accents)/20 transition-all"
                      >
                        <option value="month">Mensual</option>
                        <option value="week">Semanal</option>
                        <option value="custom">Personalizar </option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Estado</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as GoalStatus }))}
                        className="mt-2 w-full bg-white p-5 rounded-[2rem] border border-black/10 font-black text-black outline-none focus:ring-2 focus:ring-(--accents)/20 transition-all"
                      >
                        <option value="active">Activa</option>
                        <option value="archived">Archivada</option>
                      </select>
                    </div>
                  </div>

                  {form.period_type === "month" ? (
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Mes</label>
                      <input
                        value={form.month_year}
                        onChange={(e) => setForm((p) => ({ ...p, month_year: e.target.value }))}
                        type="month"
                        className="mt-2 w-full bg-white p-5 rounded-[2rem] border border-black/10 font-black text-black outline-none focus:ring-2 focus:ring-(--accents)/20 transition-all"
                      />
                    </div>
                  ) : null}

                  {form.period_type === "week" ? (
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Semana (ancla)</label>
                      <input
                        value={form.start_at}
                        onChange={(e) => setForm((p) => ({ ...p, start_at: e.target.value }))}
                        type="date"
                        className="mt-2 w-full bg-white p-5 rounded-[2rem] border border-black/10 font-black text-black outline-none focus:ring-2 focus:ring-(--accents)/20 transition-all"
                      />
                      <p className="text-xs font-bold text-black/40 mt-2">Usamos esa fecha para calcular la semana (Lun→Dom).</p>
                    </div>
                  ) : null}

                  {form.period_type === "custom" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Inicio</label>
                        <input
                          value={form.start_at}
                          onChange={(e) => setForm((p) => ({ ...p, start_at: e.target.value }))}
                          type="date"
                          className="mt-2 w-full bg-white p-5 rounded-[2rem] border border-black/10 font-black text-black outline-none focus:ring-2 focus:ring-(--accents)/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-black/40">Fin</label>
                        <input
                          value={form.end_at}
                          onChange={(e) => setForm((p) => ({ ...p, end_at: e.target.value }))}
                          type="date"
                          className="mt-2 w-full bg-white p-5 rounded-[2rem] border border-black/10 font-black text-black outline-none focus:ring-2 focus:ring-(--accents)/20 transition-all"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 py-5 rounded-[2rem] bg-gray-50 border border-black/5 text-black font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-10 py-5 rounded-[2rem] bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-(--accents) transition-all shadow-xl active:scale-95"
                  >
                    {editing ? "Guardar cambios" : "Crear meta"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}