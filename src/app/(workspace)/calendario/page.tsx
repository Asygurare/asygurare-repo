"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { DATABASE } from "@/src/config"
import { motion, AnimatePresence } from "framer-motion"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Loader2,
  X,
  Trash2,
  Save,
  PhoneCall,
  MessageSquare,
  Users,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
} from "lucide-react"
import { supabaseClient } from "@/src/lib/supabase/client"
import { toast, Toaster } from "sonner"

type Priority = "Todas" | "Alta" | "Media" | "Baja"
type TaskPriority = Exclude<Priority, "Todas">
type TaskStatus = "open" | "done"
type TaskKind = "Llamada" | "Cita" | "Mensaje" | "Seguimiento" | "Otro"
type EntityType = "lead" | "customer" | "none"
type ViewMode = "Día" | "Mes" | "Año"

type Task = {
  id: string
  user_id?: string
  title: string
  description?: string | null
  notes?: string | null
  kind: TaskKind
  priority: TaskPriority
  status: TaskStatus
  due_at: string // ISO
  completed_at?: string | null
  entity_type: EntityType
  entity_id?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type LightweightPerson = {
  id: string
  full_name: string
  email?: string | null
  phone?: string | null
}

const LS_KEY_PREFIX = "tg_calendar_tasks_v1"

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function toISOFromDateAndTime(dateStr: string, timeStr: string) {
  // date: YYYY-MM-DD, time: HH:mm
  const [y, m, d] = dateStr.split("-").map((x) => parseInt(x, 10))
  const [hh, mm] = timeStr.split(":").map((x) => parseInt(x, 10))
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0)
  return dt.toISOString()
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}
function addMonths(d: Date, months: number) {
  return new Date(d.getFullYear(), d.getMonth() + months, 1)
}
function addDays(d: Date, days: number) {
  const next = new Date(d)
  next.setDate(d.getDate() + days)
  return next
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function isToday(d: Date) {
  return sameDay(d, new Date())
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function priorityPill(priority: TaskPriority) {
  if (priority === "Alta") return "bg-red-50 text-red-600 border-red-100"
  if (priority === "Media") return "bg-orange-50 text-orange-700 border-orange-100"
  return "bg-gray-50 text-gray-600 border-gray-100"
}

function kindIcon(kind: TaskKind) {
  if (kind === "Llamada") return PhoneCall
  if (kind === "Mensaje") return MessageSquare
  if (kind === "Cita") return CalendarDays
  if (kind === "Seguimiento") return Briefcase
  return Clock
}

function safeUUID() {
  try {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

export default function CalendarioPage() {
  const [loading, setLoading] = useState(true)
  const [storageMode, setStorageMode] = useState<"supabase" | "local">("supabase")
  const [userId, setUserId] = useState<string | null>(null)

  const [customers, setCustomers] = useState<LightweightPerson[]>([])
  const [leads, setLeads] = useState<LightweightPerson[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  const [searchTerm, setSearchTerm] = useState("")
  const [priorityTab, setPriorityTab] = useState<Priority>("Todas")
  const [showDone, setShowDone] = useState(false)

  const [viewMode, setViewMode] = useState<ViewMode>("Mes")
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [yearCursor, setYearCursor] = useState<number>(() => new Date().getFullYear())

  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const [form, setForm] = useState<{
    title: string
    kind: TaskKind
    priority: TaskPriority
    date: string // YYYY-MM-DD
    time: string // HH:mm
    entity_type: EntityType
    entity_id: string
    description: string
    notes: string
  }>({
    title: "",
    kind: "Llamada",
    priority: "Media",
    date: dayKey(new Date()),
    time: "10:00",
    entity_type: "none",
    entity_id: "",
    description: "",
    notes: "",
  })

  const lsKey = useMemo(() => {
    return `${LS_KEY_PREFIX}:${userId || "anon"}`
  }, [userId])

  const loadFromLocal = useCallback((): Task[] => {
    try {
      const raw = window.localStorage.getItem(lsKey)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
        .filter((t) => t && typeof t === "object" && typeof t.id === "string")
        .map((t) => ({
          id: String(t.id),
          title: String(t.title || ""),
          kind: (t.kind as TaskKind) || "Otro",
          priority: (t.priority as TaskPriority) || "Media",
          status: (t.status as TaskStatus) || "open",
          due_at: String(t.due_at || new Date().toISOString()),
          completed_at: t.completed_at ?? null,
          entity_type: (t.entity_type as EntityType) || "none",
          entity_id: t.entity_id ?? null,
          description: t.description ?? null,
          notes: t.notes ?? null,
          created_at: t.created_at ?? null,
          updated_at: t.updated_at ?? null,
          user_id: userId || undefined,
        }))
    } catch {
      return []
    }
  }, [lsKey, userId])

  const saveToLocal = useCallback(
    (next: Task[]) => {
      try {
        window.localStorage.setItem(lsKey, JSON.stringify(next))
      } catch {
        // ignore
      }
    },
    [lsKey]
  )

  const fetchPeople = useCallback(async () => {
    const [custRes, leadsRes] = await Promise.all([
      supabaseClient.from(DATABASE.TABLES.WS_CUSTOMERS).select("id, full_name, email, phone").order("created_at", { ascending: false }),
      supabaseClient.from(DATABASE.TABLES.WS_LEADS).select("id, full_name, email, phone").order("updated_at", { ascending: false }),
    ])

    if (custRes.error) toast.error("Error al cargar clientes: " + custRes.error.message)
    if (leadsRes.error) toast.error("Error al cargar prospectos: " + leadsRes.error.message)

    setCustomers((custRes.data || []) as any)
    setLeads((leadsRes.data || []) as any)
  }, [])

  const fetchTasks = useCallback(async () => {
    // Try Supabase first; if tasks table doesn't exist, fallback local
    try {
      const { data, error } = await supabaseClient
        .from(DATABASE.TABLES.WS_TASKS)
        .select("*")
        .order("due_at", { ascending: true })

      if (error) throw error
      setStorageMode("supabase")

      const normalized: Task[] = (data || []).map((row: any) => ({
        id: String(row.id),
        user_id: row.user_id ?? undefined,
        title: String(row.title || ""),
        description: row.description ?? null,
        notes: row.notes ?? null,
        kind: (row.kind as TaskKind) || "Otro",
        priority: (row.priority as TaskPriority) || "Media",
        status: (row.status as TaskStatus) || "open",
        due_at: String(row.due_at || new Date().toISOString()),
        completed_at: row.completed_at ?? null,
        entity_type: (row.entity_type as EntityType) || "none",
        entity_id: row.entity_id ?? null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
      }))

      setTasks(normalized)
    } catch (e: any) {
      setStorageMode("local")
      const local = loadFromLocal()
      setTasks(local)
      toast.message("Calendario en modo local", {
        description: "No se detectó la tabla `tasks` en Supabase. Se guardará en este dispositivo por ahora.",
      })
    }
  }, [loadFromLocal])

  const bootstrap = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabaseClient.auth.getUser()
      if (error) throw error
      const user = data.user
      setUserId(user?.id || null)

      await Promise.all([fetchPeople(), fetchTasks()])
    } catch (e: any) {
      toast.error("No se pudo inicializar Calendario: " + (e?.message || "Error desconocido"))
    } finally {
      setLoading(false)
    }
  }, [fetchPeople, fetchTasks])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  const monthLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" })
    const txt = fmt.format(monthCursor)
    return txt.charAt(0).toUpperCase() + txt.slice(1)
  }, [monthCursor])

  const yearLabel = useMemo(() => String(yearCursor), [yearCursor])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      const d = new Date(t.due_at)
      const key = dayKey(d)
      const arr = map.get(key) || []
      arr.push(t)
      map.set(key, arr)
    }
    return map
  }, [tasks])

  const tasksByMonth = useMemo(() => {
    const map = new Map<string, { total: number; open: number; high: number }>()
    for (const t of tasks) {
      const d = new Date(t.due_at)
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
      const prev = map.get(key) || { total: 0, open: 0, high: 0 }
      const next = { ...prev }
      next.total += 1
      if (t.status !== "done") next.open += 1
      if (t.status !== "done" && t.priority === "Alta") next.high += 1
      map.set(key, next)
    }
    return map
  }, [tasks])

  const upcomingTasks = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    return tasks
      .filter((t) => t.status !== "done" && new Date(t.due_at).getTime() >= start.getTime())
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
      .slice(0, 8)
  }, [tasks])

  const selectedDayTasks = useMemo(() => {
    const key = dayKey(selectedDate)
    const list = tasksByDay.get(key) || []

    const filtered = list.filter((t) => {
      if (!showDone && t.status === "done") return false
      if (priorityTab !== "Todas" && t.priority !== priorityTab) return false
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        const relatedName =
          t.entity_type === "customer"
            ? customers.find((c) => c.id === t.entity_id)?.full_name
            : t.entity_type === "lead"
              ? leads.find((l) => l.id === t.entity_id)?.full_name
              : ""
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.notes || "").toLowerCase().includes(q) ||
          (relatedName || "").toLowerCase().includes(q)
        )
      }
      return true
    })

    return filtered.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
  }, [customers, leads, priorityTab, searchTerm, selectedDate, showDone, tasksByDay])

  const monthGrid = useMemo(() => {
    const start = startOfMonth(monthCursor)
    const end = endOfMonth(monthCursor)

    // Monday-first grid
    const weekday = start.getDay() // 0 Sun -> 6 Sat
    const mondayFirstIndex = (weekday + 6) % 7 // 0 Mon ... 6 Sun

    const daysInMonth = end.getDate()
    const cells: { date: Date; inMonth: boolean }[] = []

    // prev month filler
    for (let i = 0; i < mondayFirstIndex; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() - (mondayFirstIndex - i))
      cells.push({ date: d, inMonth: false })
    }
    // current month
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ date: new Date(start.getFullYear(), start.getMonth(), day), inMonth: true })
    }
    // next month filler to complete 6 weeks (42 cells)
    while (cells.length < 42) {
      const last = cells[cells.length - 1]!.date
      const next = new Date(last)
      next.setDate(last.getDate() + 1)
      cells.push({ date: next, inMonth: false })
    }

    return cells
  }, [monthCursor])

  const openNewTask = () => {
    setSelectedTask(null)
    setForm({
      title: "",
      kind: "Llamada",
      priority: "Media",
      date: dayKey(selectedDate),
      time: "10:00",
      entity_type: "none",
      entity_id: "",
      description: "",
      notes: "",
    })
    setIsPanelOpen(true)
  }

  const openEditTask = (t: Task) => {
    setSelectedTask(t)
    const d = new Date(t.due_at)
    setForm({
      title: t.title,
      kind: t.kind,
      priority: t.priority,
      date: dayKey(d),
      time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
      entity_type: t.entity_type,
      entity_id: t.entity_id || "",
      description: (t.description || "") as string,
      notes: (t.notes || "") as string,
    })
    setIsPanelOpen(true)
  }

  const upsertTask = async (payload: Task) => {
    // optimistic update in UI, then persist
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === payload.id)
      const next = exists ? prev.map((t) => (t.id === payload.id ? payload : t)) : [payload, ...prev]
      return next.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
    })

    if (storageMode === "local") {
      const next = (() => {
        const current = loadFromLocal()
        const exists = current.some((t) => t.id === payload.id)
        const updated = exists ? current.map((t) => (t.id === payload.id ? payload : t)) : [payload, ...current]
        return updated
      })()
      saveToLocal(next)
      return
    }

    try {
      const now = new Date().toISOString()
      const row: any = {
        id: payload.id,
        user_id: userId,
        title: payload.title,
        description: payload.description,
        notes: payload.notes,
        kind: payload.kind,
        priority: payload.priority,
        status: payload.status,
        due_at: payload.due_at,
        completed_at: payload.completed_at,
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        updated_at: now,
      }

      const { error } = await supabaseClient.from(DATABASE.TABLES.WS_TASKS).upsert(row)
      if (error) throw error
    } catch (e: any) {
      setStorageMode("local")
      toast.message("Guardado local activado", {
        description: "No se pudo guardar en Supabase. Se guardará en este dispositivo por ahora.",
      })
      const current = loadFromLocal()
      const exists = current.some((t) => t.id === payload.id)
      const updated = exists ? current.map((t) => (t.id === payload.id ? payload : t)) : [payload, ...current]
      saveToLocal(updated)
    }
  }

  const removeTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))

    if (storageMode === "local") {
      const current = loadFromLocal().filter((t) => t.id !== id)
      saveToLocal(current)
      return
    }

    try {
      const { error } = await supabaseClient.from(DATABASE.TABLES.WS_TASKS).delete().eq("id", id)
      if (error) throw error
    } catch (e: any) {
      setStorageMode("local")
      toast.message("Eliminación local activada", {
        description: "No se pudo eliminar en Supabase. Ajusté el calendario a modo local.",
      })
      const current = loadFromLocal().filter((t) => t.id !== id)
      saveToLocal(current)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error("Escribe un título para la tarea")
      return
    }

    setSaving(true)
    try {
      const now = new Date().toISOString()
      const dueISO = toISOFromDateAndTime(form.date, form.time)
      const base: Task = {
        id: selectedTask?.id || safeUUID(),
        user_id: userId || undefined,
        title: form.title.trim(),
        description: form.description?.trim() || null,
        notes: form.notes?.trim() || null,
        kind: form.kind,
        priority: form.priority,
        status: selectedTask?.status || "open",
        due_at: dueISO,
        completed_at: selectedTask?.completed_at ?? null,
        entity_type: form.entity_type,
        entity_id: form.entity_type === "none" ? null : form.entity_id || null,
        created_at: selectedTask?.created_at || now,
        updated_at: now,
      }

      await upsertTask(base)
      toast.success(selectedTask ? "Tarea actualizada" : "Tarea creada")
      setIsPanelOpen(false)
      setSelectedTask(null)
    } catch (e: any) {
      toast.error("No se pudo guardar: " + (e?.message || "Error desconocido"))
    } finally {
      setSaving(false)
    }
  }

  const toggleDone = async (t: Task) => {
    const next: Task = {
      ...t,
      status: t.status === "done" ? "open" : "done",
      completed_at: t.status === "done" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    await upsertTask(next)
  }

  const selectedDateLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "2-digit", month: "long" })
    const txt = fmt.format(selectedDate)
    return txt.charAt(0).toUpperCase() + txt.slice(1)
  }, [selectedDate])

  const selectedDateKey = useMemo(() => dayKey(selectedDate), [selectedDate])

  const priorities: Priority[] = ["Todas", "Alta", "Media", "Baja"]
  const viewModes: ViewMode[] = ["Día", "Mes", "Año"]

  const weekdayLabels = ["L", "M", "M", "J", "V", "S", "D"]

  const setSelectedDateAndSync = (next: Date) => {
    setSelectedDate(next)
    setMonthCursor(startOfMonth(next))
    setYearCursor(next.getFullYear())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-black/30" size={42} />
      </div>
    )
  }

  return (
    <div className="space-y-8 p-4">
      <Toaster richColors position="top-center" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-black rounded-2xl shadow-xl">
              <CalendarDays className="text-(--accents)" size={26} />
            </div>
            <h2 className="text-4xl font-black text-black tracking-tighter italic uppercase">Calendario.</h2>
          </div>
          <p className="text-black/50 font-bold text-[10px] uppercase tracking-[0.4em] ml-1">
            Tareas, llamadas, citas y seguimiento de tu cartera
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="bg-white border border-black/5 rounded-[2rem] p-2 flex items-center gap-2 shadow-sm w-full md:w-auto justify-between">
            {viewModes.map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                  viewMode === m
                    ? "bg-black text-white border-black shadow-lg"
                    : "bg-white text-black/40 border-black/5 hover:bg-gray-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            onClick={openNewTask}
            className="bg-black text-white px-10 py-5 rounded-[2rem] font-black text-sm flex items-center gap-3 hover:bg-(--accents) transition-all shadow-2xl active:scale-95 shrink-0"
          >
            <Plus size={18} /> NUEVA TAREA
          </button>
        </div>
      </div>

      {/* CONTROLES */}
      <div className="bg-white p-4 rounded-[2rem] border border-black/5 flex flex-col md:flex-row gap-4 items-center shadow-sm">
        <div className="flex-1 relative group w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-black/40 group-focus-within:text-(--accents)" size={20} />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar tarea, notas, cliente o prospecto..."
            className="w-full bg-[#ece7e2]/50 text-black font-black py-4 pl-14 pr-6 rounded-2xl outline-none focus:bg-white border-2 border-transparent focus:border-black/10 transition-all placeholder:text-gray-400"
          />
        </div>

        <div className="flex gap-2 shrink-0 w-full md:w-auto justify-between md:justify-start">
          {priorities.map((p) => (
            <button
              key={p}
              onClick={() => setPriorityTab(p)}
              className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                priorityTab === p
                  ? "bg-black text-white border-black shadow-lg"
                  : "bg-white text-black/40 border-black/5 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowDone((v) => !v)}
          className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border shrink-0 ${
            showDone ? "bg-(--accents) text-white border-(--accents)" : "bg-white text-black/40 border-black/5 hover:bg-gray-50"
          }`}
        >
          {showDone ? "MOSTRANDO HECHAS" : "OCULTAR HECHAS"}
        </button>
      </div>

      {/* GRID */}
      {viewMode === "Mes" ? (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* CALENDARIO */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mes</p>
              <h3 className="text-2xl font-black text-black italic">{monthLabel}</h3>
              <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest mt-1">
                {storageMode === "supabase" ? "Sync con Supabase" : "Modo local (este dispositivo)"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMonthCursor((d) => addMonths(d, -1))}
                className="p-3 rounded-2xl bg-gray-50 text-black hover:bg-black hover:text-white transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => {
                  setMonthCursor(startOfMonth(new Date()))
                  setSelectedDate(new Date())
                }}
                className="px-5 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-(--accents) transition-all"
              >
                Hoy
              </button>
              <button
                onClick={() => setMonthCursor((d) => addMonths(d, 1))}
                className="p-3 rounded-2xl bg-gray-50 text-black hover:bg-black hover:text-white transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekdayLabels.map((w, i) => (
              <div key={i} className="text-center text-[10px] font-black uppercase tracking-widest text-black/30 py-2">
                {w}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-2">
            {monthGrid.map(({ date, inMonth }) => {
              const key = dayKey(date)
              const list = tasksByDay.get(key) || []
              const openCount = list.filter((t) => t.status !== "done").length
              const highCount = list.filter((t) => t.status !== "done" && t.priority === "Alta").length
              const selected = sameDay(date, selectedDate)

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDateAndSync(date)}
                  className={`text-left p-3 rounded-2xl border transition-all min-h-[78px] ${
                    selected
                      ? "bg-black text-white border-black shadow-lg"
                      : "bg-white border-black/5 hover:bg-[#ece7e2]/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`text-sm font-black ${inMonth ? "" : selected ? "text-white/60" : "text-black/20"}`}>
                      {date.getDate()}
                    </div>
                    {isToday(date) ? (
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                        selected ? "bg-white/10 text-white" : "bg-(--accents)/10 text-(--accents)"
                      }`}>
                        HOY
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {openCount > 0 ? (
                      <>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                          selected ? "text-white/70" : "text-black/40"
                        }`}>
                          {openCount} tarea{openCount === 1 ? "" : "s"}
                        </span>
                        {highCount > 0 ? (
                          <span className={`text-[10px] font-black uppercase tracking-widest ${
                            selected ? "text-red-200" : "text-red-600"
                          }`}>
                            · {highCount} alta
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        selected ? "text-white/30" : "text-black/20"
                      }`}>
                        —
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* LISTA DEL DÍA */}
        <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-8 flex flex-col">
          <div className="mb-6">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Agenda</p>
            <h3 className="text-2xl font-black text-black italic">{selectedDateLabel}</h3>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-1">
            {selectedDayTasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 py-14">
                <CalendarDays size={44} className="text-gray-100 mb-4" />
                <p className="font-bold text-black">Sin tareas para este día</p>
                <button
                  onClick={openNewTask}
                  className="mt-6 px-6 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-(--accents) transition-all"
                >
                  + Crear tarea
                </button>
              </div>
            ) : (
              selectedDayTasks.map((t) => {
                const Icon = kindIcon(t.kind)
                const dt = new Date(t.due_at)
                const time = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`
                const related =
                  t.entity_type === "customer"
                    ? customers.find((c) => c.id === t.entity_id)
                    : t.entity_type === "lead"
                      ? leads.find((l) => l.id === t.entity_id)
                      : null
                const relatedLabel =
                  t.entity_type === "customer" ? "Cliente" : t.entity_type === "lead" ? "Prospecto" : null

                return (
                  <div
                    key={t.id}
                    className={`p-6 rounded-[2rem] border transition-all group ${
                      t.status === "done" ? "bg-gray-50/60 border-gray-100 opacity-70" : "bg-white border-black/5 hover:border-(--accents)/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0">
                        <button
                          onClick={() => toggleDone(t)}
                          className={`mt-1 w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                            t.status === "done" ? "bg-green-600 text-white" : "bg-gray-50 text-black hover:bg-black hover:text-white"
                          }`}
                          title={t.status === "done" ? "Marcar como pendiente" : "Marcar como hecha"}
                        >
                          <CheckCircle2 size={18} />
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="p-2 bg-gray-50 rounded-xl text-black">
                              <Icon size={16} />
                            </div>
                            <p className={`font-black text-black uppercase tracking-tighter truncate ${t.status === "done" ? "line-through" : ""}`}>
                              {t.title}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-widest text-black/40 flex items-center gap-2">
                              <Clock size={12} className="opacity-40" /> {time}
                            </span>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${priorityPill(t.priority)}`}>
                              {t.priority}
                            </span>
                            {related && relatedLabel ? (
                              <span className="text-[10px] font-black uppercase tracking-widest text-black/40 flex items-center gap-2">
                                {t.entity_type === "customer" ? <Users size={12} className="opacity-40" /> : <Target size={12} className="opacity-40" />}
                                {relatedLabel}: <span className="text-black/70">{related.full_name}</span>
                              </span>
                            ) : null}
                          </div>

                          {t.description ? (
                            <p className="text-[11px] font-bold text-black/50 mt-3 leading-relaxed line-clamp-2">
                              {t.description}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <button
                        onClick={() => openEditTask(t)}
                        className="p-3 rounded-2xl text-black/20 hover:text-black hover:bg-gray-50 transition-all"
                        title="Editar"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Quick info */}
          <div className="mt-6 p-6 rounded-[2rem] border border-black/5 bg-[#ece7e2]/30">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-(--accents)" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-black">Tip</p>
                <p className="text-[11px] font-bold text-black/50 leading-relaxed mt-1">
                  Crea tareas tipo <span className="text-black">Llamada</span> o <span className="text-black">Mensaje</span> ligadas a un prospecto/cliente.
                  Así tu historial de contacto queda en la agenda, sin ensuciar notas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {viewMode === "Día" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* AGENDA DEL DÍA (FULL) */}
          <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-8 flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Día</p>
                <h3 className="text-2xl font-black text-black italic">{selectedDateLabel}</h3>
                <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest mt-1">
                  {storageMode === "supabase" ? "Sync con Supabase" : "Modo local (este dispositivo)"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDateAndSync(addDays(selectedDate, -1))}
                  className="p-3 rounded-2xl bg-gray-50 text-black hover:bg-black hover:text-white transition-all"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setSelectedDateAndSync(new Date())}
                  className="px-5 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-(--accents) transition-all"
                >
                  Hoy
                </button>
                <button
                  onClick={() => setSelectedDateAndSync(addDays(selectedDate, 1))}
                  className="p-3 rounded-2xl bg-gray-50 text-black hover:bg-black hover:text-white transition-all"
                >
                  <ChevronRight size={18} />
                </button>
                <div className="hidden md:block w-2" />
                <input
                  type="date"
                  value={selectedDateKey}
                  onChange={(e) => {
                    const [y, m, d] = e.target.value.split("-").map((x) => parseInt(x, 10))
                    if (!y || !m || !d) return
                    setSelectedDateAndSync(new Date(y, m - 1, d))
                  }}
                  className="hidden md:block bg-[#ece7e2]/50 border border-black/5 rounded-2xl px-4 py-3 text-[11px] font-black text-black outline-none"
                />
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-1">
              {selectedDayTasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 py-14">
                  <CalendarDays size={44} className="text-gray-100 mb-4" />
                  <p className="font-bold text-black">Sin tareas para este día</p>
                  <button
                    onClick={openNewTask}
                    className="mt-6 px-6 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-(--accents) transition-all"
                  >
                    + Crear tarea
                  </button>
                </div>
              ) : (
                selectedDayTasks.map((t) => {
                  const Icon = kindIcon(t.kind)
                  const dt = new Date(t.due_at)
                  const time = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`
                  const related =
                    t.entity_type === "customer"
                      ? customers.find((c) => c.id === t.entity_id)
                      : t.entity_type === "lead"
                        ? leads.find((l) => l.id === t.entity_id)
                        : null
                  const relatedLabel =
                    t.entity_type === "customer" ? "Cliente" : t.entity_type === "lead" ? "Prospecto" : null

                  return (
                    <div
                      key={t.id}
                      className={`p-6 rounded-[2rem] border transition-all group ${
                        t.status === "done"
                          ? "bg-gray-50/60 border-gray-100 opacity-70"
                          : "bg-white border-black/5 hover:border-(--accents)/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 min-w-0">
                          <button
                            onClick={() => toggleDone(t)}
                            className={`mt-1 w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                              t.status === "done" ? "bg-green-600 text-white" : "bg-gray-50 text-black hover:bg-black hover:text-white"
                            }`}
                            title={t.status === "done" ? "Marcar como pendiente" : "Marcar como hecha"}
                          >
                            <CheckCircle2 size={18} />
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="p-2 bg-gray-50 rounded-xl text-black">
                                <Icon size={16} />
                              </div>
                              <p
                                className={`font-black text-black uppercase tracking-tighter truncate ${
                                  t.status === "done" ? "line-through" : ""
                                }`}
                              >
                                {t.title}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <span className="text-[10px] font-black uppercase tracking-widest text-black/40 flex items-center gap-2">
                                <Clock size={12} className="opacity-40" /> {time}
                              </span>
                              <span
                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${priorityPill(
                                  t.priority
                                )}`}
                              >
                                {t.priority}
                              </span>
                              {related && relatedLabel ? (
                                <span className="text-[10px] font-black uppercase tracking-widest text-black/40 flex items-center gap-2">
                                  {t.entity_type === "customer" ? (
                                    <Users size={12} className="opacity-40" />
                                  ) : (
                                    <Target size={12} className="opacity-40" />
                                  )}
                                  {relatedLabel}: <span className="text-black/70">{related.full_name}</span>
                                </span>
                              ) : null}
                            </div>

                            {t.description ? (
                              <p className="text-[11px] font-bold text-black/50 mt-3 leading-relaxed line-clamp-2">
                                {t.description}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <button
                          onClick={() => openEditTask(t)}
                          className="p-3 rounded-2xl text-black/20 hover:text-black hover:bg-gray-50 transition-all"
                          title="Editar"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* PRÓXIMOS */}
          <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-8 flex flex-col">
            <div className="mb-6">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Siguiente</p>
              <h3 className="text-2xl font-black text-black italic">Próximas tareas</h3>
              <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest mt-1">Próximos días</p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
              {upcomingTasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 py-14">
                  <Clock size={42} className="text-gray-100 mb-4" />
                  <p className="font-bold text-black">No hay tareas pendientes</p>
                </div>
              ) : (
                upcomingTasks.map((t) => {
                  const Icon = kindIcon(t.kind)
                  const dt = new Date(t.due_at)
                  const when = new Intl.DateTimeFormat("es-MX", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                    .format(dt)
                    .toUpperCase()
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedDateAndSync(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()))
                        openEditTask(t)
                      }}
                      className="w-full text-left p-5 rounded-[2rem] border border-black/5 hover:border-(--accents)/30 hover:bg-[#ece7e2]/30 transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-gray-50 rounded-2xl text-black">
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-black uppercase tracking-tighter truncate">{t.title}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-black/40">{when}</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${priorityPill(t.priority)}`}>
                              {t.priority}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            <button
              onClick={() => setViewMode("Mes")}
              className="w-full mt-6 py-5 border-2 border-dashed border-gray-100 rounded-[2rem] text-gray-400 font-black text-[10px] uppercase tracking-widest hover:border-(--accents) hover:text-(--accents) transition-all"
            >
              Ver mes completo →
            </button>
          </div>
        </div>
      ) : null}

      {viewMode === "Año" ? (
        <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Año</p>
              <h3 className="text-2xl font-black text-black italic">{yearLabel}</h3>
              <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest mt-1">
                {storageMode === "supabase" ? "Sync con Supabase" : "Modo local (este dispositivo)"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setYearCursor((y) => y - 1)}
                className="p-3 rounded-2xl bg-gray-50 text-black hover:bg-black hover:text-white transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => {
                  const now = new Date()
                  setYearCursor(now.getFullYear())
                  setMonthCursor(startOfMonth(now))
                  setSelectedDate(now)
                }}
                className="px-5 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-(--accents) transition-all"
              >
                Este año
              </button>
              <button
                onClick={() => setYearCursor((y) => y + 1)}
                className="p-3 rounded-2xl bg-gray-50 text-black hover:bg-black hover:text-white transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, idx) => {
              const monthDate = new Date(yearCursor, idx, 1)
              const monthKey = `${yearCursor}-${String(idx + 1).padStart(2, "0")}`
              const stats = tasksByMonth.get(monthKey) || { total: 0, open: 0, high: 0 }
              const label = new Intl.DateTimeFormat("es-MX", { month: "long" }).format(monthDate)
              const monthLabel = label.charAt(0).toUpperCase() + label.slice(1)

              return (
                <button
                  key={monthKey}
                  onClick={() => {
                    const first = new Date(yearCursor, idx, 1)
                    setMonthCursor(startOfMonth(first))
                    setSelectedDate(first)
                    setViewMode("Mes")
                  }}
                  className="text-left p-6 rounded-[2rem] border border-black/5 hover:border-(--accents)/30 hover:bg-[#ece7e2]/30 transition-all"
                >
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mes</p>
                  <p className="text-lg font-black text-black italic">{monthLabel}</p>

                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                      {stats.open} pendiente{stats.open === 1 ? "" : "s"}
                    </span>
                    {stats.high > 0 ? (
                      <span className="text-[10px] font-black uppercase tracking-widest text-red-600">
                        · {stats.high} alta
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3">
                    <span className="inline-block text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border bg-gray-50 text-gray-600 border-gray-100">
                      {stats.total} total
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* PANEL LATERAL (CREAR / EDITAR) */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!saving && !deleting) setIsPanelOpen(false)
              }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed right-0 top-0 h-screen w-full max-w-xl bg-[#ece7e2] z-50 flex flex-col shadow-2xl"
            >
              <div className="p-10 bg-white flex justify-between items-center border-b-4 border-black/5">
                <div>
                  <h3 className="text-3xl font-black text-black italic uppercase tracking-tighter">
                    {selectedTask ? "Editar Tarea" : "Nueva Tarea"}
                  </h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">
                    Agenda & seguimiento operativo
                  </p>
                </div>
                <button
                  onClick={() => setIsPanelOpen(false)}
                  disabled={saving || deleting}
                  className="p-4 hover:bg-gray-100 rounded-full text-black transition-all disabled:opacity-60"
                >
                  <X size={32} />
                </button>
              </div>

              <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                {/* BASICOS */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block">
                      Título de la tarea
                    </label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Llamar para agendar cita / Enviar propuesta / Seguimiento..."
                      className="w-full bg-[#ece7e2] text-black font-black py-5 px-6 rounded-2xl outline-none focus:ring-2 focus:ring-black text-lg uppercase"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block">Tipo</label>
                      <select
                        value={form.kind}
                        onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as TaskKind }))}
                        className="w-full bg-[#ece7e2] text-black font-black py-4 px-6 rounded-2xl outline-none text-sm uppercase cursor-pointer"
                      >
                        <option value="Llamada">Llamada</option>
                        <option value="Cita">Cita / Reunión</option>
                        <option value="Mensaje">Mensaje</option>
                        <option value="Seguimiento">Seguimiento</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block">Prioridad</label>
                      <select
                        value={form.priority}
                        onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
                        className="w-full bg-[#ece7e2] text-black font-black py-4 px-6 rounded-2xl outline-none text-sm uppercase cursor-pointer"
                      >
                        <option value="Alta">Alta</option>
                        <option value="Media">Media</option>
                        <option value="Baja">Baja</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* FECHA / RELACION */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block">Fecha</label>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                        className="w-full bg-transparent text-xl font-black text-black outline-none uppercase"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block">Hora</label>
                      <input
                        type="time"
                        value={form.time}
                        onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                        className="w-full bg-transparent text-xl font-black text-black outline-none uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block">
                      Relacionar con
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { id: "none", label: "Ninguno" },
                        { id: "lead", label: "Prospecto" },
                        { id: "customer", label: "Cliente" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              entity_type: opt.id,
                              entity_id: opt.id === f.entity_type ? f.entity_id : "",
                            }))
                          }
                          className={`px-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                            form.entity_type === opt.id
                              ? "bg-black text-white border-black shadow-lg"
                              : "bg-white text-black/40 border-black/5 hover:bg-gray-50"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {form.entity_type !== "none" ? (
                      <div className="space-y-2">
                        <select
                          value={form.entity_id}
                          onChange={(e) => setForm((f) => ({ ...f, entity_id: e.target.value }))}
                          className="w-full bg-[#ece7e2] text-black font-black py-4 px-6 rounded-2xl outline-none text-sm uppercase cursor-pointer"
                        >
                          <option value="">Selecciona...</option>
                          {(form.entity_type === "customer" ? customers : leads).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.full_name}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] font-bold text-black/40">
                          {form.entity_type === "customer"
                            ? "Esto te permite ver agenda por cliente."
                            : "Esto te permite ligar tareas al pipeline de prospectos."}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* DESCRIPCION / NOTAS */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block">Descripción</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      rows={4}
                      placeholder="Objetivo de la llamada, temas de la cita, contexto..."
                      className="w-full bg-[#ece7e2] p-6 rounded-2xl font-black text-black text-base outline-none resize-none placeholder:text-black/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block">Notas / Resultado</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={4}
                      placeholder="Qué se acordó, objeciones, siguiente paso, etc."
                      className="w-full bg-[#ece7e2] p-6 rounded-2xl font-black text-black text-base outline-none resize-none placeholder:text-black/20"
                    />
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-10">
                  {selectedTask ? (
                    <button
                      type="button"
                      disabled={saving || deleting}
                      onClick={async () => {
                        if (!confirm("¿Eliminar esta tarea?")) return
                        setDeleting(true)
                        try {
                          await removeTask(selectedTask.id)
                          toast.success("Tarea eliminada")
                          setIsPanelOpen(false)
                          setSelectedTask(null)
                        } catch (e: any) {
                          toast.error("No se pudo eliminar: " + (e?.message || "Error desconocido"))
                        } finally {
                          setDeleting(false)
                        }
                      }}
                      className="w-full py-6 rounded-3xl font-black text-sm transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white"
                    >
                      {deleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                      ELIMINAR
                    </button>
                  ) : (
                    <div className="hidden md:block" />
                  )}

                  <button
                    type="submit"
                    disabled={saving || deleting}
                    className="w-full py-6 rounded-3xl font-black text-sm transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95 bg-black text-white hover:bg-(--accents)"
                  >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {selectedTask ? "GUARDAR CAMBIOS" : "CREAR TAREA"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

