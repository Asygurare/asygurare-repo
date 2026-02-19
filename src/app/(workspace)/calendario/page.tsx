"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
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
  RefreshCw,
  ExternalLink,
  Video,
} from "lucide-react"
import { supabaseClient } from "@/src/lib/supabase/client"
import { getFullName } from "@/src/lib/utils/utils"
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

type GoogleCalendarStatus = {
  connected: boolean
  has_google_connection?: boolean
  needs_reconnect?: boolean
  email?: string | null
}

type GoogleCalendarEvent = {
  id: string
  status: string
  summary: string
  description?: string | null
  htmlLink?: string | null
  hangoutLink?: string | null
  start?: { dateTime?: string; date?: string; timeZone?: string } | null
  end?: { dateTime?: string; date?: string; timeZone?: string } | null
  attendeesCount?: number
}

type CalendlyStatus = {
  connected: boolean
  email?: string | null
  user_uri?: string | null
}

type CalendlyEvent = {
  id: string
  status: string
  summary: string
  start?: string | null
  end?: string | null
  htmlLink?: string | null
  location?: {
    type?: string
    location?: string
    join_url?: string
    status?: string
  } | null
}

type CalComStatus = {
  connected: boolean
  email?: string | null
  username?: string | null
  user_id?: string | null
}

type CalComEvent = {
  id: string
  status: string
  summary: string
  start?: string | null
  end?: string | null
  htmlLink?: string | null
  location?: string | null
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
  // Higher contrast so it doesn't get lost.
  if (priority === "Alta") return "bg-red-600 text-white border-red-700"
  if (priority === "Media") return "bg-orange-500 text-white border-orange-600"
  return "bg-gray-900 text-white border-black"
}

function kindPill(kind: TaskKind) {
  if (kind === "Llamada") return "bg-(--accents) text-white border-(--accents)"
  if (kind === "Cita") return "bg-blue-600 text-white border-blue-700"
  if (kind === "Mensaje") return "bg-indigo-600 text-white border-indigo-700"
  if (kind === "Seguimiento") return "bg-amber-500 text-black border-amber-600"
  return "bg-gray-100 text-black border-gray-200"
}

function kindBar(kind: TaskKind) {
  if (kind === "Llamada") return "bg-(--accents)"
  if (kind === "Cita") return "bg-blue-600"
  if (kind === "Mensaje") return "bg-indigo-600"
  if (kind === "Seguimiento") return "bg-amber-500"
  return "bg-black/10"
}

