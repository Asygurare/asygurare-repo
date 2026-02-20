"use client"

import { useEffect, useMemo, useState } from "react"
import { Bell, CalendarClock, Cake, Loader2, Save, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

type Automation = {
  key: string
  enabled: boolean
  config?: { days_before?: number; timezone?: string; template_id?: string }
}

type AutomationLog = {
  id: string
  automation_key: string
  target_table: string
  status: "ok" | "skipped" | "error"
  message: string | null
  run_date: string
  created_at: string
}

type EmailTemplate = {
  id: string
  name: string
  subject: string
}

const LABELS: Record<string, string> = {
  birthday_prospects_email: "Enviar correos a prospectos en sus cumpleaños",
  birthday_customers_email: "Enviar correos a clientes en sus cumpleaños",
  policy_renewal_notice_email: "Avisar renovaciones de póliza por correo",
  birthday_prospects_notify: "Notificar cumpleaños de prospectos",
  birthday_customers_notify: "Notificar cumpleaños de clientes",
  policy_renewal_notice_notify: "Notificar vencimientos de póliza",
}

export default function AutomatizarClient() {
  const [tab, setTab] = useState<"automations" | "notifications">("automations")
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [automations, setAutomations] = useState<Automation[]>([])
  const [logs, setLogs] = useState<AutomationLog[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [daysBefore, setDaysBefore] = useState(30)
  const [birthdayProspectsTemplateId, setBirthdayProspectsTemplateId] = useState("")
  const [birthdayCustomersTemplateId, setBirthdayCustomersTemplateId] = useState("")
  const [renewalTemplateId, setRenewalTemplateId] = useState("")

  const renewalEmail = useMemo(
    () => automations.find((item) => item.key === "policy_renewal_notice_email"),
    [automations],
  )
  const renewalNotify = useMemo(
    () => automations.find((item) => item.key === "policy_renewal_notice_notify"),
    [automations],
  )
  const birthdayProspectsEmail = useMemo(
    () => automations.find((item) => item.key === "birthday_prospects_email"),
    [automations],
  )
  const birthdayCustomersEmail = useMemo(
    () => automations.find((item) => item.key === "birthday_customers_email"),
    [automations],
  )

  const fetchAutomations = async () => {
    const res = await fetch("/api/automations", { cache: "no-store" })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error || "No se pudieron cargar automatizaciones")
    const rows = (json?.automations as Automation[]) || []
    setAutomations(rows)

    const policyDays =
      Number(rows.find((x) => x.key === "policy_renewal_notice_email")?.config?.days_before) ||
      Number(rows.find((x) => x.key === "policy_renewal_notice_notify")?.config?.days_before) ||
      30
    setDaysBefore(policyDays)
    setBirthdayProspectsTemplateId(String(rows.find((x) => x.key === "birthday_prospects_email")?.config?.template_id || ""))
    setBirthdayCustomersTemplateId(String(rows.find((x) => x.key === "birthday_customers_email")?.config?.template_id || ""))
    setRenewalTemplateId(String(rows.find((x) => x.key === "policy_renewal_notice_email")?.config?.template_id || ""))
  }

  const fetchTemplates = async () => {
    const res = await fetch("/api/gmail/templates", { cache: "no-store" })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error || "No se pudieron cargar plantillas")
    setTemplates((json?.templates as EmailTemplate[]) || [])
  }

  const fetchLogs = async () => {
    const res = await fetch("/api/automations/logs?limit=200", { cache: "no-store" })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error || "No se pudieron cargar notificaciones")
    setLogs((json?.logs as AutomationLog[]) || [])
  }

  const refreshAll = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchAutomations(), fetchLogs(), fetchTemplates()])
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar datos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshAll()
  }, [])

  const updateAutomation = async (
    key: string,
    enabled: boolean,
    config?: Record<string, unknown>,
    showToast = true,
  ) => {
    setSavingKey(key)
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled, config: config || {} }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "No se pudo guardar")
      setAutomations((prev) =>
        prev.map((item) => (item.key === key ? { ...item, enabled, config: (config as any) || item.config } : item)),
      )
      if (showToast) {
        toast.success(`${enabled ? "Activada" : "Desactivada"}: ${LABELS[key] || key}`)
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar automatización")
    } finally {
      setSavingKey(null)
    }
  }

  const saveRenewalDays = async () => {
    const safeDays = Math.max(1, Math.min(120, Number(daysBefore || 30)))
    await Promise.all([
      updateAutomation("policy_renewal_notice_email", renewalEmail?.enabled === true, { days_before: safeDays }, false),
      updateAutomation("policy_renewal_notice_notify", renewalNotify?.enabled === true, { days_before: safeDays }, false),
    ])
    toast.success(`Avisos de renovación configurados a ${safeDays} días`)
  }

  const saveTemplateFor = async (key: string, templateId: string) => {
    const row = automations.find((item) => item.key === key)
    await updateAutomation(key, row?.enabled === true, {
      ...(row?.config || {}),
      template_id: templateId || null,
      ...(key.includes("renewal") ? { days_before: daysBefore } : {}),
    }, false)
    toast.success("Plantilla guardada")
  }

  const renderSwitch = (key: string) => {
    const row = automations.find((item) => item.key === key)
    const enabled = row?.enabled === true
    return (
      <button
        type="button"
        onClick={() => updateAutomation(key, !enabled, row?.config || {})}
        disabled={savingKey === key}
        className={`relative w-14 h-8 rounded-full transition-all ${enabled ? "bg-(--accents)" : "bg-black/15"}`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${enabled ? "left-7" : "left-1"}`}
        />
      </button>
    )
  }

  return (
    <div className="space-y-8">
      <div className="bg-white border border-black/5 rounded-[2rem] p-6 sm:p-8">
        <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tight text-black">Automatizar</h1>
      </div>

      <div className="bg-white border border-black/5 rounded-[2rem] p-3 flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => setTab("automations")}
          className={`w-full sm:w-auto px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition ${
            tab === "automations" ? "bg-black text-white" : "text-black/50 hover:bg-black/5"
          }`}
        >
          Automatizaciones
        </button>
        <button
          type="button"
          onClick={() => setTab("notifications")}
          className={`w-full sm:w-auto px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition ${
            tab === "notifications" ? "bg-black text-white" : "text-black/50 hover:bg-black/5"
          }`}
        >
          Mis notificaciones
        </button>
      </div>

      {loading ? (
        <div className="bg-white border border-black/5 rounded-[2rem] p-10 flex items-center gap-3">
          <Loader2 size={18} className="animate-spin" />
          <p className="text-sm font-bold">Cargando datos...</p>
        </div>
      ) : null}

      {!loading && tab === "automations" ? (
        <div className="space-y-4">
          <div className="bg-white border border-black/5 rounded-[2rem] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 w-full">
              <Cake className="mt-1 text-(--accents)" size={18} />
              <div>
                <p className="text-sm font-black  text-black">{LABELS.birthday_prospects_email}</p>
                <p className="text-xs text-black/50">Envía correo automático en la fecha de cumpleaños.</p>
              </div>
            </div>
            {renderSwitch("birthday_prospects_email")}
          </div>
          <div className="rounded-xl bg-[#f8f6f4] p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <label className="text-xs font-bold text-black/60">Plantilla para cumpleaños de prospectos</label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <select
                value={birthdayProspectsTemplateId}
                onChange={(e) => setBirthdayProspectsTemplateId(e.target.value)}
                className="w-full sm:w-auto sm:min-w-[220px] rounded-lg border border-black/10 bg-white px-2 text-black py-2 text-xs font-bold"
              >
                <option value="">Sin plantilla (texto por defecto)</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => saveTemplateFor("birthday_prospects_email", birthdayProspectsTemplateId)}
                className="w-full sm:w-auto px-3 py-2 rounded-lg bg-black text-white text-[11px] font-black uppercase tracking-wide"
              >
                Guardar
              </button>
            </div>
          </div>

          <div className="bg-white border border-black/5 rounded-[2rem] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 w-full">
              <Cake className="mt-1 text-(--accents)" size={18} />
              <div>
                <p className="text-sm font-black  text-black">{LABELS.birthday_customers_email}</p>
                <p className="text-xs text-black/50">Envía correo automático en la fecha de cumpleaños.</p>
              </div>
            </div>
            {renderSwitch("birthday_customers_email")}
          </div>
          <div className="rounded-xl bg-[#f8f6f4] p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <label className="text-xs font-bold text-black/60">Plantilla para cumpleaños de clientes</label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <select
                value={birthdayCustomersTemplateId}
                onChange={(e) => setBirthdayCustomersTemplateId(e.target.value)}
                className="w-full sm:w-auto sm:min-w-[220px] text-black rounded-lg border border-black/10 bg-white px-2 py-2 text-xs font-bold"
              >
                <option value="">Sin plantilla (texto por defecto)</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => saveTemplateFor("birthday_customers_email", birthdayCustomersTemplateId)}
                className="w-full sm:w-auto px-3 py-2 rounded-lg bg-black text-white text-[11px] font-black uppercase tracking-wide"
              >
                Guardar
              </button>
            </div>
          </div>

          <div className="bg-white border border-black/5 rounded-[2rem] p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3 w-full">
                <CalendarClock className="mt-1 text-(--accents)" size={18} />
                <div>
                  <p className="text-sm font-black  text-black">{LABELS.policy_renewal_notice_email}</p>
                  <p className="text-xs text-black/50">Recordatorio automático antes del vencimiento de pólizas.</p>
                </div>
              </div>
              {renderSwitch("policy_renewal_notice_email")}
            </div>

            <div className="rounded-xl bg-[#f8f6f4] p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <label className="text-xs font-bold text-black">Avisar con cuántos días de anticipación</label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={daysBefore}
                  onChange={(e) => setDaysBefore(Number(e.target.value || 30))}
                  className="w-20 rounded-lg  text-black border border-black/10 bg-white px-2 py-1 text-sm font-bold"
                />
                <button
                  type="button"
                  onClick={saveRenewalDays}
                  className="w-full sm:w-auto px-3 py-2 rounded-lg bg-black text-white text-[11px] font-black uppercase tracking-wide flex items-center justify-center gap-1"
                >
                  <Save size={12} /> Guardar
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-[#f8f6f4] p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <label className="text-xs font-bold text-black/60">Plantilla para aviso de renovación</label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <select
                  value={renewalTemplateId}
                  onChange={(e) => setRenewalTemplateId(e.target.value)}
                  className="w-full sm:w-auto sm:min-w-[220px] text-black rounded-lg border border-black/10 bg-white px-2 py-2 text-xs font-bold"
                >
                  <option value="">Sin plantilla (texto por defecto)</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => saveTemplateFor("policy_renewal_notice_email", renewalTemplateId)}
                  className="w-full sm:w-auto px-3 py-2 rounded-lg bg-black text-white text-[11px] font-black uppercase tracking-wide"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>

        </div>
      ) : null}

      {!loading && tab === "notifications" ? (
        <div className="space-y-4">
          <div className="bg-white border border-black/5 rounded-[2rem] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 w-full">
              <Bell className="mt-1 text-(--accents)" size={18} />
              <div>
                <p className="text-sm font-black text-black">{LABELS.birthday_prospects_notify}</p>
                <p className="text-xs text-black/50">Genera notificación interna cuando aplica la regla.</p>
              </div>
            </div>
            {renderSwitch("birthday_prospects_notify")}
          </div>

          <div className="bg-white border border-black/5 rounded-[2rem] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 w-full">
              <Bell className="mt-1 text-(--accents)" size={18} />
              <div>
                <p className="text-sm font-black text-black">{LABELS.birthday_customers_notify}</p>
                <p className="text-xs text-black/50">Genera notificación interna cuando aplica la regla.</p>
              </div>
            </div>
            {renderSwitch("birthday_customers_notify")}
          </div>

          <div className="bg-white border border-black/5 rounded-[2rem] p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3 w-full">
                <ShieldAlert className="mt-1 text-(--accents)" size={18} />
                <div>
                  <p className="text-sm font-black text-black">{LABELS.policy_renewal_notice_notify}</p>
                  <p className="text-xs text-black/50">Notificación interna de vencimientos próximos.</p>
                </div>
              </div>
              {renderSwitch("policy_renewal_notice_notify")}
            </div>

            <div className="rounded-xl bg-[#f8f6f4] p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <label className="text-xs font-bold text-black">Avisar con cuántos días de anticipación</label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={daysBefore}
                  onChange={(e) => setDaysBefore(Number(e.target.value || 30))}
                  className="w-20 rounded-lg text-black border border-black/10 bg-white px-2 py-1 text-sm font-bold"
                />
                <button
                  type="button"
                  onClick={saveRenewalDays}
                  className="w-full sm:w-auto px-3 py-2 rounded-lg bg-black text-white text-[11px] font-black uppercase tracking-wide flex items-center justify-center gap-1"
                >
                  <Save size={12} /> Guardar
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-black/5 rounded-[2rem] p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <p className="text-sm font-black uppercase tracking-widest text-black/50">Historial de notificaciones</p>
            <button
              type="button"
              onClick={fetchLogs}
              className="px-3 py-2 rounded-lg bg-black text-white text-[11px] font-black uppercase tracking-wide"
            >
              Recargar
            </button>
          </div>

          {logs.length === 0 ? (
            <p className="text-sm text-black/50">Aún no hay notificaciones registradas.</p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
              {logs.map((log) => (
                <div key={log.id} className="border border-black/5 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-wide text-black">{LABELS[log.automation_key] || log.automation_key}</p>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                        log.status === "ok"
                          ? "bg-green-100 text-green-800"
                          : log.status === "skipped"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <p className="text-xs text-black/70 mt-1">{log.message || "Sin mensaje"}</p>
                  <p className="text-[10px] text-black/40 mt-1">
                    {new Date(log.created_at).toLocaleString("es-MX")} · run_date {log.run_date}
                  </p>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
