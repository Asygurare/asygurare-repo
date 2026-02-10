"use client"

import React, { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Cpu,
  Mail,
  Link2Off,
  RefreshCw,
  Send,
  Sparkles,
  Check,
  Search,
  Inbox,
} from "lucide-react"

type GmailStatus =
  | { connected: false; error?: string }
  | {
      connected: true
      email: string | null
      scope: string | null
      updated_at: string | null
      created_at: string | null
    }

export default function AutomatizacionesClient({
  banner,
  reason,
}: {
  banner: string | null
  reason: string | null
}) {
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [status, setStatus] = useState<GmailStatus>({ connected: false })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string>("")
  const [sending, setSending] = useState(false)
  const [bulkSending, setBulkSending] = useState(false)
  const [sendTo, setSendTo] = useState("")
  const [sendSubject, setSendSubject] = useState("")
  const [sendBody, setSendBody] = useState("")
  const [sendResult, setSendResult] = useState("")
  const [draftInstructions, setDraftInstructions] = useState(
    "Redacta un correo breve para mantener una comunicación adecuada y cordial con mi cliente."
  )
  const [drafting, setDrafting] = useState(false)
  const [draftResult, setDraftResult] = useState("")
  const [audience, setAudience] = useState<"prospectos" | "clientes">("prospectos")
  const [bulkResult, setBulkResult] = useState("")
  const [tab, setTab] = useState<"redactor" | "enviados">("redactor")

  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactsError, setContactsError] = useState<string>("")
  const [contacts, setContacts] = useState<Array<{ id: string; name?: string | null; last_name?: string | null; email?: string | null }>>([])
  const [contactQuery, setContactQuery] = useState("")
  const [selectedEmails, setSelectedEmails] = useState<Record<string, true>>({})

  const [sentLoading, setSentLoading] = useState(false)
  const [sentError, setSentError] = useState("")
  const [sent, setSent] = useState<Array<{ id: string; to_email: string; subject: string | null; audience: string | null; gmail_message_id: string | null; created_at: string }>>([])
  const hasSendScope =
    status.connected && typeof status.scope === "string"
      ? status.scope.includes("gmail.send")
      : false

  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase()
    const base = contacts.filter((c) => !!c.email)
    if (!q) return base
    return base.filter((c) => {
      const name = `${c.name ?? ""} ${c.last_name ?? ""}`.trim().toLowerCase()
      const email = String(c.email ?? "").toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [contacts, contactQuery])

  const selectedList = useMemo(() => Object.keys(selectedEmails), [selectedEmails])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/gmail/status", { cache: "no-store" })
      const json = (await res.json()) as GmailStatus
      setStatus(json)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const loadContacts = async (type: "prospectos" | "clientes") => {
    setContactsLoading(true)
    setContactsError("")
    try {
      const res = await fetch(`/api/contacts/${type}`, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) {
        setContactsError(json?.error ? String(json.error) : "Error cargando contactos")
        setContacts([])
        return
      }
      setContacts((json?.contacts as any[]) || [])
      setSelectedEmails({})
    } catch (e) {
      setContactsError(e instanceof Error ? e.message : "Error cargando contactos")
      setContacts([])
    } finally {
      setContactsLoading(false)
    }
  }

  const loadSent = async () => {
    setSentLoading(true)
    setSentError("")
    try {
      const res = await fetch("/api/gmail/sent?limit=100", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) {
        setSentError(json?.error ? String(json.error) : "Error cargando enviados")
        setSent([])
        return
      }
      setSent((json?.sent as any[]) || [])
    } catch (e) {
      setSentError(e instanceof Error ? e.message : "Error cargando enviados")
      setSent([])
    } finally {
      setSentLoading(false)
    }
  }

  useEffect(() => {
    if (!status.connected) return
    loadContacts(audience)
  }, [audience, status.connected])

  useEffect(() => {
    if (tab !== "enviados") return
    loadSent()
  }, [tab])

  const onDisconnect = async () => {
    setDisconnecting(true)
    try {
      await fetch("/api/gmail/disconnect", { method: "POST" })
      await load()
    } finally {
      setDisconnecting(false)
    }
  }

  const onTest = async () => {
    setTesting(true)
    setTestResult("")
    try {
      const res = await fetch("/api/gmail/profile", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) {
        setTestResult(json?.error ? `Error: ${json.error}` : "Error inesperado")
        return
      }
      const email = json?.profile?.emailAddress ?? "—"
      setTestResult(`OK. Gmail profile emailAddress: ${email}`)
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setTesting(false)
    }
  }

  const onSend = async () => {
    setSending(true)
    setSendResult("")
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: sendTo.trim(),
          subject: sendSubject.trim(),
          text: sendBody,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const detail = typeof json?.detail === "string" ? `\n${json.detail}` : ""
        setSendResult(json?.error ? `Error: ${json.error}${detail}` : "Error enviando correo")
        return
      }
      setSendResult("OK. Correo enviado.")
    } catch (e) {
      setSendResult(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setSending(false)
    }
  }

  const onDraft = async () => {
    setDrafting(true)
    setDraftResult("")
    try {
      const currentSubject = sendSubject.trim()
      const currentText = sendBody.trim()
      const res = await fetch("/api/gmail/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: sendTo.trim() || undefined,
          audience,
          instructions: draftInstructions,
          currentSubject: currentSubject || undefined,
          currentText: currentText || undefined,
          language: "es-MX",
          tone: "warm",
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const detail = typeof json?.detail === "string" ? `\n${json.detail}` : ""
        const hint = typeof json?.hint === "string" ? `\n${json.hint}` : ""
        setDraftResult(json?.error ? `Error: ${json.error}${hint}${detail}` : "Error redactando")
        return
      }

      const subject = json?.draft?.subject
      const text = json?.draft?.text
      if (typeof subject === "string") setSendSubject(subject)
      if (typeof text === "string") setSendBody(text)
      const repaired = json?.repaired ? " (reparado)" : ""
      const modelUsed = typeof json?.model_used === "string" ? ` · ${json.model_used}` : ""
      setDraftResult(`OK. Borrador generado${repaired}${modelUsed}.`)
    } catch (e) {
      setDraftResult(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setDrafting(false)
    }
  }

  const onBulkSend = async () => {
    setBulkSending(true)
    setBulkResult("")
    try {
      if (selectedList.length === 0) {
        setBulkResult("Selecciona al menos 1 destinatario.")
        return
      }
      const res = await fetch("/api/gmail/send/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: selectedList,
          subject: sendSubject.trim(),
          text: sendBody,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const detail = typeof json?.detail === "string" ? `\n${json.detail}` : ""
        setBulkResult(json?.error ? `Error: ${json.error}${detail}` : "Error enviando a lista")
        return
      }
      setBulkResult(
        `Intentados: ${json.attempted} · Enviados: ${json.sent} · Fallidos: ${json.failed}`
      )
      await loadSent()
    } catch (e) {
      setBulkResult(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setBulkSending(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-10 overflow-hidden relative"
      >
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-(--accents) blur-[90px] opacity-20" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-4 bg-black rounded-2xl shadow-xl">
              <Cpu className="text-(--accents)" size={26} />
            </div>
            <div>
              <p className="text-[10px] font-black text-black/30 uppercase tracking-[0.35em]">Workspace</p>
              <h2 className="text-4xl font-black text-black tracking-tighter italic uppercase">Automatizaciones.</h2>
            </div>
          </div>

          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/80 transition-all active:scale-95"
            title="Refrescar estado"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refrescar
          </button>
        </div>

        {banner === "connected" ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-[2rem] p-6 mb-6">
            <p className="text-sm font-black text-emerald-800">Gmail conectado correctamente.</p>
          </div>
        ) : null}

        {banner === "error" ? (
          <div className="bg-red-50 border border-red-200 rounded-[2rem] p-6 mb-6">
            <p className="text-sm font-black text-red-700">
              Error conectando Gmail{reason ? `: ${reason}` : "."}
            </p>
            <p className="text-xs font-bold text-red-700/70 mt-1">
              Revisa que el Redirect URI en Google Cloud coincida con{" "}
              <span className="font-black">/api/gmail/oauth/callback</span>.
            </p>
          </div>
        ) : null}

        {/* 1) Conexión arriba */}
        <div className="rounded-[2rem] border border-black/5 bg-gray-50/60 p-8 mb-8">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white rounded-2xl border border-black/5">
                <Mail size={18} className="text-black" />
              </div>
              <div>
                <p className="text-[11px] font-black text-black uppercase tracking-widest">Conexión Google (Gmail)</p>
                <p className="text-[11px] font-bold text-black/40">
                  Conecta tu cuenta para redactar y enviar correos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {status.connected ? (
                <>
                  <button
                    onClick={onTest}
                    disabled={testing}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/80 transition-all active:scale-95 disabled:opacity-60"
                  >
                    {testing ? "Probando…" : "Probar Gmail API"}
                  </button>
                  <button
                    onClick={onDisconnect}
                    disabled={disconnecting}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-60"
                  >
                    <Link2Off size={14} />
                    {disconnecting ? "Desconectando…" : "Desconectar"}
                  </button>
                </>
              ) : (
                <a
                  href="/api/gmail/oauth/start"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/80 transition-all active:scale-95"
                >
                  <Mail size={14} />
                  Conectar Gmail
                </a>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white border border-black/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Cuenta</p>
              <p className="text-sm font-black text-black mt-1">{status.connected ? status.email ?? "—" : "—"}</p>
            </div>
            <div className="rounded-2xl bg-white border border-black/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Permisos</p>
              <p className={`text-sm font-black mt-1 ${hasSendScope ? "text-emerald-700" : "text-red-700"}`}>
                {status.connected ? (hasSendScope ? "Puede enviar" : "No puede enviar") : "—"}
              </p>
              {!hasSendScope && status.connected ? (
                <p className="text-[11px] font-bold text-black/40 mt-1">Desconecta y reconecta para habilitar envío.</p>
              ) : null}
            </div>
            <div className="rounded-2xl bg-white border border-black/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Estado</p>
              <p className="text-[11px] font-bold text-black/50 mt-1">
                {loading ? "Cargando…" : status.connected ? "Conectado" : "No conectado"}
              </p>
              {testResult && status.connected ? (
                <p className="text-[11px] font-bold text-black/50 mt-1">{testResult}</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* 4) Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => setTab("redactor")}
            className={
              tab === "redactor"
                ? "px-6 py-4 rounded-[2rem] bg-black text-white font-black text-[10px] uppercase tracking-widest shadow-sm"
                : "px-6 py-4 rounded-[2rem] bg-gray-50/60 border border-black/5 text-black font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all"
            }
          >
            Redactor
          </button>
          <button
            type="button"
            onClick={() => setTab("enviados")}
            className={
              tab === "enviados"
                ? "px-6 py-4 rounded-[2rem] bg-black text-white font-black text-[10px] uppercase tracking-widest shadow-sm"
                : "px-6 py-4 rounded-[2rem] bg-gray-50/60 border border-black/5 text-black font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all"
            }
          >
            Correos enviados
          </button>
        </div>

        {tab === "enviados" ? (
          <div className="rounded-[2rem] border border-black/5 bg-white p-8">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-black rounded-2xl">
                  <Inbox size={18} className="text-(--accents)" />
                </div>
                <div>
                  <p className="text-[11px] font-black text-black uppercase tracking-widest">Enviados</p>
                  <p className="text-[11px] font-bold text-black/40">Historial de correos enviados desde Gmail.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadSent()}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/80 transition-all active:scale-95 disabled:opacity-60"
                disabled={sentLoading}
              >
                <RefreshCw size={14} className={sentLoading ? "animate-spin" : ""} />
                Refrescar
              </button>
            </div>

            {sentError ? <div className="text-[11px] font-bold text-red-700">{sentError}</div> : null}
            {sentLoading ? (
              <div className="text-[11px] font-black uppercase tracking-widest text-black/40">Cargando…</div>
            ) : sent.length === 0 ? (
              <div className="text-[11px] font-bold text-black/40">Aún no hay correos enviados.</div>
            ) : (
              <div className="space-y-2">
                {sent.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-black/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-black truncate">{s.subject ?? "(sin asunto)"}</p>
                        <p className="text-[11px] font-bold text-black/50 truncate">Para: {s.to_email}</p>
                        <p className="text-[11px] font-bold text-black/40">
                          {new Date(s.created_at).toLocaleString("es-MX")} · {s.audience ?? "—"}
                        </p>
                      </div>
                      <div className="shrink-0 text-[10px] font-black uppercase tracking-widest text-black/30">
                        {s.gmail_message_id ? "OK" : "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 3) Selector destinatarios */}
            <div className="rounded-[2rem] border border-black/5 bg-gray-50/60 p-8">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-[11px] font-black text-black uppercase tracking-widest">Destinatarios</p>
                  <p className="text-[11px] font-bold text-black/40">Selecciona a quién enviar.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAudience("prospectos")}
                    className={
                      audience === "prospectos"
                        ? "px-4 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest"
                        : "px-4 py-3 rounded-2xl bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest"
                    }
                    disabled={!status.connected}
                  >
                    Prospectos
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudience("clientes")}
                    className={
                      audience === "clientes"
                        ? "px-4 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest"
                        : "px-4 py-3 rounded-2xl bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest"
                    }
                    disabled={!status.connected}
                  >
                    Clientes
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                  <input
                    value={contactQuery}
                    onChange={(e) => setContactQuery(e.target.value)}
                    placeholder="Buscar por nombre o email…"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-black/10 bg-white text-black font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
                    disabled={!status.connected}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next: Record<string, true> = {}
                    filteredContacts.slice(0, 50).forEach((c) => {
                      if (c.email) next[c.email] = true
                    })
                    setSelectedEmails(next)
                  }}
                  className="px-4 py-3 rounded-2xl bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50"
                  disabled={!status.connected}
                  title="Selecciona los primeros 50 visibles"
                >
                  Seleccionar
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedEmails({})}
                  className="px-4 py-3 rounded-2xl bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50"
                  disabled={!status.connected}
                >
                  Limpiar
                </button>
              </div>

              <div className="text-[11px] font-bold text-black/40 mb-3">
                Seleccionados: <span className="font-black text-black/60">{selectedList.length}</span> (máx 50 por envío)
              </div>

              {contactsError ? <div className="text-[11px] font-bold text-red-700">{contactsError}</div> : null}
              {contactsLoading ? (
                <div className="text-[11px] font-black uppercase tracking-widest text-black/40">Cargando…</div>
              ) : (
                <div className="max-h-[420px] overflow-auto rounded-2xl bg-white border border-black/5">
                  {filteredContacts.length === 0 ? (
                    <div className="p-4 text-[11px] font-bold text-black/40">No hay contactos.</div>
                  ) : (
                    filteredContacts.map((c) => {
                      const email = String(c.email || "")
                      const isSel = !!selectedEmails[email]
                      const label = `${c.name ?? ""} ${c.last_name ?? ""}`.trim() || email
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            if (!email) return
                            setSelectedEmails((prev) => {
                              const next = { ...prev }
                              if (next[email]) delete next[email]
                              else next[email] = true
                              return next
                            })
                          }}
                          className="w-full flex items-center justify-between gap-3 p-4 border-b border-black/5 text-left hover:bg-gray-50 transition-colors"
                          disabled={!status.connected}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-black text-black truncate">{label}</p>
                            <p className="text-[11px] font-bold text-black/40 truncate">{email}</p>
                          </div>
                          <div className={`shrink-0 w-8 h-8 rounded-2xl border flex items-center justify-center ${isSel ? "bg-(--accents) border-(--accents)" : "bg-white border-black/10"}`}>
                            {isSel ? <Check size={16} className="text-white" /> : null}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {/* 2) Redactor + botón IA llamativo */}
            <div className="rounded-[2rem] border border-black/5 bg-white p-8 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-black rounded-2xl">
                  <Send size={18} className="text-(--accents)" />
                </div>
                <div>
                  <p className="text-[11px] font-black text-black uppercase tracking-widest">Redactor de correos</p>
                  <p className="text-[11px] font-bold text-black/40">
                    Crea mensajes con <span className="font-black text-black">GUROS AI</span> y envía a tu selección.
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Asunto</p>
                <input
                  value={sendSubject}
                  onChange={(e) => setSendSubject(e.target.value)}
                  className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
                  disabled={!status.connected}
                />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Mensaje</p>
                <textarea
                  value={sendBody}
                  onChange={(e) => setSendBody(e.target.value)}
                  rows={10}
                  className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
                  disabled={!status.connected}
                />
              </div>

              <div className="rounded-2xl bg-gray-50/60 border border-black/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">Instrucciones para GUROS AI</p>
                <textarea
                  value={draftInstructions}
                  onChange={(e) => setDraftInstructions(e.target.value)}
                  rows={3}
                  className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
                />
                <button
                  onClick={onDraft}
                  disabled={drafting}
                  className="mt-3 inline-flex items-center justify-center gap-2 w-full px-6 py-4 rounded-[2rem] bg-(--accents) text-white font-black text-[10px] uppercase tracking-widest hover:opacity-90 transition-all active:scale-[0.99] disabled:opacity-60 shadow-lg shadow-(--accents)/20"
                >
                  <Sparkles size={14} />
                  {drafting ? "Redactando…" : "Redactar con GUROS AI"}
                </button>
                {draftResult ? <div className="mt-2 text-[11px] font-bold text-black/60 whitespace-pre-wrap">{draftResult}</div> : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={onBulkSend}
                  disabled={!status.connected || !hasSendScope || bulkSending}
                  className="inline-flex items-center justify-center gap-2 w-full px-6 py-4 rounded-[2rem] bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/80 transition-all active:scale-[0.99] disabled:opacity-60"
                >
                  {bulkSending ? "Enviando…" : `Enviar a selección (${selectedList.length})`}
                </button>

              </div>

              {bulkResult ? <div className="text-[11px] font-bold text-black/60 whitespace-pre-wrap">{bulkResult}</div> : null}
              {sendResult ? <div className="text-[11px] font-bold text-black/60 whitespace-pre-wrap">{sendResult}</div> : null}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