function kindIconWrap(kind: TaskKind) {
  if (kind === "Llamada") return "bg-(--accents)/10 text-(--accents) border-(--accents)/20"
  if (kind === "Cita") return "bg-blue-50 text-blue-700 border-blue-100"
  if (kind === "Mensaje") return "bg-indigo-50 text-indigo-700 border-indigo-100"
  if (kind === "Seguimiento") return "bg-amber-50 text-amber-800 border-amber-100"
  return "bg-gray-50 text-black/60 border-black/5"
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
  const [googleCalendarLoading, setGoogleCalendarLoading] = useState(true)
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState<GoogleCalendarStatus | null>(null)
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState<GoogleCalendarEvent[]>([])
  const [syncingGoogleCalendar, setSyncingGoogleCalendar] = useState(false)
  const [googleSyncPrefs, setGoogleSyncPrefs] = useState<Record<string, boolean>>({})
  const [calendlyLoading, setCalendlyLoading] = useState(true)
  const [calendlyStatus, setCalendlyStatus] = useState<CalendlyStatus | null>(null)
  const [calendlyEvents, setCalendlyEvents] = useState<CalendlyEvent[]>([])
  const [syncingCalendly, setSyncingCalendly] = useState(false)
  const [syncingCalendlyTasks, setSyncingCalendlyTasks] = useState(false)
  const [calComLoading, setCalComLoading] = useState(true)
  const [calComStatus, setCalComStatus] = useState<CalComStatus | null>(null)
  const [calComEvents, setCalComEvents] = useState<CalComEvent[]>([])
  const [syncingCalCom, setSyncingCalCom] = useState(false)
  const [syncingCalComTasks, setSyncingCalComTasks] = useState(false)

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
    sync_google: boolean
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
    sync_google: false,
  })

  const lsKey = useMemo(() => {
    return `${LS_KEY_PREFIX}:${userId || "anon"}`
  }, [userId])
  const gcalSyncLsKey = useMemo(() => {
    return `tg_gcal_sync_pref_v1:${userId || "anon"}`
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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(gcalSyncLsKey)
      if (!raw) {
        setGoogleSyncPrefs({})
        return
      }
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setGoogleSyncPrefs({})
        return
      }
      setGoogleSyncPrefs(parsed as Record<string, boolean>)
    } catch {
      setGoogleSyncPrefs({})
    }
  }, [gcalSyncLsKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(gcalSyncLsKey, JSON.stringify(googleSyncPrefs))
    } catch {
      // ignore
    }
  }, [gcalSyncLsKey, googleSyncPrefs])

  const fetchPeople = useCallback(async () => {
    const [custRes, leadsRes] = await Promise.all([
      supabaseClient.from(DATABASE.TABLES.WS_CUSTOMERS_2).select("id, name, last_name, email, phone").order("created_at", { ascending: false }),
      supabaseClient.from(DATABASE.TABLES.WS_LEADS).select("id, name, last_name, email, phone").order("updated_at", { ascending: false }),
    ])

    if (custRes.error) toast.error("Error al cargar clientes: " + custRes.error.message)
    if (leadsRes.error) toast.error("Error al cargar prospectos: " + leadsRes.error.message)

    setCustomers(
      (custRes.data || []).map((c: any) => ({
        id: String(c.id),
        full_name: getFullName(c),
        email: c.email ?? null,
        phone: c.phone ?? null,
      }))
    )
    setLeads(
      (leadsRes.data || []).map((l: any) => ({
        id: String(l.id),
        full_name: getFullName(l),
        email: l.email ?? null,
        phone: l.phone ?? null,
      }))
    )
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

  const fetchGoogleCalendarEvents = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setSyncingGoogleCalendar(true)
    try {
      const res = await fetch("/api/google-calendar/events?max=8", {
        method: "GET",
        cache: "no-store",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (!opts?.quiet) {
          toast.error(json?.detail || json?.error || "No se pudieron cargar eventos de Google Calendar")
        }
        setGoogleCalendarEvents([])
        return
      }
      setGoogleCalendarEvents(Array.isArray(json?.items) ? json.items : [])
    } catch (e: any) {
      if (!opts?.quiet) toast.error("Error cargando Google Calendar: " + (e?.message || "Error desconocido"))
      setGoogleCalendarEvents([])
    } finally {
      if (!opts?.quiet) setSyncingGoogleCalendar(false)
    }
  }, [])

  const fetchGoogleCalendarStatus = useCallback(async () => {
    setGoogleCalendarLoading(true)
    try {
      const res = await fetch("/api/google-calendar/status", {
        method: "GET",
        cache: "no-store",
      })
      const json = (await res.json().catch(() => ({}))) as GoogleCalendarStatus
      if (!res.ok) throw new Error((json as any)?.error || "No se pudo consultar Google Calendar")
      setGoogleCalendarStatus(json)
      if (json.connected) {
        await fetchGoogleCalendarEvents({ quiet: true })
      } else {
        setGoogleCalendarEvents([])
      }
    } catch {
      setGoogleCalendarStatus({ connected: false })
      setGoogleCalendarEvents([])
    } finally {
      setGoogleCalendarLoading(false)
    }
  }, [fetchGoogleCalendarEvents])

  const fetchCalendlyEvents = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setSyncingCalendly(true)
    try {
      const res = await fetch("/api/calendly/events?max=8", {
        method: "GET",
        cache: "no-store",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (!opts?.quiet) {
          toast.error(json?.detail || json?.error || "No se pudieron cargar eventos de Calendly")
        }
        setCalendlyEvents([])
        return
      }
      setCalendlyEvents(Array.isArray(json?.items) ? json.items : [])
    } catch (e: any) {
      if (!opts?.quiet) toast.error("Error cargando Calendly: " + (e?.message || "Error desconocido"))
      setCalendlyEvents([])
    } finally {
      if (!opts?.quiet) setSyncingCalendly(false)
    }
  }, [])

  const fetchCalendlyStatus = useCallback(async () => {
    setCalendlyLoading(true)
    try {
      const res = await fetch("/api/calendly/status", {
        method: "GET",
        cache: "no-store",
      })
      const json = (await res.json().catch(() => ({}))) as CalendlyStatus
      if (!res.ok) throw new Error((json as any)?.error || "No se pudo consultar Calendly")
      setCalendlyStatus(json)
      if (json.connected) {
        await fetchCalendlyEvents({ quiet: true })
      } else {
        setCalendlyEvents([])
      }
    } catch {
      setCalendlyStatus({ connected: false })
      setCalendlyEvents([])
    } finally {
      setCalendlyLoading(false)
    }
  }, [fetchCalendlyEvents])

  const fetchCalComEvents = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setSyncingCalCom(true)
    try {
      const res = await fetch("/api/cal-com/events?max=8", {
        method: "GET",
        cache: "no-store",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (!opts?.quiet) {
          toast.error(json?.detail || json?.error || "No se pudieron cargar eventos de Cal.com")
        }
        setCalComEvents([])
        return
      }
      setCalComEvents(Array.isArray(json?.items) ? json.items : [])
    } catch (e: any) {
      if (!opts?.quiet) toast.error("Error cargando Cal.com: " + (e?.message || "Error desconocido"))
      setCalComEvents([])
    } finally {
      if (!opts?.quiet) setSyncingCalCom(false)
    }
  }, [])

  const fetchCalComStatus = useCallback(async () => {
    setCalComLoading(true)
    try {
      const res = await fetch("/api/cal-com/status", {
        method: "GET",
        cache: "no-store",
      })
      const json = (await res.json().catch(() => ({}))) as CalComStatus
      if (!res.ok) throw new Error((json as any)?.error || "No se pudo consultar Cal.com")
      setCalComStatus(json)
      if (json.connected) {
        await fetchCalComEvents({ quiet: true })
      } else {
        setCalComEvents([])
      }
    } catch {
      setCalComStatus({ connected: false })
      setCalComEvents([])
    } finally {
      setCalComLoading(false)
    }
  }, [fetchCalComEvents])

  const bootstrap = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabaseClient.auth.getUser()
      if (error) throw error
      const user = data.user
      setUserId(user?.id || null)

      await Promise.all([
        fetchPeople(),
        fetchTasks(),
        fetchGoogleCalendarStatus(),
        fetchCalendlyStatus(),
        fetchCalComStatus(),
      ])
    } catch (e: any) {
      toast.error("No se pudo inicializar Calendario: " + (e?.message || "Error desconocido"))
    } finally {
      setLoading(false)
    }
  }, [fetchCalComStatus, fetchCalendlyStatus, fetchGoogleCalendarStatus, fetchPeople, fetchTasks])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  useEffect(() => {
    const current = new URL(window.location.href)
    const gcalStatus = current.searchParams.get("gcal")
    if (!gcalStatus) return

    if (gcalStatus === "connected") {
      toast.success("Google Calendar conectado")
    } else if (gcalStatus === "error") {
      const reason = current.searchParams.get("reason") || "No se pudo conectar"
      toast.error("Error de conexión con Google Calendar: " + reason)
    }

    current.searchParams.delete("gcal")
    current.searchParams.delete("reason")
    current.searchParams.delete("detail")
    window.history.replaceState({}, "", `${current.pathname}${current.search}${current.hash}`)
    void fetchGoogleCalendarStatus()
  }, [fetchGoogleCalendarStatus])

  useEffect(() => {
    const current = new URL(window.location.href)
    const calendly = current.searchParams.get("calendly")
    if (!calendly) return

    if (calendly === "connected") {
      toast.success("Calendly conectado")
    } else if (calendly === "error") {
      const reason = current.searchParams.get("reason") || "No se pudo conectar"
      toast.error("Error de conexión con Calendly: " + reason)
    }

    current.searchParams.delete("calendly")
    current.searchParams.delete("reason")
    current.searchParams.delete("detail")
    window.history.replaceState({}, "", `${current.pathname}${current.search}${current.hash}`)
    void fetchCalendlyStatus()
  }, [fetchCalendlyStatus])

  useEffect(() => {
    const current = new URL(window.location.href)
    const calcom = current.searchParams.get("calcom")
    if (!calcom) return

    if (calcom === "connected") {
      toast.success("Cal.com conectado")
    } else if (calcom === "error") {
      const reason = current.searchParams.get("reason") || "No se pudo conectar"
      toast.error("Error de conexión con Cal.com: " + reason)
    }

    current.searchParams.delete("calcom")
    current.searchParams.delete("reason")
    current.searchParams.delete("detail")
    window.history.replaceState({}, "", `${current.pathname}${current.search}${current.hash}`)
    void fetchCalComStatus()
  }, [fetchCalComStatus])

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

  const googleEventsByDayCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const event of googleCalendarEvents) {
      const start = event.start?.dateTime || event.start?.date
      if (!start) continue
      const d = new Date(start)
      if (Number.isNaN(d.getTime())) continue
      const key = dayKey(d)
      map.set(key, (map.get(key) || 0) + 1)
    }
    return map
  }, [googleCalendarEvents])

  const calendlyEventsByDayCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const event of calendlyEvents) {
      if (!event.start) continue
      const d = new Date(event.start)
      if (Number.isNaN(d.getTime())) continue
      const key = dayKey(d)
      map.set(key, (map.get(key) || 0) + 1)
    }
    return map
  }, [calendlyEvents])

  const calComEventsByDayCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const event of calComEvents) {
      if (!event.start) continue
      const d = new Date(event.start)
      if (Number.isNaN(d.getTime())) continue
      const key = dayKey(d)
      map.set(key, (map.get(key) || 0) + 1)
    }
    return map
  }, [calComEvents])

  const externalEventsByMonth = useMemo(() => {
    const map = new Map<string, { google: number; calendly: number; calcom: number; total: number }>()

    for (const event of googleCalendarEvents) {
      const start = event.start?.dateTime || event.start?.date
      if (!start) continue
      const d = new Date(start)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
      const prev = map.get(key) || { google: 0, calendly: 0, calcom: 0, total: 0 }
      const next = { ...prev, google: prev.google + 1, total: prev.total + 1 }
      map.set(key, next)
    }

    for (const event of calendlyEvents) {
      if (!event.start) continue
      const d = new Date(event.start)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
      const prev = map.get(key) || { google: 0, calendly: 0, calcom: 0, total: 0 }
      const next = { ...prev, calendly: prev.calendly + 1, total: prev.total + 1 }
      map.set(key, next)
    }

    for (const event of calComEvents) {
      if (!event.start) continue
      const d = new Date(event.start)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
      const prev = map.get(key) || { google: 0, calendly: 0, calcom: 0, total: 0 }
      const next = { ...prev, calcom: prev.calcom + 1, total: prev.total + 1 }
      map.set(key, next)
    }

    return map
  }, [calComEvents, calendlyEvents, googleCalendarEvents])

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

  // For "clear at a glance" UI: always know open vs done for the selected day.
  const selectedDayAllTasks = useMemo(() => {
    const key = dayKey(selectedDate)
    return tasksByDay.get(key) || []
  }, [selectedDate, tasksByDay])

  const selectedDayPendingTasks = useMemo(
    () => selectedDayTasks.filter((t) => t.status !== "done"),
    [selectedDayTasks]
  )

  const selectedDayDoneTasks = useMemo(
    () => selectedDayTasks.filter((t) => t.status === "done"),
    [selectedDayTasks]
  )

  const selectedDayAllCounts = useMemo(() => {
    const pending = selectedDayAllTasks.filter((t) => t.status !== "done").length
    const done = selectedDayAllTasks.filter((t) => t.status === "done").length
    return { pending, done, total: selectedDayAllTasks.length }
  }, [selectedDayAllTasks])

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
      sync_google: googleCalendarConnected,
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
      sync_google: googleSyncPrefs[t.id] ?? t.kind === "Cita",
    })
    setIsPanelOpen(true)
  }

  const syncTaskWithGoogleCalendar = useCallback(
    async (task: Task, action: "upsert" | "delete", shouldSync: boolean) => {
      if (!googleCalendarStatus?.connected) return
      try {
        const res = await fetch("/api/google-calendar/events/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            should_sync: shouldSync,
            task: {
              id: task.id,
              title: task.title,
              description: task.description ?? null,
              notes: task.notes ?? null,
              due_at: task.due_at,
              kind: task.kind,
            },
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(json?.error || "No se pudo sincronizar con Google Calendar")
        }
        if (action === "upsert" || action === "delete") {
          await fetchGoogleCalendarEvents({ quiet: true })
        }
      } catch (e: any) {
        toast.error("Tarea guardada, pero falló sync con Google Calendar: " + (e?.message || "Error desconocido"))
      }
    },
    [fetchGoogleCalendarEvents, googleCalendarStatus?.connected]
  )

  const getTaskShouldSync = useCallback(
    (task: Task) => {
      if (typeof googleSyncPrefs[task.id] === "boolean") return googleSyncPrefs[task.id]
      return task.kind === "Cita"
    },
    [googleSyncPrefs]
  )

  const upsertTask = async (payload: Task, shouldSyncOverride?: boolean) => {
    const shouldSync = typeof shouldSyncOverride === "boolean" ? shouldSyncOverride : getTaskShouldSync(payload)
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
      await syncTaskWithGoogleCalendar(payload, "upsert", shouldSync)
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
    await syncTaskWithGoogleCalendar(payload, "upsert", shouldSync)
  }

  const removeTask = async (id: string) => {
    const existingTask = tasks.find((t) => t.id === id)
    setTasks((prev) => prev.filter((t) => t.id !== id))

    if (storageMode === "local") {
      const current = loadFromLocal().filter((t) => t.id !== id)
      saveToLocal(current)
      if (existingTask) await syncTaskWithGoogleCalendar(existingTask, "delete", false)
      setGoogleSyncPrefs((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
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
    if (existingTask) await syncTaskWithGoogleCalendar(existingTask, "delete", false)
    setGoogleSyncPrefs((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
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

      setGoogleSyncPrefs((prev) => ({
        ...prev,
        [base.id]: form.sync_google,
      }))
      await upsertTask(base, form.sync_google)
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
    await upsertTask(next, getTaskShouldSync(next))
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

  const connectGoogleCalendar = () => {
    window.location.href = "/api/gmail/oauth/start?service=calendar"
  }

  const connectCalendly = () => {
    window.location.href = "/api/calendly/oauth/start"
  }

  const connectCalCom = () => {
    window.location.href = "/api/cal-com/oauth/start"
  }

  const disconnectGoogleCalendar = async () => {
    if (!confirm("¿Desconectar Google Calendar?")) return
    try {
      const res = await fetch("/api/gmail/disconnect", {
        method: "POST",
        cache: "no-store",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.error || "No se pudo desconectar")
      }
      setGoogleCalendarStatus({ connected: false, has_google_connection: false, needs_reconnect: false })
      setGoogleCalendarEvents([])
      toast.success("Google Calendar desconectado")
    } catch (e: any) {
      toast.error("Error al desconectar Google Calendar: " + (e?.message || "Error desconocido"))
    }
  }

  const disconnectCalendly = async () => {
    if (!confirm("¿Desconectar Calendly?")) return
    try {
      const res = await fetch("/api/calendly/disconnect", {
        method: "POST",
        cache: "no-store",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "No se pudo desconectar Calendly")
      setCalendlyStatus({ connected: false })
      setCalendlyEvents([])
      toast.success("Calendly desconectado")
    } catch (e: any) {
      toast.error("Error al desconectar Calendly: " + (e?.message || "Error desconocido"))
    }
  }

  const disconnectCalCom = async () => {
    if (!confirm("¿Desconectar Cal.com?")) return
    try {
      const res = await fetch("/api/cal-com/disconnect", {
        method: "POST",
        cache: "no-store",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "No se pudo desconectar Cal.com")
      setCalComStatus({ connected: false })
      setCalComEvents([])
      toast.success("Cal.com desconectado")
    } catch (e: any) {
      toast.error("Error al desconectar Cal.com: " + (e?.message || "Error desconocido"))
    }
  }

  const syncCalComIntoTasks = async () => {
    if (!calComConnected) {
      toast.error("Conecta Cal.com primero")
      return
    }
    setSyncingCalComTasks(true)
    try {
      const res = await fetch("/api/cal-com/sync/tasks?max=50", {
        method: "POST",
        cache: "no-store",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.detail || json?.error || "No se pudo sincronizar a tareas")

      await Promise.all([fetchTasks(), fetchCalComEvents({ quiet: true })])
      toast.success(
        `Cal.com → Tareas listo: ${json?.created || 0} nuevas, ${json?.updated || 0} actualizadas, ${json?.canceled || 0} canceladas`
      )
    } catch (e: any) {
      toast.error("Error sincronizando Cal.com a tareas: " + (e?.message || "Error desconocido"))
    } finally {
      setSyncingCalComTasks(false)
    }
  }

  const syncCalendlyIntoTasks = async () => {
    if (!calendlyConnected) {
      toast.error("Conecta Calendly primero")
      return
    }
    setSyncingCalendlyTasks(true)
    try {
      const res = await fetch("/api/calendly/sync/tasks?max=50", {
        method: "POST",
        cache: "no-store",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.detail || json?.error || "No se pudo sincronizar a tareas")

      await Promise.all([fetchTasks(), fetchCalendlyEvents({ quiet: true })])
      toast.success(
        `Calendly → Tareas listo: ${json?.created || 0} nuevas, ${json?.updated || 0} actualizadas, ${json?.canceled || 0} canceladas`
      )
    } catch (e: any) {
      toast.error("Error sincronizando Calendly a tareas: " + (e?.message || "Error desconocido"))
    } finally {
      setSyncingCalendlyTasks(false)
    }
  }

  const googleCalendarConnected = !!googleCalendarStatus?.connected
  const googleConnectionNeedsReconnect = !!googleCalendarStatus?.needs_reconnect
  const nextGoogleEvent = googleCalendarEvents[0] || null
  const calendlyConnected = !!calendlyStatus?.connected
  const nextCalendlyEvent = calendlyEvents[0] || null
  const calComConnected = !!calComStatus?.connected
  const nextCalComEvent = calComEvents[0] || null

  const formatGoogleEventWhen = (event: GoogleCalendarEvent) => {
    const start = event.start?.dateTime || event.start?.date
    if (!start) return "Sin fecha"
    const dt = new Date(start)
    if (Number.isNaN(dt.getTime())) return "Sin fecha"
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      hour: event.start?.dateTime ? "2-digit" : undefined,
      minute: event.start?.dateTime ? "2-digit" : undefined,
    })
      .format(dt)
      .toUpperCase()
  }

  const formatCalendlyEventWhen = (event: CalendlyEvent) => {
    const start = event.start
    if (!start) return "Sin fecha"
    const dt = new Date(start)
    if (Number.isNaN(dt.getTime())) return "Sin fecha"
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(dt)
      .toUpperCase()
  }

  const isCalendlyCanceled = (event: CalendlyEvent) => String(event.status || "").toLowerCase() === "canceled"

  const formatCalComEventWhen = (event: CalComEvent) => {
    const start = event.start
    if (!start) return "Sin fecha"
    const dt = new Date(start)
    if (Number.isNaN(dt.getTime())) return "Sin fecha"
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(dt)
      .toUpperCase()
  }

  const isCalComCanceled = (event: CalComEvent) => {
    const status = String(event.status || "").toLowerCase()
    return status === "canceled" || status === "cancelled"
  }

  const selectedDayGoogleEvents = useMemo(() => {
    return googleCalendarEvents
      .filter((event) => {
        const start = event.start?.dateTime || event.start?.date
        if (!start) return false
        const dt = new Date(start)
        if (Number.isNaN(dt.getTime())) return false
        return sameDay(dt, selectedDate)
      })
      .sort((a, b) => {
        const aStart = new Date(a.start?.dateTime || a.start?.date || "").getTime()
        const bStart = new Date(b.start?.dateTime || b.start?.date || "").getTime()
        return aStart - bStart
      })
  }, [googleCalendarEvents, selectedDate])

  const selectedDayCalendlyEvents = useMemo(() => {
    return calendlyEvents
      .filter((event) => {
        if (!event.start) return false
        const dt = new Date(event.start)
        if (Number.isNaN(dt.getTime())) return false
        return sameDay(dt, selectedDate)
      })
      .sort((a, b) => {
        const aStart = new Date(a.start || "").getTime()
        const bStart = new Date(b.start || "").getTime()
        return aStart - bStart
      })
  }, [calendlyEvents, selectedDate])

  const selectedDayCalComEvents = useMemo(() => {
    return calComEvents
      .filter((event) => {
        if (!event.start) return false
        const dt = new Date(event.start)
        if (Number.isNaN(dt.getTime())) return false
        return sameDay(dt, selectedDate)
      })
      .sort((a, b) => {
        const aStart = new Date(a.start || "").getTime()
        const bStart = new Date(b.start || "").getTime()
        return aStart - bStart
      })
  }, [calComEvents, selectedDate])

  const renderTaskCard = (t: Task) => {
    const Icon = kindIcon(t.kind)
    const dt = new Date(t.due_at)
    const time = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`
    const related =
      t.entity_type === "customer"
        ? customers.find((c) => c.id === t.entity_id)
        : t.entity_type === "lead"
          ? leads.find((l) => l.id === t.entity_id)
          : null
    const relatedLabel = t.entity_type === "customer" ? "Cliente" : t.entity_type === "lead" ? "Prospecto" : null

    return (
      <div
        key={t.id}
        className={`relative overflow-hidden p-4 sm:p-5 rounded-[1.6rem] border transition-all ${
          t.status === "done"
            ? "bg-gray-50/70 border-gray-100 opacity-85"
            : "bg-white border-black/5 hover:border-(--accents)/30 hover:shadow-sm"
        }`}
      >
        <div className={`absolute left-0 top-0 h-full w-1.5 ${kindBar(t.kind)} ${t.status === "done" ? "opacity-40" : ""}`} />

        <div className="flex flex-col gap-3">
          <div className="min-w-0 w-full">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-black/50 bg-gray-50 border border-black/5 rounded-full px-2.5 py-1">
                <Clock size={11} className="opacity-60" /> {time}
              </span>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${kindPill(t.kind)}`}>
                {t.kind}
              </span>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${priorityPill(t.priority)}`}>
                {t.priority}
              </span>
            </div>

            <div className="mt-3 flex items-start gap-2 w-full">
              <div className={`p-2 rounded-xl border ${kindIconWrap(t.kind)}`}>
                <Icon size={15} />
              </div>
              <div className="min-w-0 w-full">
                <p
                  className={`w-full font-black text-black uppercase tracking-tight leading-tight whitespace-normal break-words ${
                    t.status === "done" ? "line-through" : ""
                  }`}
                >
                  {t.title}
                </p>
                {t.description ? (
                  <p className="text-[11px] font-bold text-black/50 mt-1.5 leading-relaxed line-clamp-1">{t.description}</p>
                ) : null}
              </div>
            </div>

            {related && relatedLabel ? (
              <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-black/45 flex items-center gap-2">
                {t.entity_type === "customer" ? <Users size={12} className="opacity-40" /> : <Target size={12} className="opacity-40" />}
                {relatedLabel}: <span className="text-black/70">{related.full_name}</span>
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2 self-end">
            <button
              onClick={() => toggleDone(t)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                t.status === "done" ? "bg-green-600 text-white hover:bg-green-700" : "bg-(--accents) text-white hover:bg-black"
              }`}
              title={t.status === "done" ? "Marcar como pendiente" : "Marcar como hecha"}
              aria-label={t.status === "done" ? "Marcar como pendiente" : "Completar tarea"}
            >
              <CheckCircle2 size={14} />
              {t.status === "done" ? "Hecha" : "Hecha?"}
            </button>
            <button
              onClick={() => openEditTask(t)}
              className="p-2.5 rounded-xl text-black/25 hover:text-black hover:bg-gray-50 transition-all"
              title="Editar"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-black/30" size={42} />
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 p-3 sm:p-4">
      <Toaster richColors position="top-center" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-black rounded-2xl shadow-xl">
              <CalendarDays className="text-(--accents)" size={26} />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-black tracking-tighter italic uppercase">Calendario.</h2>
          </div>
          <p className="text-black/50 font-bold text-[10px] uppercase tracking-[0.4em] ml-1">
            Tareas, llamadas, citas y seguimiento de tu cartera
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <div className="bg-white border border-black/5 rounded-[2rem] p-2 flex items-center gap-2 shadow-sm w-full md:w-auto overflow-x-auto flex-nowrap">
            {viewModes.map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-4 sm:px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border shrink-0 whitespace-nowrap ${
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
            className="bg-black text-white px-6 py-4 sm:px-10 sm:py-5 rounded-[2rem] font-black text-[11px] sm:text-sm flex items-center justify-center gap-3 hover:bg-(--accents) transition-all shadow-2xl active:scale-95 shrink-0 w-full sm:w-auto"
          >
            <Plus size={18} />
            <span className="sm:hidden">NUEVA</span>
            <span className="hidden sm:inline">NUEVA TAREA</span>
          </button>
        </div>
      </div>

      {/* INTEGRACIONES */}
      <div className="space-y-3">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Integraciones de calendario</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-[1.5rem] border border-black/5 shadow-sm flex flex-col gap-4 min-h-[280px]">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-16 w-16 rounded-2xl bg-[#f6f8ff] border border-black/5 flex items-center justify-center shrink-0 shadow-sm">
                <Image
                  src="/logo_integrations/google_calendar.png"
                  alt="Google Calendar"
                  width={86}
                  height={86}
                  className="h-62 w-62 object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-black uppercase tracking-widest truncate">Google Calendar</p>
                <p className="text-[10px] font-bold text-black/50 uppercase tracking-widest leading-relaxed">
                  {googleCalendarLoading
                    ? "Cargando..."
                    : googleCalendarConnected
                      ? `Conectado${googleCalendarStatus?.email ? ` · ${googleCalendarStatus.email}` : ""}`
                      : googleConnectionNeedsReconnect
                        ? "Falta permiso"
                        : "Sin conexión"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={connectGoogleCalendar}
                className="px-3 py-2.5 rounded-xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-(--accents) transition-all"
              >
                {googleCalendarConnected ? "Reautorizar" : "Conectar"}
              </button>
              {googleCalendarConnected ? (
                <button
                  onClick={disconnectGoogleCalendar}
                  className="px-3 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100 font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all"
                >
                  Desconectar
                </button>
              ) : null}
              <button
                onClick={() => fetchGoogleCalendarEvents()}
                disabled={!googleCalendarConnected || syncingGoogleCalendar || googleCalendarLoading}
                className={`px-3 py-2.5 rounded-xl bg-gray-50 text-black font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  googleCalendarConnected ? "col-span-2" : "col-span-1"
                }`}
              >
                {syncingGoogleCalendar ? <Loader2 className="animate-spin" size={13} /> : <RefreshCw size={13} />}
                Sync
              </button>
            </div>

            {!googleCalendarLoading && googleCalendarConnected && nextGoogleEvent ? (
              <a
                href={nextGoogleEvent.htmlLink || "#"}
                target={nextGoogleEvent.htmlLink ? "_blank" : undefined}
                rel={nextGoogleEvent.htmlLink ? "noreferrer" : undefined}
                className="block rounded-xl border border-black/5 px-3 py-2.5 hover:border-(--accents)/30 hover:bg-[#ece7e2]/30 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-[11px] text-black uppercase tracking-tight truncate">
                    Próximo: {nextGoogleEvent.summary || "Evento sin título"}
                  </p>
                  <span className="text-[10px] font-black uppercase tracking-widest text-black/40 shrink-0">
                    {formatGoogleEventWhen(nextGoogleEvent)}
                  </span>
                </div>
              </a>
            ) : null}

            {!googleCalendarLoading && !googleCalendarConnected ? (
              <div className="rounded-xl border border-dashed border-black/10 px-3 py-2.5 text-[11px] text-black/60 flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <p>
                  Conecta Google Calendar.
                  {googleConnectionNeedsReconnect ? " Falta autorizar permiso de Calendar." : ""}
                </p>
              </div>
            ) : null}
          </div>

          {/* <div className="bg-white p-4 rounded-[1.5rem] border border-black/5 shadow-sm flex flex-col gap-4 min-h-[280px]">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-16 w-16 rounded-2xl bg-white border border-black/5 flex items-center justify-center shrink-0 shadow-sm">
              <Image
                  src="/logo_integrations/cal_logo.png"
                  alt="Calendly"
                  width={306}
                  height={306}
                  className="h-62 w-62 object-contain"
                />
              </div>
              <div className="min-w-0">
             
                <p className="text-[10px] font-bold text-black/50 uppercase tracking-widest leading-relaxed">
                  {calComLoading
                    ? "Cargando..."
                    : calComConnected
                      ? `Conectado${calComStatus?.email ? ` · ${calComStatus.email}` : ""}`
                      : "Sin conexión"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={connectCalCom}
                className="px-3 py-2.5 rounded-xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-(--accents) transition-all"
              >
                {calComConnected ? "Reautorizar" : "Conectar"}
              </button>
              {calComConnected ? (
                <button
                  onClick={disconnectCalCom}
                  className="px-3 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100 font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all"
                >
                  Desconectar
                </button>
              ) : null}
              <button
                onClick={() => fetchCalComEvents()}
                disabled={!calComConnected || syncingCalCom || calComLoading}
                className={`px-3 py-2.5 rounded-xl bg-gray-50 text-black font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  calComConnected ? "col-span-2" : "col-span-1"
                }`}
              >
                {syncingCalCom ? <Loader2 className="animate-spin" size={13} /> : <RefreshCw size={13} />}
                Sync
              </button>
              <button
                onClick={syncCalComIntoTasks}
                disabled={!calComConnected || syncingCalComTasks || calComLoading}
                className="px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 col-span-2"
              >
                {syncingCalComTasks ? <Loader2 className="animate-spin" size={13} /> : <CalendarDays size={13} />}
                A tareas
              </button>
            </div>

            {!calComLoading && calComConnected && nextCalComEvent ? (
              <a
                href={nextCalComEvent.htmlLink || "#"}
                target={nextCalComEvent.htmlLink ? "_blank" : undefined}
                rel={nextCalComEvent.htmlLink ? "noreferrer" : undefined}
                className={`block rounded-xl px-3 py-2.5 ${
                  isCalComCanceled(nextCalComEvent) ? "border border-red-200 bg-red-50/60" : "border border-black/5"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-[11px] text-black uppercase tracking-tight truncate">
                    Próximo: {nextCalComEvent.summary || "Evento sin título"}
                  </p>
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${
                      isCalComCanceled(nextCalComEvent) ? "text-red-600" : "text-black/40"
                    }`}
                  >
                    {formatCalComEventWhen(nextCalComEvent)} {isCalComCanceled(nextCalComEvent) ? "· CANCELADO" : ""}
                  </span>
                </div>
              </a>
            ) : null}
          </div> */}

          <div className="bg-white p-4 rounded-[1.5rem] border border-black/5 shadow-sm flex flex-col gap-4 min-h-[280px]">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-16 w-16 rounded-2xl bg-white border border-black/5 flex items-center justify-center shrink-0 shadow-sm">
                <Image
                  src="/logo_integrations/calendly_logo.png"
                  alt="Calendly"
                  width={56}
                  height={56}
                  className="h-12 w-12 object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-black uppercase tracking-widest truncate">Calendly</p>
                <p className="text-[10px] font-bold text-black/50 uppercase tracking-widest leading-relaxed">
                  {calendlyLoading
                    ? "Cargando..."
                    : calendlyConnected
                      ? `Conectado${calendlyStatus?.email ? ` · ${calendlyStatus.email}` : ""}`
                      : "Sin conexión"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={connectCalendly}
                className="px-3 py-2.5 rounded-xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-(--accents) transition-all"
              >
                {calendlyConnected ? "Reautorizar" : "Conectar"}
              </button>
              {calendlyConnected ? (
                <button
                  onClick={disconnectCalendly}
                  className="px-3 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100 font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all"
                >
                  Desconectar
                </button>
              ) : null}
              <button
                onClick={() => fetchCalendlyEvents()}
                disabled={!calendlyConnected || syncingCalendly || calendlyLoading}
                className="px-3 py-2.5 rounded-xl bg-gray-50 text-black font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {syncingCalendly ? <Loader2 className="animate-spin" size={13} /> : <RefreshCw size={13} />}
                Sync
              </button>
              <button
                onClick={syncCalendlyIntoTasks}
                disabled={!calendlyConnected || syncingCalendlyTasks || calendlyLoading}
                className="px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {syncingCalendlyTasks ? <Loader2 className="animate-spin" size={13} /> : <CalendarDays size={13} />}
                A tareas
              </button>
            </div>

            {!calendlyLoading && calendlyConnected && nextCalendlyEvent ? (
              <div
                className={`block rounded-xl px-3 py-2.5 ${
                  isCalendlyCanceled(nextCalendlyEvent) ? "border border-red-200 bg-red-50/60" : "border border-black/5"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-[11px] text-black uppercase tracking-tight truncate">
                    Próximo: {nextCalendlyEvent.summary || "Evento sin título"}
                  </p>
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${
                      isCalendlyCanceled(nextCalendlyEvent) ? "text-red-600" : "text-black/40"
                    }`}
                  >
                    {formatCalendlyEventWhen(nextCalendlyEvent)} {isCalendlyCanceled(nextCalendlyEvent) ? "· CANCELADO" : ""}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
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

        <div className="flex gap-2 shrink-0 w-full md:w-auto overflow-x-auto flex-nowrap">
          {priorities.map((p) => (
            <button
              key={p}
              onClick={() => setPriorityTab(p)}
              className={`px-4 sm:px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border shrink-0 whitespace-nowrap ${
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
          className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border shrink-0 w-full md:w-auto ${
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
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mes</p>
              <h3 className="text-2xl font-black text-black italic">{monthLabel}</h3>
              <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest mt-1">
                {storageMode === "supabase" ? "Sync con Supabase" : "Modo local (este dispositivo)"}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-50 border border-black/5 text-[10px] font-black uppercase tracking-widest text-black/60">
                  <span className="w-2 h-2 rounded-full bg-(--accents)" /> Pendientes
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-50 border border-black/5 text-[10px] font-black uppercase tracking-widest text-black/60">
                  <span className="w-2 h-2 rounded-full bg-green-600" /> Hechas
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-50 border border-black/5 text-[10px] font-black uppercase tracking-widest text-black/60">
                  <span className="w-2 h-2 rounded-full bg-red-600" /> Alta
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <button
                onClick={() => setMonthCursor((d) => addMonths(d, -1))}
                className="p-3 rounded-2xl bg-gray-50 text-black hover:bg-black hover:text-white transition-all shrink-0"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => {
                  setMonthCursor(startOfMonth(new Date()))
                  setSelectedDate(new Date())
                }}
                className="px-5 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-(--accents) transition-all shrink-0"
              >
                Hoy
              </button>
              <button
                onClick={() => setMonthCursor((d) => addMonths(d, 1))}
                className="p-3 rounded-2xl bg-gray-50 text-black hover:bg-black hover:text-white transition-all shrink-0"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            </div>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
            {weekdayLabels.map((w, i) => (
              <div key={i} className="text-center text-[10px] font-black uppercase tracking-widest text-black/30 py-2">
                {w}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {monthGrid.map(({ date, inMonth }) => {
              const key = dayKey(date)
              const list = tasksByDay.get(key) || []
              const openCount = list.filter((t) => t.status !== "done").length
              const highCount = list.filter((t) => t.status !== "done" && t.priority === "Alta").length
              const doneCount = list.filter((t) => t.status === "done").length
              const googleExternalCount = googleEventsByDayCounts.get(key) || 0
              const calendlyExternalCount = calendlyEventsByDayCounts.get(key) || 0
              const calComExternalCount = calComEventsByDayCounts.get(key) || 0
              const externalCount = googleExternalCount + calendlyExternalCount + calComExternalCount
              const selected = sameDay(date, selectedDate)
              const totalCount = openCount + doneCount
              const pendingCount = openCount + externalCount
              const hasPending = pendingCount > 0
              const hasAny = totalCount > 0 || externalCount > 0
              const stackOpenPct = totalCount > 0 ? Math.round((openCount / totalCount) * 100) : 0
              const stackDonePct = totalCount > 0 ? 100 - stackOpenPct : 0

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDateAndSync(date)}
                  className={`relative overflow-hidden text-left p-2 sm:p-3 rounded-2xl border transition-all h-[78px] sm:h-[92px] ${
                    selected
                      ? "bg-black text-white border-black shadow-lg"
                      : hasAny
                        ? "bg-white border-black/5 hover:bg-[#ece7e2]/30"
                        : "bg-white border-black/5 hover:bg-[#ece7e2]/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`text-[13px] sm:text-sm font-black ${
                        inMonth ? (selected ? "text-white" : "text-black") : selected ? "text-white/70" : "text-black/35"
                      }`}
                    >
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

                  <div className="mt-2.5 space-y-1.5">
                    <div
                      className={`inline-flex items-center px-2 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${
                        hasPending
                          ? selected
                            ? "bg-white/15 text-white"
                            : "bg-black text-white"
                          : selected
                            ? "bg-green-300 text-black"
                            : "bg-green-100 text-green-800"
                      }`}
                      title={`Pendientes: ${pendingCount} · Internas: ${openCount} · Google: ${googleExternalCount} · Calendly: ${calendlyExternalCount} · Cal.com: ${calComExternalCount} · Hechas: ${doneCount} · Alta: ${highCount}`}
                    >
                      {hasPending ? `${pendingCount} EVENTO${pendingCount === 1 ? "" : "S"}` : "SIN EVENTOS"}
                    </div>

                    {hasAny ? (
                      <div className={`text-[9px] font-black uppercase tracking-widest ${selected ? "text-white/70" : "text-black/40"}`}>
                        A{openCount} · G{googleExternalCount} · C{calendlyExternalCount} · Co{calComExternalCount}
                        {doneCount > 0 ? ` · H${doneCount}` : ""}
                      </div>
                    ) : null}

                    {totalCount > 0 ? (
                      <div className={`h-1.5 rounded-full overflow-hidden ${selected ? "bg-white/10" : "bg-black/5"}`}>
                        <div className="h-full flex">
                          <div className={`${selected ? "bg-white/60" : "bg-(--accents)"} h-full`} style={{ width: `${stackOpenPct}%` }} />
                          <div className={`${selected ? "bg-green-300" : "bg-green-600"} h-full`} style={{ width: `${stackDonePct}%` }} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* LISTA DEL DÍA */}
        <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-4 sm:p-6 lg:p-8 flex flex-col">
          <div className="mb-6">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Agenda</p>
            <h3 className="text-2xl font-black text-black italic">{selectedDateLabel}</h3>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-1">
            {selectedDayGoogleEvents.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                    Google Calendar ({selectedDayGoogleEvents.length})
                  </p>
                  <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/40">
                    <span className="w-2 h-2 rounded-full bg-blue-600" /> Externo
                  </span>
                </div>
                {selectedDayGoogleEvents.map((event) => (
                  <div key={`gcal-${event.id}`} className="rounded-[1.4rem] border border-blue-100 bg-blue-50/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-black uppercase tracking-tight truncate">{event.summary || "Evento de Google"}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/45 mt-1">
                          {formatGoogleEventWhen(event)} · {event.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {event.hangoutLink ? (
                          <a
                            href={event.hangoutLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white transition-all"
                          >
                            <Video size={12} />
                            Meet
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {selectedDayCalendlyEvents.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                    Calendly ({selectedDayCalendlyEvents.length})
                  </p>
                  <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/40">
                    <span className="w-2 h-2 rounded-full bg-[#06a763]" /> Externo
                  </span>
                </div>
                {selectedDayCalendlyEvents.map((event) => (
                  <div
                    key={`calendly-${event.id}`}
                    className={`rounded-[1.4rem] p-4 ${
                      isCalendlyCanceled(event) ? "border border-red-200 bg-red-50/60" : "border border-emerald-100 bg-emerald-50/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-black uppercase tracking-tight truncate">{event.summary || "Evento de Calendly"}</p>
                        <p
                          className={`text-[10px] font-black uppercase tracking-widest mt-1 ${
                            isCalendlyCanceled(event) ? "text-red-600" : "text-black/45"
                          }`}
                        >
                          {formatCalendlyEventWhen(event)} · {event.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {event.location?.join_url ? (
                          <a
                            href={event.location.join_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              isCalendlyCanceled(event)
                                ? "bg-white border border-red-200 text-red-700 hover:bg-red-600 hover:text-white"
                                : "bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                            }`}
                          >
                            <Video size={12} />
                            Join
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {selectedDayCalComEvents.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                    Cal.com ({selectedDayCalComEvents.length})
                  </p>
                  <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/40">
                    <span className="w-2 h-2 rounded-full bg-[#f97316]" /> Externo
                  </span>
                </div>
                {selectedDayCalComEvents.map((event) => (
                  <div
                    key={`calcom-${event.id}`}
                    className={`rounded-[1.4rem] p-4 ${
                      isCalComCanceled(event) ? "border border-red-200 bg-red-50/60" : "border border-orange-100 bg-orange-50/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-black uppercase tracking-tight truncate">{event.summary || "Evento de Cal.com"}</p>
                        <p
                          className={`text-[10px] font-black uppercase tracking-widest mt-1 ${
                            isCalComCanceled(event) ? "text-red-600" : "text-black/45"
                          }`}
                        >
                          {formatCalComEventWhen(event)} · {event.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {event.htmlLink ? (
                          <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              isCalComCanceled(event)
                                ? "bg-white border border-red-200 text-red-700 hover:bg-red-600 hover:text-white"
                                : "bg-white border border-orange-200 text-orange-700 hover:bg-orange-500 hover:text-white"
                            }`}
                          >
                            <ExternalLink size={12} />
                            Abrir
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {selectedDayTasks.length === 0 &&
            selectedDayGoogleEvents.length === 0 &&
            selectedDayCalendlyEvents.length === 0 &&
            selectedDayCalComEvents.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 py-14">
                <CalendarDays size={44} className="text-gray-100 mb-4" />
                <p className="font-bold text-black">Sin eventos ni tareas para este día</p>
                {!showDone && selectedDayAllCounts.done > 0 ? (
                  <p className="text-[11px] font-black text-black/40 mt-2">
                    Hay <span className="text-green-700">{selectedDayAllCounts.done}</span> hecha{selectedDayAllCounts.done === 1 ? "" : "s"} (activa “Mostrar hechas”).
                  </p>
                ) : null}
                <button
                  onClick={openNewTask}
                  className="mt-6 px-6 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-(--accents) transition-all"
                >
                  + Crear tarea
                </button>
              </div>
            ) : (
              <>
                {selectedDayPendingTasks.length > 0 ? (
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                      Pendientes ({selectedDayPendingTasks.length})
                    </p>
                    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/40">
                      <span className="w-2 h-2 rounded-full bg-(--accents)" /> Acción
                    </span>
                  </div>
                ) : null}

                {selectedDayPendingTasks.map((t) => renderTaskCard(t))}

                {showDone && selectedDayDoneTasks.length > 0 ? (
                  <div className="pt-4 mt-2 border-t border-black/5">
                    <div className="flex items-center justify-between px-1 mb-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                        Hechas ({selectedDayDoneTasks.length})
                      </p>
                      <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/40">
                        <span className="w-2 h-2 rounded-full bg-green-600" /> Completado
                      </span>
                    </div>
                    <div className="space-y-4">
                      {selectedDayDoneTasks.map((t) => renderTaskCard(t))}
                    </div>
                  </div>
                ) : null}
              </>
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
          <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-4 sm:p-6 lg:p-8 flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Día</p>
                <h3 className="text-2xl font-black text-black italic">{selectedDateLabel}</h3>
                <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest mt-1">
                  {storageMode === "supabase" ? "Sync con Supabase" : "Modo local (este dispositivo)"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-start">
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
                  className="bg-[#ece7e2]/50 border border-black/5 rounded-2xl px-4 py-3 text-[11px] font-black text-black outline-none w-full sm:w-auto"
                />
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-1">
              {selectedDayGoogleEvents.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                      Google Calendar ({selectedDayGoogleEvents.length})
                    </p>
                    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/40">
                      <span className="w-2 h-2 rounded-full bg-blue-600" /> Externo
                    </span>
                  </div>
                  {selectedDayGoogleEvents.map((event) => (
                    <div key={`gcal-day-${event.id}`} className="rounded-[1.4rem] border border-blue-100 bg-blue-50/50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-black text-black uppercase tracking-tight truncate">{event.summary || "Evento de Google"}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-black/45 mt-1">
                            {formatGoogleEventWhen(event)} · {event.status}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {event.hangoutLink ? (
                            <a
                              href={event.hangoutLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white transition-all"
                            >
                              <Video size={12} />
                              Meet
                            </a>
                          ) : null}
                          {event.htmlLink ? (
                            <a
                              href={event.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-black/10 text-black/70 hover:bg-black hover:text-white transition-all"
                            >
                              <ExternalLink size={12} />
                              Abrir
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {selectedDayCalendlyEvents.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                      Calendly ({selectedDayCalendlyEvents.length})
                    </p>
                    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/40">
                      <span className="w-2 h-2 rounded-full bg-[#06a763]" /> Externo
                    </span>
                  </div>
                  {selectedDayCalendlyEvents.map((event) => (
                    <div
                      key={`calendly-day-${event.id}`}
                      className={`rounded-[1.4rem] p-4 ${
                        isCalendlyCanceled(event) ? "border border-red-200 bg-red-50/60" : "border border-emerald-100 bg-emerald-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-black text-black uppercase tracking-tight truncate">{event.summary || "Evento de Calendly"}</p>
                          <p
                            className={`text-[10px] font-black uppercase tracking-widest mt-1 ${
                              isCalendlyCanceled(event) ? "text-red-600" : "text-black/45"
                            }`}
                          >
                            {formatCalendlyEventWhen(event)} · {event.status}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {event.location?.join_url ? (
                            <a
                              href={event.location.join_url}
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                isCalendlyCanceled(event)
                                  ? "bg-white border border-red-200 text-red-700 hover:bg-red-600 hover:text-white"
                                  : "bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                              }`}
                            >
                              <Video size={12} />
                              Join
                            </a>
                          ) : null}
                          {event.htmlLink ? (
                            <a
                              href={event.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-black/10 text-black/70 hover:bg-black hover:text-white transition-all"
                            >
                              <ExternalLink size={12} />
                              Abrir
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {selectedDayCalComEvents.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                      Cal.com ({selectedDayCalComEvents.length})
                    </p>
                    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/40">
                      <span className="w-2 h-2 rounded-full bg-[#f97316]" /> Externo
                    </span>
                  </div>
                  {selectedDayCalComEvents.map((event) => (
                    <div
                      key={`calcom-day-${event.id}`}
                      className={`rounded-[1.4rem] p-4 ${
                        isCalComCanceled(event) ? "border border-red-200 bg-red-50/60" : "border border-orange-100 bg-orange-50/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-black text-black uppercase tracking-tight truncate">{event.summary || "Evento de Cal.com"}</p>
                          <p
                            className={`text-[10px] font-black uppercase tracking-widest mt-1 ${
                              isCalComCanceled(event) ? "text-red-600" : "text-black/45"
                            }`}
                          >
                            {formatCalComEventWhen(event)} · {event.status}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {event.htmlLink ? (
                            <a
                              href={event.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                isCalComCanceled(event)
                                  ? "bg-white border border-red-200 text-red-700 hover:bg-red-600 hover:text-white"
                                  : "bg-white border border-orange-200 text-orange-700 hover:bg-orange-500 hover:text-white"
                              }`}
                            >
                              <ExternalLink size={12} />
                              Abrir
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {selectedDayTasks.length === 0 &&
              selectedDayGoogleEvents.length === 0 &&
              selectedDayCalendlyEvents.length === 0 &&
              selectedDayCalComEvents.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 py-14">
                  <CalendarDays size={44} className="text-gray-100 mb-4" />
                  <p className="font-bold text-black">Sin eventos ni tareas para este día</p>
                  {!showDone && selectedDayAllCounts.done > 0 ? (
                    <p className="text-[11px] font-black text-black/40 mt-2">
                      Hay <span className="text-green-700">{selectedDayAllCounts.done}</span> hecha{selectedDayAllCounts.done === 1 ? "" : "s"} (activa “Mostrar hechas”).
                    </p>
                  ) : null}
                  <button
                    onClick={openNewTask}
                    className="mt-6 px-6 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-(--accents) transition-all"
                  >
                    + Crear tarea
                  </button>
                </div>
              ) : (
                <>
                  {selectedDayPendingTasks.length > 0 ? (
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                        Pendientes ({selectedDayPendingTasks.length})
                      </p>
                      <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/40">
                        <span className="w-2 h-2 rounded-full bg-(--accents)" /> Acción
                      </span>
                    </div>
                  ) : null}

                  {selectedDayPendingTasks.map((t) => renderTaskCard(t))}

                  {showDone && selectedDayDoneTasks.length > 0 ? (
                    <div className="pt-4 mt-2 border-t border-black/5">
                      <div className="flex items-center justify-between px-1 mb-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                          Hechas ({selectedDayDoneTasks.length})
                        </p>
                        <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/40">
                          <span className="w-2 h-2 rounded-full bg-green-600" /> Completado
                        </span>
                      </div>
                      <div className="space-y-4">
                        {selectedDayDoneTasks.map((t) => renderTaskCard(t))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* PRÓXIMOS */}
          <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-4 sm:p-6 lg:p-8 flex flex-col">
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
                      className="relative overflow-hidden w-full text-left p-5 rounded-[2rem] border border-black/5 hover:border-(--accents)/30 hover:bg-[#ece7e2]/30 transition-all"
                    >
                      <div className={`absolute left-0 top-0 h-full w-1.5 ${kindBar(t.kind)}`} />
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-2xl border ${kindIconWrap(t.kind)}`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-black uppercase tracking-tighter truncate">{t.title}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-black/40">{when}</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${kindPill(t.kind)}`}>
                              {t.kind}
                            </span>
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
        <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Año</p>
              <h3 className="text-2xl font-black text-black italic">{yearLabel}</h3>
              <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest mt-1">
                {storageMode === "supabase" ? "" : "Modo local (este dispositivo)"}
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
              const external = externalEventsByMonth.get(monthKey) || { google: 0, calendly: 0, calcom: 0, total: 0 }
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
                    {external.total > 0 ? (
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">
                        · ext {external.total}
                      </span>
                    ) : null}
                  </div>

                  {external.total > 0 ? (
                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-black/40">
                      G{external.google} · C{external.calendly} · Co{external.calcom}
                    </p>
                  ) : null}

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
              className="fixed right-0 top-0 h-screen w-full sm:max-w-xl bg-[#ece7e2] z-50 flex flex-col shadow-2xl"
            >
              <div className="p-5 sm:p-10 bg-white flex justify-between items-center border-b-4 border-black/5 sticky top-0 z-10">
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

              <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-5 sm:p-10 space-y-8 custom-scrollbar">
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
                      className="w-full bg-[#ece7e2] text-black font-black py-5 px-6 rounded-2xl outline-none focus:ring-2 focus:ring-black text-base sm:text-lg uppercase"
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

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block">
                      Sync con Google Calendar
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, sync_google: true }))}
                        disabled={!googleCalendarConnected}
                        className={`px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                          form.sync_google
                            ? "bg-black text-white border-black shadow-lg"
                            : "bg-white text-black/40 border-black/5 hover:bg-gray-50"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        Sí sincronizar
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, sync_google: false }))}
                        className={`px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                          !form.sync_google
                            ? "bg-black text-white border-black shadow-lg"
                            : "bg-white text-black/40 border-black/5 hover:bg-gray-50"
                        }`}
                      >
                        No sincronizar
                      </button>
                    </div>
                    <p className="text-[11px] font-bold text-black/40">
                      {googleCalendarConnected
                        ? "Elige si esta tarea se refleja en Google Calendar."
                        : "Conecta Google Calendar para poder sincronizar tareas."}
                    </p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 pt-4 pb-8 sticky bottom-0 bg-[#ece7e2] border-t border-black/5 -mx-5 sm:-mx-10 px-5 sm:px-10">
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
                      className="w-full py-5 sm:py-6 rounded-3xl font-black text-sm transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white"
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
                    className="w-full py-5 sm:py-6 rounded-3xl font-black text-sm transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95 bg-black text-white hover:bg-(--accents)"
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

