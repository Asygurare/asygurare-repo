"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { supabaseClient } from "@/src/lib/supabase/client"
import { DATABASE } from "@/src/config"
import TemplatesPanel from "./components/TemplatesPanel"
import SignaturePanel from "./components/SignaturePanel"
import AIAssistantPanel from "./components/AIAssistantPanel"
import {
  Cpu,
  Pencil,
  RefreshCw,
  Send,
  Check,
  Search,
  Trash2,
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

type SignatureLink = {
  label: string
  url: string
}

type TemplateTag = "prospectos" | "clientes" | "polizas" | "cumpleanos" | "eventos" | "personalizar"

type EmailTemplate = {
  id: string
  name: string
  category: "temporal" | "asesor" | "seguimiento" | "propuesta" | "otro"
  subject: string
  html: string | null
  text: string | null
  attachments: TemplateAttachment[]
  tag_label?: TemplateTag | null
  tag_color?: string | null
  tag_custom_label?: string | null
  is_system: boolean
}

type TemplateAttachment = {
  name: string
  url: string
  path: string
  mime_type: string
}

export default function AutomatizacionesClient({
  banner,
  reason,
  initialSection = "enviar",
}: {
  banner: string | null
  reason: string | null
  initialSection?: "enviar" | "templates" | "firma"
}) {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<GmailStatus>({ connected: false })
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
  const [sendSuccessSummary, setSendSuccessSummary] = useState<{
    attempted: number
    sent: number
    failed: number
  } | null>(null)
  const [tab, setTab] = useState<"redactor" | "enviados" | "programados">("redactor")
  const [composerStep, setComposerStep] = useState<1 | 2 | 3>(1)
  const editorRef = useRef<HTMLDivElement | null>(null)

  const htmlToText = (html: string) => {
    if (!html) return ""
    if (typeof window === "undefined") return html
    const tmp = document.createElement("div")
    tmp.innerHTML = html
    return (tmp.textContent || tmp.innerText || "").replace(/\u00a0/g, " ")
  }

  const plainTextToHtml = (text: string) => {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
    return escaped.replace(/\n/g, "<br>")
  }

  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactsError, setContactsError] = useState<string>("")
  const [contacts, setContacts] = useState<Array<{ id: string; name?: string | null; last_name?: string | null; email?: string | null }>>([])
  const [contactQuery, setContactQuery] = useState("")
  const [selectedEmails, setSelectedEmails] = useState<Record<string, true>>({})

  const [sentLoading, setSentLoading] = useState(false)
  const [sentError, setSentError] = useState("")
  const [sent, setSent] = useState<Array<{ id: string; to_email: string; subject: string | null; audience: string | null; gmail_message_id: string | null; created_at: string }>>([])
  const [scheduleAt, setScheduleAt] = useState("")
  const [scheduling, setScheduling] = useState(false)
  const [scheduleResult, setScheduleResult] = useState("")
  const [scheduledLoading, setScheduledLoading] = useState(false)
  const [scheduledError, setScheduledError] = useState("")
  const [scheduled, setScheduled] = useState<
    Array<{
      id: string
      audience: string | null
      recipients: string[]
      subject: string | null
      scheduled_for: string
      timezone: string | null
      status: "pending" | "processing" | "sent" | "partial" | "failed" | "cancelled"
      attempted_count: number | null
      sent_count: number | null
      failed_count: number | null
      last_error: string | null
      processed_at: string | null
      created_at: string
    }>
  >([])
  const [signatureLoading, setSignatureLoading] = useState(false)
  const [signatureSaving, setSignatureSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [signatureResult, setSignatureResult] = useState("")
  const [signatureName, setSignatureName] = useState("Tu firma de correo")
  const [includeSignature, setIncludeSignature] = useState(true)
  const [signatureLogoPath, setSignatureLogoPath] = useState("")
  const [signatureLogoUrl, setSignatureLogoUrl] = useState("")
  const [signaturePhone, setSignaturePhone] = useState("")
  const [signatureFooterText, setSignatureFooterText] = useState("")
  const [signatureLinksText, setSignatureLinksText] = useState(
    "Sitio web|https://\nInstagram|https://instagram.com/\nFacebook|https://facebook.com/"
  )
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesSaving, setTemplatesSaving] = useState(false)
  const [templatesAIWorking, setTemplatesAIWorking] = useState(false)
  const [templateAssetsUploading, setTemplateAssetsUploading] = useState(false)
  const [templatesResult, setTemplatesResult] = useState("")
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [templateName, setTemplateName] = useState("")
  const [templateCategory, setTemplateCategory] = useState<EmailTemplate["category"]>("asesor")
  const [templateTagLabel, setTemplateTagLabel] = useState<TemplateTag>("prospectos")
  const [templateTagColor, setTemplateTagColor] = useState("#93c5fd")
  const [templateTagCustomLabel, setTemplateTagCustomLabel] = useState("")
  const [sendStep2Mode, setSendStep2Mode] = useState<"redactar" | "plantilla">("redactar")
  const [composerToolPanel, setComposerToolPanel] = useState<"none" | "templates" | "firma" | "ia">("none")
  const [templatesActionStarted, setTemplatesActionStarted] = useState(false)
  const [templateModalMode, setTemplateModalMode] = useState<null | "new" | "edit">(null)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [deleteConfirmTemplateId, setDeleteConfirmTemplateId] = useState<string | null>(null)
  const [templateToastMessage, setTemplateToastMessage] = useState("")
  const [showTemplateMentionSuggestions, setShowTemplateMentionSuggestions] = useState(false)
  const [showTemplateAIPrompt, setShowTemplateAIPrompt] = useState(false)
  const [templateAttachments, setTemplateAttachments] = useState<TemplateAttachment[]>([])
  const [templatePrompt, setTemplatePrompt] = useState(
    "Crea un template de correo para un asesor de seguros, cercano, claro y con llamado a la accion."
  )
  const [senderDisplayName, setSenderDisplayName] = useState("Tu nombre")
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
  const selectableContacts = useMemo(
    () => contacts.filter((c) => !!c.email),
    [contacts]
  )
  const canGoStep2 = selectedList.length > 0
  const sendBodyText = useMemo(() => htmlToText(sendBody), [sendBody])
  const canGoStep3 = canGoStep2 && !!sendSubject.trim() && !!sendBodyText.trim()
  const selectedRecipientsPreview = useMemo(() => {
    const byEmail = new Map(
      contacts
        .filter((c) => !!c.email)
        .map((c) => {
          const email = String(c.email)
          const fullName = `${c.name ?? ""} ${c.last_name ?? ""}`.trim()
          return [email, fullName || email]
        })
    )
    return selectedList.slice(0, 8).map((email) => ({
      email,
      label: byEmail.get(email) ?? email,
    }))
  }, [contacts, selectedList])

  const normalizeUrl = (rawUrl: string) => {
    const trimmed = rawUrl.trim()
    if (!trimmed) return ""
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
  }

  const tagColorByLabel: Record<Exclude<TemplateTag, "personalizar">, string> = {
    prospectos: "#93c5fd",
    clientes: "#86efac",
    polizas: "#fca5a5",
    cumpleanos: "#f9a8d4",
    eventos: "#c4b5fd",
  }

  const parseSignatureLinks = (raw: string): SignatureLink[] => {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [rawLabel, ...rest] = line.split("|")
        const label = (rawLabel || "").trim()
        const url = normalizeUrl(rest.join("|"))
        return { label, url }
      })
      .filter((x) => !!x.label && !!x.url)
  }

  const buildSignatureHtml = () => {
    if (!includeSignature) return ""
    const links = parseSignatureLinks(signatureLinksText)
    const linksHtml = links
      .map((link) => `<a href="${link.url}" target="_blank" style="color:#111111;text-decoration:underline;">${link.label}</a>`)
      .join(" · ")
    const phonePart = signaturePhone.trim()
      ? `<div style="margin:4px 0 0 0;"><strong>Telefono:</strong> <a href="tel:${signaturePhone.trim()}" style="color:#111111;text-decoration:underline;">${signaturePhone.trim()}</a></div>`
      : ""
    const footerPart = signatureFooterText.trim()
      ? `<div style="margin:4px 0 0 0;">${signatureFooterText.trim()}</div>`
      : ""
    const logoPart = signatureLogoUrl
      ? `<div style="margin-top:10px;"><img src="${signatureLogoUrl}" alt="Logo" style="max-height:70px;max-width:220px;object-fit:contain;" /></div>`
      : ""
    const linksPart = linksHtml ? `<div style="margin:4px 0 0 0;">${linksHtml}</div>` : ""
    if (!phonePart && !footerPart && !logoPart && !linksPart) return ""
    return `<div style="margin-top:18px;padding-top:12px;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:13px;color:#111111;"><div style="font-weight:700;margin-bottom:4px;">${signatureName.trim() || "Tu firma de correo"}</div>${phonePart}${linksPart}${footerPart}${logoPart}</div>`
  }

  const buildSignatureText = () => {
    if (!includeSignature) return ""
    const links = parseSignatureLinks(signatureLinksText)
    const lines = [signatureName.trim() || "Tu firma de correo"]
    if (signaturePhone.trim()) lines.push(`Telefono: ${signaturePhone.trim()}`)
    links.forEach((link) => lines.push(`${link.label}: ${link.url}`))
    if (signatureFooterText.trim()) lines.push(signatureFooterText.trim())
    if (signatureLogoUrl) lines.push(`Logo: ${signatureLogoUrl}`)
    return lines.join("\n")
  }

  const composedMessage = useMemo(() => {
    const signatureHtml = buildSignatureHtml()
    const signatureText = buildSignatureText()
    const html = signatureHtml ? `${sendBody}${signatureHtml}` : sendBody
    const text = signatureText ? `${sendBodyText}\n\n${signatureText}` : sendBodyText
    return { html, text }
  }, [
    includeSignature,
    sendBody,
    sendBodyText,
    signatureFooterText,
    signatureLinksText,
    signatureLogoUrl,
    signatureName,
    signaturePhone,
  ])

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates]
  )
  const deleteConfirmTemplate = useMemo(
    () => templates.find((item) => item.id === deleteConfirmTemplateId) ?? null,
    [deleteConfirmTemplateId, templates]
  )
  const isEnviarSection = initialSection === "enviar"
  const isTemplatesSection = initialSection === "templates"
  const isSignatureSection = initialSection === "firma"
  const isStandalonePanel = composerToolPanel === "templates" || composerToolPanel === "firma"

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

  const loadSenderDisplayName = async () => {
    try {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser()
      const first = String((user?.user_metadata as any)?.first_name ?? "").trim()
      const last = String((user?.user_metadata as any)?.last_name ?? "").trim()
      const full = `${first} ${last}`.trim()
      if (full) {
        setSenderDisplayName(full)
        return
      }
      const email = String(user?.email ?? "").trim()
      if (email.includes("@")) {
        setSenderDisplayName(email.split("@")[0] || "Tu nombre")
      }
    } catch {
      // noop
    }
  }

  const loadTemplates = async () => {
    setTemplatesLoading(true)
    setTemplatesResult("")
    try {
      const res = await fetch("/api/gmail/templates", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) {
        setTemplatesResult(json?.error ? `Error: ${json.error}` : "No se pudieron cargar templates")
        return
      }
      setTemplates(Array.isArray(json?.templates) ? (json.templates as EmailTemplate[]) : [])
    } catch (e) {
      setTemplatesResult(e instanceof Error ? e.message : "No se pudieron cargar templates")
    } finally {
      setTemplatesLoading(false)
    }
  }

  const loadSignature = async () => {
    setSignatureLoading(true)
    setSignatureResult("")
    try {
      const res = await fetch("/api/gmail/signature", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) {
        setSignatureResult(json?.error ? `Error: ${json.error}` : "No se pudo cargar tu firma")
        return
      }
      const signature = json?.signature
      if (!signature) return

      setSignatureName(typeof signature.signature_name === "string" ? signature.signature_name : "Tu firma de correo")
      setIncludeSignature(typeof signature.include_signature === "boolean" ? signature.include_signature : true)
      setSignatureLogoPath(typeof signature.logo_path === "string" ? signature.logo_path : "")
      setSignatureLogoUrl(typeof signature.logo_url === "string" ? signature.logo_url : "")
      setSignaturePhone(typeof signature.phone === "string" ? signature.phone : "")
      setSignatureFooterText(typeof signature.footer_text === "string" ? signature.footer_text : "")

      const links = Array.isArray(signature.links) ? (signature.links as SignatureLink[]) : []
      if (links.length > 0) {
        setSignatureLinksText(links.map((x) => `${x.label}|${x.url}`).join("\n"))
      }
    } catch (e) {
      setSignatureResult(e instanceof Error ? e.message : "No se pudo cargar tu firma")
    } finally {
      setSignatureLoading(false)
    }
  }

  useEffect(() => {
    load()
    loadSenderDisplayName()
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

  const loadScheduled = async () => {
    setScheduledLoading(true)
    setScheduledError("")
    try {
      const res = await fetch("/api/gmail/scheduled?limit=200", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) {
        setScheduledError(json?.error ? String(json.error) : "Error cargando programados")
        setScheduled([])
        return
      }
      setScheduled((json?.scheduled as any[]) || [])
    } catch (e) {
      setScheduledError(e instanceof Error ? e.message : "Error cargando programados")
      setScheduled([])
    } finally {
      setScheduledLoading(false)
    }
  }

  useEffect(() => {
    if (!status.connected) return
    loadContacts(audience)
  }, [audience, status.connected])

  useEffect(() => {
    if (!status.connected) return
    loadSignature()
  }, [status.connected])

  useEffect(() => {
    if (!status.connected) return
    loadTemplates()
  }, [status.connected])

  useEffect(() => {
    if (!selectedTemplate) return
    setTemplateName(selectedTemplate.name)
    setTemplateCategory(selectedTemplate.category)
    const nextTag = (selectedTemplate.tag_label as TemplateTag | null | undefined) ?? "prospectos"
    setTemplateTagLabel(nextTag)
    setTemplateTagCustomLabel(String(selectedTemplate.tag_custom_label ?? ""))
    setTemplateTagColor(
      nextTag === "personalizar"
        ? selectedTemplate.tag_color || "#a3a3a3"
        : tagColorByLabel[nextTag as Exclude<TemplateTag, "personalizar">]
    )
  }, [selectedTemplate])

  useEffect(() => {
    if (templateTagLabel === "personalizar") return
    setTemplateTagColor(tagColorByLabel[templateTagLabel])
  }, [templateTagLabel])

  useEffect(() => {
    setTab("redactor")
    if (initialSection === "templates") {
      setComposerStep(2)
      setComposerToolPanel("templates")
      setTemplatesActionStarted(false)
      return
    }
    if (initialSection === "firma") {
      setComposerStep(2)
      setComposerToolPanel("firma")
      setTemplatesActionStarted(false)
      return
    }
    setComposerStep(1)
    setSendStep2Mode("redactar")
    setComposerToolPanel("none")
    setTemplatesActionStarted(false)
  }, [initialSection])

  useEffect(() => {
    if (tab !== "enviados") return
    loadSent()
  }, [tab])

  useEffect(() => {
    if (tab !== "programados") return
    loadScheduled()
  }, [tab])

  useEffect(() => {
    if (!status.connected && isEnviarSection) setComposerStep(1)
  }, [isEnviarSection, status.connected])

  useEffect(() => {
    if (composerStep > 1 && selectedList.length === 0 && !isStandalonePanel) setComposerStep(1)
  }, [composerStep, isStandalonePanel, selectedList.length])

  useEffect(() => {
    if (composerStep === 3 && (!sendSubject.trim() || !sendBodyText.trim())) {
      setComposerStep(2)
    }
  }, [composerStep, sendBodyText, sendSubject])

  useEffect(() => {
    if (!editorRef.current) return
    const currentHtml = editorRef.current.innerHTML
    const nextHtml = sendBody || ""
    if (currentHtml !== nextHtml) {
      editorRef.current.innerHTML = nextHtml
    }
  }, [sendBody, composerStep])

  useEffect(() => {
    if (composerStep !== 3 || scheduleAt) return
    const d = new Date(Date.now() + 10 * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, "0")
    const localValue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`
    setScheduleAt(localValue)
  }, [composerStep, scheduleAt])

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
          html: composedMessage.html,
          text: composedMessage.text,
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
      const currentText = sendBodyText.trim()
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
      if (typeof text === "string") setSendBody(plainTextToHtml(text))
      const repaired = json?.repaired ? " (reparado)" : ""
      const modelUsed = typeof json?.model_used === "string" ? ` · ${json.model_used}` : ""
    } catch (e) {
      setDraftResult(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setDrafting(false)
    }
  }

  const requestDraftWithAI = async (instructions: string, currentSubject?: string, currentText?: string) => {
    const res = await fetch("/api/gmail/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audience,
        instructions,
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
      throw new Error(json?.error ? `${json.error}${hint}${detail}` : "Error usando IA")
    }
    const subject = typeof json?.draft?.subject === "string" ? json.draft.subject : ""
    const text = typeof json?.draft?.text === "string" ? json.draft.text : ""
    return { subject, text }
  }

  const onCreateTemplateWithAI = async () => {
    setTemplatesAIWorking(true)
    setTemplatesResult("")
    try {
      const prompt = templatePrompt.trim()
      if (!prompt) {
        setTemplatesResult("Escribe una instruccion para crear el template.")
        return
      }
      const draft = await requestDraftWithAI(prompt)
      if (draft.subject) setSendSubject(draft.subject)
      if (draft.text) setSendBody(plainTextToHtml(draft.text))
      if (!templateName.trim()) {
        setTemplateName(`Template IA ${new Date().toLocaleDateString("es-MX")}`)
      }
      setTemplatesResult("Template generado por IA. Revisa y guardalo.")
    } catch (e) {
      setTemplatesResult(e instanceof Error ? e.message : "No se pudo crear template con IA")
    } finally {
      setTemplatesAIWorking(false)
    }
  }

  const onImproveTemplateWithAI = async () => {
    setTemplatesAIWorking(true)
    setTemplatesResult("")
    try {
      const currentSubject = sendSubject.trim()
      const currentText = sendBodyText.trim()
      if (!currentSubject && !currentText) {
        setTemplatesResult("Primero carga o escribe un template para mejorar.")
        return
      }
      const prompt = templatePrompt.trim() || "Mejora este template para que sea mas claro, cercano y persuasivo."
      const draft = await requestDraftWithAI(prompt, currentSubject, currentText)
      if (draft.subject) setSendSubject(draft.subject)
      if (draft.text) setSendBody(plainTextToHtml(draft.text))
      setTemplatesResult("Template mejorado por IA.")
    } catch (e) {
      setTemplatesResult(e instanceof Error ? e.message : "No se pudo mejorar template con IA")
    } finally {
      setTemplatesAIWorking(false)
    }
  }

  const onApplyTemplateById = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId) ?? null
    if (!template) {
      setTemplatesResult("Selecciona un template para aplicarlo.")
      return
    }
    setSelectedTemplateId(template.id)
    setSendSubject(template.subject || "")
    if (template.html && template.html.trim()) {
      setSendBody(template.html)
    } else if (template.text && template.text.trim()) {
      setSendBody(plainTextToHtml(template.text))
    } else {
      setSendBody("")
    }
    if (!templateName.trim()) setTemplateName(template.name)
    setTemplateCategory(template.category)
    const nextTag = (template.tag_label as TemplateTag | null | undefined) ?? "prospectos"
    setTemplateTagLabel(nextTag)
    setTemplateTagCustomLabel(String(template.tag_custom_label ?? ""))
    setTemplateTagColor(
      nextTag === "personalizar"
        ? template.tag_color || "#a3a3a3"
        : tagColorByLabel[nextTag as Exclude<TemplateTag, "personalizar">]
    )
    setTemplateAttachments(Array.isArray(template.attachments) ? template.attachments : [])
    setTemplatesResult(`Template aplicado: ${template.name}`)
  }

  const onApplyTemplate = () => {
    if (!selectedTemplateId) {
      setTemplatesResult("Selecciona un template para aplicarlo.")
      return
    }
    onApplyTemplateById(selectedTemplateId)
  }

  const onStartNewTemplate = () => {
    setSelectedTemplateId("")
    setTemplateName("")
    setTemplateCategory("asesor")
    setTemplateTagLabel("prospectos")
    setTemplateTagColor(tagColorByLabel.prospectos)
    setTemplateTagCustomLabel("")
    setSendSubject("")
    setSendBody("")
    setTemplateAttachments([])
    setShowTemplateAIPrompt(false)
    setTemplatesResult("Listo. Puedes crear una nueva plantilla desde cero.")
  }

  const onPrimaryNewTemplate = () => {
    onStartNewTemplate()
    setEditingTemplateId(null)
    setTemplatesActionStarted(false)
    setTemplateModalMode("new")
  }

  const onPrimaryEditTemplate = (templateId?: string) => {
    const targetId = templateId || selectedTemplateId
    const targetTemplate = templates.find((item) => item.id === targetId) ?? null
    if (!targetTemplate) {
      setTemplatesResult("Selecciona una plantilla para editar.")
      return
    }
    if (targetTemplate.is_system) {
      setTemplatesResult("Las plantillas default no se pueden actualizar. Usa 'Nueva plantilla' para crear una versión personalizada.")
      return
    }
    setSelectedTemplateId(targetTemplate.id)
    setEditingTemplateId(targetTemplate.id)
    setTemplatesActionStarted(false)
    onApplyTemplateById(targetTemplate.id)
    setTemplateModalMode("edit")
  }

  const onPrimaryDeleteTemplate = (templateId?: string) => {
    const targetId = templateId || selectedTemplateId
    if (!targetId) {
      setTemplatesResult("Selecciona una plantilla para borrar.")
      return
    }
    const targetTemplate = templates.find((item) => item.id === targetId) ?? null
    if (!targetTemplate || targetTemplate.is_system) {
      setTemplatesResult("No se puede borrar un template default.")
      return
    }
    setSelectedTemplateId(targetId)
    setDeleteConfirmTemplateId(targetId)
    setTemplatesActionStarted(false)
  }

  const onSaveCurrentAsTemplate = async () => {
    setTemplatesSaving(true)
    setTemplatesResult("")
    try {
      const name = templateName.trim()
      if (!name) {
        setTemplatesResult("Ponle nombre al template.")
        return
      }
      if (!sendSubject.trim() || !sendBodyText.trim()) {
        setTemplatesResult("Asunto y mensaje son requeridos para guardar template.")
        return
      }
      const payload = {
        name,
        category: templateCategory,
        subject: sendSubject.trim(),
        html: sendBody,
        text: sendBodyText,
        attachments: templateAttachments.slice(0, 2),
        tag_label: templateTagLabel,
        tag_color: templateTagLabel === "personalizar" ? templateTagColor : tagColorByLabel[templateTagLabel],
        tag_custom_label: templateTagLabel === "personalizar" ? templateTagCustomLabel.trim() || null : null,
      }
      const targetTemplateId = templateModalMode === "edit" ? editingTemplateId : null
      const method = targetTemplateId ? "PATCH" : "POST"
      const url = targetTemplateId ? `/api/gmail/templates/${targetTemplateId}` : "/api/gmail/templates"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setTemplatesResult(json?.error ? `Error: ${json.error}` : "No se pudo guardar template")
        return
      }
      setTemplatesResult(method === "PATCH" ? "Template actualizado." : "Template guardado.")
      setTemplateToastMessage(method === "PATCH" ? "Cambios guardados" : "Plantilla guardada")
      setTimeout(() => setTemplateToastMessage(""), 2200)
      if (templateModalMode) setTemplateModalMode(null)
      if (method === "PATCH") setEditingTemplateId(null)
      await loadTemplates()
    } catch (e) {
      setTemplatesResult(e instanceof Error ? e.message : "No se pudo guardar template")
    } finally {
      setTemplatesSaving(false)
    }
  }

  const onUploadTemplateAssets = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (templateAttachments.length >= 2) {
      setTemplatesResult("Maximo 2 archivos por plantilla.")
      return
    }
    setTemplateAssetsUploading(true)
    setTemplatesResult("")
    try {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser()
      if (!user) {
        setTemplatesResult("Necesitas iniciar sesión para subir archivos.")
        return
      }

      const slotsLeft = 2 - templateAttachments.length
      const toUpload = Array.from(files).slice(0, slotsLeft)
      const uploadedAttachments: TemplateAttachment[] = []

      for (const file of toUpload) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const path = `${user.id}/templates/${Date.now()}-${safeName}`
        const uploaded = await supabaseClient.storage
          .from(DATABASE.BUCKETS.EMAIL_TEMPLATE_ASSETS)
          .upload(path, file, {
            upsert: false,
            contentType: file.type || "application/octet-stream",
          })
        if (uploaded.error) {
          setTemplatesResult(`Error subiendo ${file.name}: ${uploaded.error.message}`)
          continue
        }
        const publicData = supabaseClient.storage
          .from(DATABASE.BUCKETS.EMAIL_TEMPLATE_ASSETS)
          .getPublicUrl(path)
        uploadedAttachments.push({
          name: file.name,
          url: publicData.data.publicUrl,
          path,
          mime_type: file.type || "application/octet-stream",
        })
      }

      if (uploadedAttachments.length > 0) {
        setTemplateAttachments((prev) => [...prev, ...uploadedAttachments].slice(0, 2))
      }
      if (templateAttachments.length + uploadedAttachments.length >= 2) {
        setTemplatesResult("Adjuntos completos (maximo 2).")
      }
    } catch (e) {
      setTemplatesResult(e instanceof Error ? e.message : "No se pudieron subir archivos")
    } finally {
      setTemplateAssetsUploading(false)
    }
  }

  const onRemoveTemplateAttachment = (path: string) => {
    setTemplateAttachments((prev) => prev.filter((item) => item.path !== path))
  }

  const onDeleteTemplateById = async (templateId: string) => {
    const template = templates.find((item) => item.id === templateId) ?? null
    if (!template || template.is_system) {
      setTemplatesResult("Solo puedes borrar templates personalizados.")
      return
    }
    setTemplatesSaving(true)
    setTemplatesResult("")
    try {
      const res = await fetch(`/api/gmail/templates/${template.id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) {
        setTemplatesResult(json?.error ? `Error: ${json.error}` : "No se pudo borrar template")
        return
      }
      setSelectedTemplateId("")
      setTemplatesResult("Template eliminado.")
      setTemplateToastMessage("Plantilla eliminada")
      setTimeout(() => setTemplateToastMessage(""), 2200)
      await loadTemplates()
    } catch (e) {
      setTemplatesResult(e instanceof Error ? e.message : "No se pudo borrar template")
    } finally {
      setTemplatesSaving(false)
    }
  }

  const onDeleteTemplate = async () => {
    if (!selectedTemplateId) {
      setTemplatesResult("Selecciona un template para borrar.")
      return
    }
    await onDeleteTemplateById(selectedTemplateId)
  }

  const onBulkSend = async () => {
    setBulkSending(true)
    setBulkResult("")
    setSendSuccessSummary(null)
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
          html: composedMessage.html,
          text: composedMessage.text,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const detail = typeof json?.detail === "string" ? `\n${json.detail}` : ""
        setBulkResult(json?.error ? `Error: ${json.error}${detail}` : "Error enviando a lista")
        return
      }
      const summary = {
        attempted: Number(json?.attempted ?? selectedList.length),
        sent: Number(json?.sent ?? 0),
        failed: Number(json?.failed ?? 0),
      }
      setBulkResult(`Intentados: ${summary.attempted} · Enviados: ${summary.sent} · Fallidos: ${summary.failed}`)
      if (summary.sent > 0) setSendSuccessSummary(summary)
      await loadSent()
    } catch (e) {
      setBulkResult(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setBulkSending(false)
    }
  }

  const onSendMore = () => {
    setSendSuccessSummary(null)
    setBulkResult("")
    setDraftResult("")
    setSendSubject("")
    setSendBody("")
    setSelectedEmails({})
    setContactQuery("")
    setScheduleAt("")
    setScheduleResult("")
    setComposerStep(1)
  }

  const onScheduleSend = async () => {
    setScheduling(true)
    setScheduleResult("")
    try {
      if (selectedList.length === 0) {
        setScheduleResult("Selecciona al menos 1 destinatario.")
        return
      }
      if (!sendSubject.trim() || !sendBodyText.trim()) {
        setScheduleResult("Asunto y mensaje son requeridos.")
        return
      }
      if (!scheduleAt) {
        setScheduleResult("Selecciona fecha y hora para programar.")
        return
      }

      const localDate = new Date(scheduleAt)
      if (Number.isNaN(localDate.getTime())) {
        setScheduleResult("Fecha y hora inválidas.")
        return
      }

      const res = await fetch("/api/gmail/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          recipients: selectedList,
          subject: sendSubject.trim(),
          html: composedMessage.html,
          text: composedMessage.text,
          scheduled_for: localDate.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Mexico_City",
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const detail = typeof json?.detail === "string" ? `\n${json.detail}` : ""
        setScheduleResult(json?.error ? `Error: ${json.error}${detail}` : "Error programando envío")
        return
      }
      setScheduleResult("OK. Correo programado correctamente.")
      setTab("programados")
      await loadScheduled()
    } catch (e) {
      setScheduleResult(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setScheduling(false)
    }
  }

  const onCancelScheduled = async (id: string) => {
    try {
      const res = await fetch(`/api/gmail/scheduled/${id}/cancel`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) {
        setScheduledError(json?.error ? String(json.error) : "No se pudo cancelar el programado")
        return
      }
      await loadScheduled()
    } catch (e) {
      setScheduledError(e instanceof Error ? e.message : "No se pudo cancelar el programado")
    }
  }

  const applyEditorCommand = (command: string, value?: string) => {
    if (!editorRef.current || !status.connected) return
    editorRef.current.focus()
    document.execCommand("styleWithCSS", false, "true")
    document.execCommand(command, false, value)
    setSendBody(editorRef.current.innerHTML)
  }

  const insertTemplateMention = (token: "nombre_cliente" | "nombre_prospecto") => {
    if (!editorRef.current || !status.connected) return
    editorRef.current.focus()

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)

    if (range.collapsed && range.startContainer.nodeType === Node.TEXT_NODE) {
      const node = range.startContainer as Text
      const current = node.textContent ?? ""
      const cursor = range.startOffset
      if (cursor > 0 && current[cursor - 1] === "@") {
        node.textContent = `${current.slice(0, cursor - 1)}${current.slice(cursor)}`
        range.setStart(node, cursor - 1)
        range.collapse(true)
      }
    }

    const mentionEl = document.createElement("span")
    mentionEl.textContent = token
    mentionEl.setAttribute("data-mention-token", token)
    mentionEl.setAttribute("contenteditable", "false")
    mentionEl.className =
      token === "nombre_cliente"
        ? "inline-flex items-center px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 font-black text-[10px] uppercase tracking-widest align-middle"
        : "inline-flex items-center px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200 font-black text-[10px] uppercase tracking-widest align-middle"

    range.insertNode(mentionEl)
    const spacer = document.createTextNode(" ")
    mentionEl.parentNode?.insertBefore(spacer, mentionEl.nextSibling)
    range.setStartAfter(spacer)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)

    setSendBody(editorRef.current.innerHTML)
    setShowTemplateMentionSuggestions(false)
  }

  const onUploadSignatureLogo = async (file: File | null) => {
    if (!file) return
    setLogoUploading(true)
    setSignatureResult("")
    try {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser()
      if (!user) {
        setSignatureResult("Necesitas iniciar sesión para subir tu logo.")
        return
      }
      const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "png"
      const safeExt = /^(png|jpg|jpeg|webp|gif)$/i.test(ext) ? ext : "png"
      const path = `${user.id}/logo.${safeExt}`
      const uploaded = await supabaseClient.storage.from(DATABASE.BUCKETS.TU_LOGO).upload(path, file, {
        upsert: true,
        contentType: file.type || "image/png",
      })
      if (uploaded.error) {
        setSignatureResult(`Error subiendo logo: ${uploaded.error.message}`)
        return
      }
      const publicData = supabaseClient.storage.from(DATABASE.BUCKETS.TU_LOGO).getPublicUrl(path)
      setSignatureLogoPath(path)
      setSignatureLogoUrl(publicData.data.publicUrl)
      setSignatureResult("Logo cargado. Guarda tu firma para aplicar los cambios.")
    } catch (e) {
      setSignatureResult(e instanceof Error ? e.message : "No se pudo subir el logo")
    } finally {
      setLogoUploading(false)
    }
  }

  const onSaveSignature = async () => {
    setSignatureSaving(true)
    setSignatureResult("")
    try {
      const links = parseSignatureLinks(signatureLinksText)
      const res = await fetch("/api/gmail/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_name: signatureName.trim() || "Tu firma de correo",
          include_signature: includeSignature,
          logo_path: signatureLogoPath || null,
          logo_url: signatureLogoUrl || null,
          phone: signaturePhone.trim() || null,
          footer_text: signatureFooterText.trim() || null,
          links,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSignatureResult(json?.error ? `Error: ${json.error}` : "No se pudo guardar tu firma")
        return
      }
      setSignatureResult("OK. Tu firma de correo se guardo correctamente.")
    } catch (e) {
      setSignatureResult(e instanceof Error ? e.message : "No se pudo guardar tu firma")
    } finally {
      setSignatureSaving(false)
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
              <h2 className="text-4xl font-black text-black tracking-tighter italic uppercase">Email</h2>
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

        {/* 4) Tabs (solo en flujo Enviar) */}
        {isEnviarSection ? (
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
          <button
            type="button"
            onClick={() => setTab("programados")}
            className={
              tab === "programados"
                ? "px-6 py-4 rounded-[2rem] bg-black text-white font-black text-[10px] uppercase tracking-widest shadow-sm"
                : "px-6 py-4 rounded-[2rem] bg-gray-50/60 border border-black/5 text-black font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all"
            }
          >
            Programados
          </button>
        </div>
        ) : null}

        {!isEnviarSection ? (
          isTemplatesSection ? (
            <div className="space-y-5">
              <div className="rounded-[2rem] border border-black/5 bg-white p-8 space-y-4">
                <div>
                  <p className="text-[11px] font-black text-black uppercase tracking-widest">Plantillas de correo</p>
                  <p className="text-[11px] font-bold text-black/40 mt-1">
                    Crea, edita o mejora tus templates. Esta pantalla no requiere seleccionar clientes.
                  </p>
                </div>

                <TemplatesPanel
                  showPrimaryActions={true}
                  showOnlyPrimaryActions={!templatesActionStarted}
                  connected={status.connected}
                  templatesLoading={templatesLoading}
                  templatesSaving={templatesSaving}
                  templatesAIWorking={templatesAIWorking}
                  templatesResult={templatesResult}
                  templates={templates}
                  selectedTemplateId={selectedTemplateId}
                  selectedTemplateIsSystem={!!selectedTemplate?.is_system}
                  hasSelectedTemplate={!!selectedTemplate}
                  templateName={templateName}
                  templateCategory={templateCategory}
                  templateTagLabel={templateTagLabel}
                  templateTagColor={templateTagColor}
                  templateTagCustomLabel={templateTagCustomLabel}
                  templatePrompt={templatePrompt}
                  onChangeSelectedTemplate={setSelectedTemplateId}
                  onApplyTemplate={onPrimaryEditTemplate}
                  onStartNewTemplate={onPrimaryNewTemplate}
                  onDeleteTemplate={onPrimaryDeleteTemplate}
                  onChangeTemplateName={setTemplateName}
                  onChangeTemplateCategory={setTemplateCategory}
                  onChangeTemplateTagLabel={setTemplateTagLabel}
                  onChangeTemplateTagColor={setTemplateTagColor}
                  onChangeTemplateTagCustomLabel={setTemplateTagCustomLabel}
                  onSaveCurrentAsTemplate={onSaveCurrentAsTemplate}
                  onChangeTemplatePrompt={setTemplatePrompt}
                  onCreateTemplateWithAI={onCreateTemplateWithAI}
                  onImproveTemplateWithAI={onImproveTemplateWithAI}
                />

                {templateModalMode ? (
                  <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <button
                      type="button"
                      className="absolute inset-0 bg-black/50"
                      onClick={() => setTemplateModalMode(null)}
                      aria-label="Cerrar modal de plantilla"
                    />
                    <div className="relative w-full max-w-4xl max-h-[90vh] overflow-auto rounded-[2rem] border border-black/10 bg-white p-6 md:p-8 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-widest text-black/40">
                            {templateModalMode === "edit" ? "Editar plantilla" : "Nueva plantilla"}
                          </p>
                          <p className="text-[11px] font-bold text-black/45 mt-1">
                            {templateModalMode === "edit"
                              ? "Modifica tu plantilla y guarda los cambios."
                              : "Dale un nombre a tu plantilla. Ej: Nuevos Prospectos, Saludar a mis clientes, etc."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTemplateModalMode(null)}
                          className="px-3 py-2 rounded-xl bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50"
                        >
                          Cerrar
                        </button>
                      </div>

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Nombre de la plantilla</p>
                        <input
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder="Ej. Nuevos Prospectos"
                          className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Etiqueta</p>
                          <select
                            value={templateTagLabel}
                            onChange={(e) => setTemplateTagLabel(e.target.value as TemplateTag)}
                            className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
                          >
                            <option value="prospectos">Prospectos</option>
                            <option value="clientes">Clientes</option>
                            <option value="polizas">Polizas</option>
                            <option value="cumpleanos">Cumpleanos</option>
                            <option value="eventos">Eventos</option>
                            <option value="personalizar">Personalizar</option>
                          </select>
                        </div>
                        <div className="flex items-end gap-2">
                          <div
                            className="h-11 px-4 rounded-2xl border border-black/10 text-black font-black text-[10px] uppercase tracking-widest inline-flex items-center"
                            style={{ backgroundColor: templateTagColor }}
                          >
                            {templateTagLabel === "personalizar" ? templateTagCustomLabel || "Personalizada" : templateTagLabel}
                          </div>
                          {templateTagLabel === "personalizar" ? (
                            <div className="flex items-center gap-2">
                              <input
                                value={templateTagCustomLabel}
                                onChange={(e) => setTemplateTagCustomLabel(e.target.value)}
                                placeholder="Que significa"
                                className="w-[190px] text-black px-3 py-3 rounded-xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
                              />
                              <input
                                type="color"
                                value={templateTagColor}
                                onChange={(e) => setTemplateTagColor(e.target.value)}
                                className="w-11 h-11 p-1 rounded-xl border border-black/10 bg-white"
                                title="Color personalizado de etiqueta"
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setShowTemplateAIPrompt((v) => !v)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-(--accents)/10 text-(--accents) border border-(--accents)/30 font-black text-[10px] uppercase tracking-widest hover:bg-(--accents)/20"
                        >
                          IA para crear plantilla
                        </button>
                      </div>
                      {showTemplateAIPrompt ? (
                        <div className="rounded-2xl border border-(--accents)/30 bg-(--accents)/10 p-4 space-y-2">
                          <textarea
                            value={templatePrompt}
                            onChange={(e) => setTemplatePrompt(e.target.value)}
                            rows={3}
                            placeholder="Hola! Te ayudare a crear la mejor plantilla para tu comunicación."
                            className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
                          />
                          <button
                            type="button"
                            onClick={onCreateTemplateWithAI}
                            disabled={templatesAIWorking}
                            className="px-4 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/85 disabled:opacity-60"
                          >
                            {templatesAIWorking ? "IA trabajando..." : "Generar con IA"}
                          </button>
                        </div>
                      ) : null}

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Asunto del correo</p>
                        <input
                          value={sendSubject}
                          onChange={(e) => setSendSubject(e.target.value)}
                          placeholder="Escribe el asunto del correo"
                          className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
                        />
                      </div>

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Mensaje</p>
                        <div className="rounded-2xl border border-black/10 bg-white">
                          <div className="flex flex-wrap items-center gap-2 border-b border-black/10 p-3">
                            <button type="button" onClick={() => applyEditorCommand("bold")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black bg-white hover:bg-gray-50 disabled:opacity-60">B</button>
                            <button type="button" onClick={() => applyEditorCommand("italic")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black italic bg-white hover:bg-gray-50 disabled:opacity-60">I</button>
                            <button type="button" onClick={() => applyEditorCommand("underline")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black underline bg-white hover:bg-gray-50 disabled:opacity-60">U</button>
                            <button type="button" onClick={() => applyEditorCommand("insertUnorderedList")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black bg-white hover:bg-gray-50 disabled:opacity-60">Lista</button>
                            <button type="button" onClick={() => applyEditorCommand("insertOrderedList")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black bg-white hover:bg-gray-50 disabled:opacity-60">Lista 1.</button>
                            <label className="text-[10px] font-black uppercase tracking-widest text-black ml-2">Tamano</label>
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                const size = e.target.value
                                if (!size) return
                                applyEditorCommand("fontSize", size)
                                e.currentTarget.value = ""
                              }}
                              disabled={!status.connected}
                              className="px-3 py-2 rounded-xl border border-black/10 text-xs font-bold text-black bg-white disabled:opacity-60"
                            >
                              <option value="" disabled>Seleccionar</option>
                              <option value="2">Pequeno</option>
                              <option value="3">Normal</option>
                              <option value="4">Grande</option>
                              <option value="5">Muy grande</option>
                            </select>
                            <label className="text-[10px] font-black uppercase tracking-widest text-black ml-2">Color</label>
                            <input
                              type="color"
                              defaultValue="#111111"
                              onChange={(e) => applyEditorCommand("foreColor", e.target.value)}
                              disabled={!status.connected}
                              className="w-10 h-10 p-1 rounded-xl border border-black/10 bg-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                              title="Color del texto"
                            />
                          </div>
                          <div
                            ref={editorRef}
                            contentEditable={status.connected}
                            suppressContentEditableWarning
                            onInput={(e) => setSendBody(e.currentTarget.innerHTML)}
                            onKeyUp={(e) => {
                              if (e.key === "@") setShowTemplateMentionSuggestions(true)
                              if (e.key === "Escape") setShowTemplateMentionSuggestions(false)
                            }}
                            onBlur={() => {
                              window.setTimeout(() => setShowTemplateMentionSuggestions(false), 120)
                            }}
                            className="w-full min-h-[220px] text-black px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40 rounded-b-2xl whitespace-pre-wrap"
                          />
                        </div>
                        {showTemplateMentionSuggestions ? (
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <p className="text-[10px] font-black uppercase tracking-widest text-black/45 mr-1">
                              Personalizar con @
                            </p>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                insertTemplateMention("nombre_cliente")
                              }}
                              className="inline-flex items-center px-3 py-1.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 font-black text-[10px] uppercase tracking-widest hover:bg-sky-200"
                            >
                              nombre_cliente
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                insertTemplateMention("nombre_prospecto")
                              }}
                              className="inline-flex items-center px-3 py-1.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200 font-black text-[10px] uppercase tracking-widest hover:bg-violet-200"
                            >
                              nombre_prospecto
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-black/10 bg-gray-50/70 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-[10px] font-black uppercase tracking-widest text-black/45">
                            Bucket de documentos o imagenes (max 2)
                          </p>
                          <label className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-gray-50">
                            {templateAssetsUploading ? "Subiendo..." : "Subir archivo"}
                            <input
                              type="file"
                              accept="image/*,.pdf,.doc,.docx"
                              multiple
                              className="hidden"
                              disabled={templateAssetsUploading || templateAttachments.length >= 2}
                              onChange={(e) => onUploadTemplateAssets(e.target.files)}
                            />
                          </label>
                        </div>
                        <div className="space-y-2">
                          {templateAttachments.length === 0 ? (
                            <p className="text-[11px] font-bold text-black/40">Aun no hay archivos adjuntos.</p>
                          ) : (
                            templateAttachments.map((file) => (
                              <div key={file.path} className="flex items-center justify-between gap-2 rounded-xl bg-white border border-black/10 px-3 py-2">
                                <p className="text-[11px] font-bold text-black/70 truncate">{file.name}</p>
                                <button
                                  type="button"
                                  onClick={() => onRemoveTemplateAttachment(file.path)}
                                  className="px-3 py-1 rounded-lg bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50"
                                >
                                  Quitar
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setTemplateModalMode(null)}
                          className="px-4 py-3 rounded-2xl bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={onSaveCurrentAsTemplate}
                          disabled={templatesSaving}
                          className="px-6 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/85 disabled:opacity-60"
                        >
                          {templatesSaving
                            ? "Guardando..."
                            : templateModalMode === "edit"
                              ? "Guardar cambios"
                              : "Guardar plantilla"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {deleteConfirmTemplateId ? (
                  <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
                    <button
                      type="button"
                      className="absolute inset-0 bg-black/50"
                      onClick={() => setDeleteConfirmTemplateId(null)}
                      aria-label="Cerrar confirmación de borrado"
                    />
                    <div className="relative w-full max-w-md rounded-[1.5rem] border border-black/10 bg-white p-6">
                      <p className="text-[11px] font-black uppercase tracking-widest text-black/45">Confirmar borrado</p>
                      <p className="text-sm font-bold text-black/75 mt-2">
                        Estas seguro que quieres borrar la plantilla{" "}
                        <span className="font-black">{deleteConfirmTemplate?.name ?? ""}</span>?
                      </p>
                      <div className="mt-5 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmTemplateId(null)}
                          className="px-4 py-2 rounded-xl bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const targetId = deleteConfirmTemplateId
                            setDeleteConfirmTemplateId(null)
                            if (!targetId) return
                            await onDeleteTemplateById(targetId)
                          }}
                          className="px-4 py-2 rounded-xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/85"
                        >
                          Si, borrar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {templateToastMessage ? (
                  <div className="fixed right-5 bottom-5 z-[90] rounded-xl bg-black text-white px-4 py-3 shadow-lg">
                    <p className="text-[11px] font-black uppercase tracking-widest">{templateToastMessage}</p>
                  </div>
                ) : null}

                {templatesActionStarted ? (
                <>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setTemplatesActionStarted(false)}
                    className="px-4 py-2 rounded-xl bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50"
                  >
                    Volver al inicio de plantillas
                  </button>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Asunto del template</p>
                  <input
                    value={sendSubject}
                    onChange={(e) => setSendSubject(e.target.value)}
                    className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
                    disabled={!status.connected}
                  />
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Mensaje del template</p>
                  <div className="rounded-2xl border border-black/10 bg-white">
                    <div className="flex flex-wrap items-center gap-2 border-b border-black/10 p-3">
                      <button type="button" onClick={() => applyEditorCommand("bold")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black bg-white hover:bg-gray-50 disabled:opacity-60">B</button>
                      <button type="button" onClick={() => applyEditorCommand("italic")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black italic bg-white hover:bg-gray-50 disabled:opacity-60">I</button>
                      <button type="button" onClick={() => applyEditorCommand("underline")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black underline bg-white hover:bg-gray-50 disabled:opacity-60">U</button>
                      <button type="button" onClick={() => applyEditorCommand("insertUnorderedList")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black bg-white hover:bg-gray-50 disabled:opacity-60">Lista</button>
                      <button type="button" onClick={() => applyEditorCommand("insertOrderedList")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black bg-white hover:bg-gray-50 disabled:opacity-60">Lista 1.</button>
                      <button type="button" onClick={() => applyEditorCommand("justifyLeft")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black bg-white hover:bg-gray-50 disabled:opacity-60">Izq</button>
                      <button type="button" onClick={() => applyEditorCommand("justifyCenter")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black bg-white hover:bg-gray-50 disabled:opacity-60">Centro</button>
                      <button type="button" onClick={() => applyEditorCommand("justifyRight")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black bg-white hover:bg-gray-50 disabled:opacity-60">Der</button>
                      <label className="text-[10px] font-black uppercase tracking-widest text-black ml-2">Tamano</label>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const size = e.target.value
                          if (!size) return
                          applyEditorCommand("fontSize", size)
                          e.currentTarget.value = ""
                        }}
                        disabled={!status.connected}
                        className="px-3 py-2 rounded-xl border border-black/10 text-xs font-bold text-black bg-white disabled:opacity-60"
                      >
                        <option value="" disabled>Seleccionar</option>
                        <option value="2">Pequeno</option>
                        <option value="3">Normal</option>
                        <option value="4">Grande</option>
                        <option value="5">Muy grande</option>
                      </select>
                      <label className="text-[10px] font-black uppercase tracking-widest text-black ml-2">Color</label>
                      <input
                        type="color"
                        defaultValue="#111111"
                        onChange={(e) => applyEditorCommand("foreColor", e.target.value)}
                        disabled={!status.connected}
                        className="w-10 h-10 p-1 rounded-xl border border-black/10 bg-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Color del texto"
                      />
                    </div>
                    <div
                      ref={editorRef}
                      contentEditable={status.connected}
                      suppressContentEditableWarning
                      onInput={(e) => setSendBody(e.currentTarget.innerHTML)}
                      className="w-full min-h-[240px] text-black px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40 rounded-b-2xl whitespace-pre-wrap"
                    />
                    {!sendBodyText.trim() ? (
                      <p className="px-4 pb-3 text-[11px] font-bold text-black/35">
                        Escribe aqui el contenido base de tu template.
                      </p>
                    ) : null}
                  </div>
                </div>
                </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/15 bg-white/80 p-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-[11px] font-black uppercase tracking-widest text-black/45">
                        Plantillas disponibles
                      </p>
                      <button
                        type="button"
                        onClick={loadTemplates}
                        disabled={templatesLoading}
                        className="px-3 py-2 rounded-xl bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 disabled:opacity-60"
                      >
                        {templatesLoading ? "Cargando..." : "Refrescar"}
                      </button>
                    </div>

                    {templatesLoading ? (
                      <p className="text-[11px] font-bold text-black/40">Cargando plantillas...</p>
                    ) : templates.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-[11px] font-black uppercase tracking-widest text-black/45">
                          Elige una accion para continuar
                        </p>
                        <p className="text-[11px] font-bold text-black/40 mt-2">
                          Usa los botones grandes para crear, editar o borrar plantillas.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[520px] overflow-auto pr-1">
                        {templates.map((tpl) => {
                          const isSelected = tpl.id === selectedTemplateId
                          const tag = (tpl.tag_label as TemplateTag | null | undefined) ?? "prospectos"
                          const tagColor =
                            tag === "personalizar"
                              ? tpl.tag_color || "#a3a3a3"
                              : tagColorByLabel[tag as Exclude<TemplateTag, "personalizar">]
                          const tagText = tag === "personalizar" ? tpl.tag_custom_label || "personalizada" : tag
                          const previewText = htmlToText(tpl.html || tpl.text || "").trim() || "(sin mensaje)"
                          return (
                            <article
                              key={tpl.id}
                              className={
                                isSelected
                                  ? "rounded-2xl border border-black bg-blue-100 text-white p-4 shadow-sm"
                                  : "rounded-2xl border border-black/10 bg-gradient-to-b from-white to-gray-50 p-4 hover:shadow-sm transition-all"
                              }
                            >
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-black truncate text-black">{tpl.name}</p>
                                  <p className={isSelected ? "text-[11px] font-bold text-black truncate" : "text-[11px] font-bold text-black truncate"}>
                                    {tpl.subject || "(sin asunto)"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => onPrimaryEditTemplate(tpl.id)}
                                    disabled={tpl.is_system}
                                    className={isSelected ? "p-2 rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-40" : "p-2 rounded-lg bg-white border border-black/10 hover:bg-gray-50 disabled:opacity-40"}
                                    title={tpl.is_system ? "Template default: crea una nueva personalizada para editar" : "Editar plantilla"}
                                  >
                                    <Pencil size={14} className={isSelected ? "text-blue-700" : "text-blue-600"} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onPrimaryDeleteTemplate(tpl.id)}
                                    disabled={tpl.is_system}
                                    className={isSelected ? "p-2 text-red rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-40" : "p-2 rounded-lg bg-white border border-black/10 hover:bg-gray-50 disabled:opacity-40"}
                                    title={tpl.is_system ? "No se puede borrar un template default" : "Borrar plantilla"}
                                  >
                                    <Trash2 size={14} className={isSelected ? "text-red-600" : "text-red-600"} />
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 mb-3">
                                <span
                                  className="px-2 py-1 rounded-full border border-black/10 text-[9px] font-black uppercase tracking-widest text-black"
                                  style={{ backgroundColor: tagColor }}
                                >
                                  {tagText}
                                </span>
                          
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTemplateId(tpl.id)
                                  setTemplatesResult(`Seleccionaste: ${tpl.name}`)
                                }}
                                className={isSelected ? "w-full text-left rounded-xl bg-white/10 p-3" : "w-full text-left rounded-xl border border-black/10 bg-white p-3 hover:bg-gray-50"}
                              >
                                <p className={isSelected ? "text-[10px] font-black uppercase tracking-widest text-black mb-1" : "text-[10px] font-black uppercase tracking-widest text-black/35 mb-1"}>
                                  Vista previa
                                </p>
                                <p className={isSelected ? "text-[11px] font-bold text-black line-clamp-4" : "text-[11px] font-bold text-black/60 line-clamp-4"}>
                                  {previewText}
                                </p>
                              </button>
                            </article>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-[2rem] border border-black/5 bg-white p-8 space-y-4">
                <div>
                  <p className="text-[11px] font-black text-black uppercase tracking-widest">Firma electronica</p>
                  <p className="text-[11px] font-bold text-black/40 mt-1">
                    Configura tu firma una sola vez y reutilizala automaticamente al enviar correos.
                  </p>
                </div>
                <SignaturePanel
                  connected={status.connected}
                  includeSignature={includeSignature}
                  signatureName={signatureName}
                  signaturePhone={signaturePhone}
                  signatureLinksText={signatureLinksText}
                  signatureFooterText={signatureFooterText}
                  logoUploading={logoUploading}
                  signatureSaving={signatureSaving}
                  signatureLoading={signatureLoading}
                  signatureLogoUrl={signatureLogoUrl}
                  signatureResult={signatureResult}
                  onToggleIncludeSignature={setIncludeSignature}
                  onChangeSignatureName={setSignatureName}
                  onChangeSignaturePhone={setSignaturePhone}
                  onChangeSignatureLinksText={setSignatureLinksText}
                  onChangeSignatureFooterText={setSignatureFooterText}
                  onUploadSignatureLogo={onUploadSignatureLogo}
                  onSaveSignature={onSaveSignature}
                />
              </div>
            </div>
          )
        ) : tab === "enviados" ? (
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
        ) : tab === "programados" ? (
          <div className="rounded-[2rem] border border-black/5 bg-white p-8">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-black rounded-2xl">
                  <Send size={18} className="text-(--accents)" />
                </div>
                <div>
                  <p className="text-[11px] font-black text-black uppercase tracking-widest">Programados</p>
                  <p className="text-[11px] font-bold text-black/40">Correos pendientes, enviados o cancelados.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadScheduled()}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/80 transition-all active:scale-95 disabled:opacity-60"
                disabled={scheduledLoading}
              >
                <RefreshCw size={14} className={scheduledLoading ? "animate-spin" : ""} />
                Refrescar
              </button>
            </div>

            {scheduledError ? <div className="text-[11px] font-bold text-red-700">{scheduledError}</div> : null}
            {scheduledLoading ? (
              <div className="text-[11px] font-black uppercase tracking-widest text-black/40">Cargando…</div>
            ) : scheduled.length === 0 ? (
              <div className="text-[11px] font-bold text-black/40">Aún no hay correos programados.</div>
            ) : (
              <div className="space-y-2">
                {scheduled.map((s) => {
                  const recipientsCount = Array.isArray(s.recipients) ? s.recipients.length : 0
                  const canCancel = s.status === "pending" || s.status === "processing"
                  return (
                    <div key={s.id} className="rounded-2xl border border-black/5 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-black truncate">{s.subject ?? "(sin asunto)"}</p>
                          <p className="text-[11px] font-bold text-black/50">
                            {new Date(s.scheduled_for).toLocaleString("es-MX")} · {recipientsCount} destinatarios
                          </p>
                          <p className="text-[11px] font-bold text-black/40">
                            Estado: {s.status} · Enviados: {s.sent_count ?? 0} · Fallidos: {s.failed_count ?? 0}
                          </p>
                          {s.last_error ? (
                            <p className="text-[11px] font-bold text-red-700/80 mt-1 truncate">{s.last_error}</p>
                          ) : null}
                        </div>
                        {canCancel ? (
                          <button
                            type="button"
                            onClick={() => onCancelScheduled(s.id)}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all"
                          >
                            Cancelar
                          </button>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-widest text-black/30">
                            {s.status}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { id: 1, title: "Paso 1", subtitle: "Selecciona destinatarios" },
                { id: 2, title: "Paso 2", subtitle: "Tu mensaje" },
                { id: 3, title: "Paso 3", subtitle: "Confirma y envía" },
              ].map((step) => {
                const isActive = composerStep === step.id
                const canOpen =
                  step.id === 1 || (step.id === 2 && canGoStep2) || (step.id === 3 && canGoStep3)
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      if (!canOpen) return
                      setComposerStep(step.id as 1 | 2 | 3)
                    }}
                    className={
                      isActive
                        ? "text-left rounded-[1.5rem] p-4 border border-black bg-black text-white shadow-sm"
                        : canOpen
                          ? "text-left rounded-[1.5rem] p-4 border border-black/10 bg-white hover:bg-gray-50 transition-colors"
                          : "text-left rounded-[1.5rem] p-4 border border-black/5 bg-gray-50/60 text-black/40 cursor-not-allowed"
                    }
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest">{step.title}</p>
                    <p className="text-xs font-bold mt-1">{step.subtitle}</p>
                  </button>
                )
              })}
            </div>

            {composerStep === 1 ? (
              <div className="rounded-[2rem] border border-black/5 bg-gray-50/60 p-8">
                <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                  <div>
                    <p className="text-[11px] font-black text-black uppercase tracking-widest">
                      1) Clientes o prospectos
                    </p>
                    <p className="text-[11px] font-bold text-black/40">
                      Primero elige a quién quieres escribir. Puedes seleccionar todos.
                    </p>
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
                    >
                      Clientes
                    </button>
                  </div>
                </div>

                {!status.connected ? (
                  <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-amber-700">
                      Primero conecta tu correo
                    </p>
                    <p className="text-[11px] font-bold text-amber-700/80 mt-1">
                      Antes de hacer click y continuar, conecta Gmail en la sección de conexión.
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 mb-3">
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
                      selectableContacts.forEach((c) => {
                        if (c.email) next[String(c.email)] = true
                      })
                      setSelectedEmails(next)
                    }}
                    className="px-4 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/85"
                    disabled={!status.connected || selectableContacts.length === 0}
                  >
                    Seleccionar todos
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
                  Seleccionados: <span className="font-black text-black/60">{selectedList.length}</span> de{" "}
                  <span className="font-black text-black/60">{selectableContacts.length}</span>
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
                            <div
                              className={`shrink-0 w-8 h-8 rounded-2xl border flex items-center justify-center ${isSel ? "bg-(--accents) border-(--accents)" : "bg-white border-black/10"}`}
                            >
                              {isSel ? <Check size={16} className="text-white" /> : null}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setSendStep2Mode("redactar")
                      setComposerStep(2)
                    }}
                    disabled={!status.connected || !canGoStep2}
                    className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-[2rem] bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/80 transition-all active:scale-[0.99] disabled:opacity-60"
                  >
                    Continuar al redactor
                  </button>
                </div>
              </div>
            ) : null}

            {composerStep === 2 ? (
              <div className="rounded-[2rem] border border-black/5 bg-white p-8 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-black rounded-2xl">
                    <Send size={18} className="text-(--accents)" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-black uppercase tracking-widest">
                      2) Redactor del correo
                    </p>
                    <p className="text-[11px] font-bold text-black/40">
                      Escribe tu mensaje o deja que <span className="font-black text-black">GUROS AI</span> escriba por ti.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSendStep2Mode("redactar")}
                    className={
                      sendStep2Mode === "redactar"
                        ? "px-5 py-4 rounded-2xl bg-black text-white font-black text-[11px] uppercase tracking-widest"
                        : "px-5 py-4 rounded-2xl bg-white border border-black/10 text-black font-black text-[11px] uppercase tracking-widest hover:bg-gray-50"
                    }
                  >
                    Redactar correo
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendStep2Mode("plantilla")}
                    className={
                      sendStep2Mode === "plantilla"
                        ? "px-5 py-4 rounded-2xl bg-black text-white font-black text-[11px] uppercase tracking-widest"
                        : "px-5 py-4 rounded-2xl bg-white border border-black/10 text-black font-black text-[11px] uppercase tracking-widest hover:bg-gray-50"
                    }
                  >
                    Elegir una plantilla
                  </button>
                </div>

                {sendStep2Mode === "plantilla" ? (
                  <div className="rounded-2xl border border-black/10 bg-gray-50/70 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/50">Selecciona una plantilla</p>
                        <p className="text-[11px] font-bold text-black/45 mt-1">Haz click en una card para cargar asunto y mensaje.</p>
                      </div>
                      <button
                        type="button"
                        onClick={loadTemplates}
                        disabled={templatesLoading}
                        className="px-3 py-2 rounded-xl bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 disabled:opacity-60"
                      >
                        {templatesLoading ? "Cargando..." : "Refrescar"}
                      </button>
                    </div>
                    {templates.length === 0 ? (
                      <div className="rounded-xl border border-black/10 bg-white p-4 text-[11px] font-bold text-black/45">
                        No hay plantillas disponibles todavía.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {templates.map((tpl) => {
                          const isSelected = tpl.id === selectedTemplateId
                          const tag = (tpl.tag_label as TemplateTag | null | undefined) ?? "prospectos"
                          const tagColor =
                            tag === "personalizar"
                              ? tpl.tag_color || "#a3a3a3"
                              : tagColorByLabel[tag as Exclude<TemplateTag, "personalizar">]
                          const tagText = tag === "personalizar" ? tpl.tag_custom_label || "personalizada" : tag
                          return (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => onApplyTemplateById(tpl.id)}
                              className={
                                isSelected
                                  ? "text-left rounded-2xl border border-black bg-black text-white p-4"
                                  : "text-left rounded-2xl border border-black/10 bg-white hover:bg-gray-50 p-4 text-black"
                              }
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <p className="text-sm font-black truncate">{tpl.name}</p>
                                <span
                                  className="px-2 py-1 rounded-full border border-black/10 text-[9px] font-black uppercase tracking-widest text-black"
                                  style={{ backgroundColor: tagColor }}
                                >
                                  {tagText}
                                </span>
                              </div>
                              <p className={isSelected ? "text-[11px] font-bold text-white/85 truncate" : "text-[11px] font-bold text-black/55 truncate"}>
                                {tpl.subject || "(sin asunto)"}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4 space-y-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/45">Asunto cargado</p>
                        <p className="text-sm font-black text-black mt-1 break-words">
                          {sendSubject?.trim() || "(sin asunto)"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/45">Cuerpo cargado</p>
                        {sendBodyText.trim() ? (
                          <div
                            className="text-sm font-bold text-black/70 mt-1 whitespace-pre-wrap break-words [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5"
                            dangerouslySetInnerHTML={{ __html: sendBody }}
                          />
                        ) : (
                          <p className="text-[11px] font-bold text-black/45 mt-1">
                            Selecciona una plantilla para ver su contenido.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setComposerToolPanel("ia")}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-(--accents)/10 border border-(--accents)/30 text-(--accents) font-black text-[10px] uppercase tracking-widest hover:bg-(--accents)/20 transition-colors"
                      >
                        Redactar correo con IA
                      </button>
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
                      <div className="rounded-2xl border border-black/10 bg-white">
                        <div className="flex flex-wrap items-center gap-2 border-b border-black/10 p-3">
                          <button type="button" onClick={() => applyEditorCommand("bold")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black bg-white hover:bg-gray-50 disabled:opacity-60">B</button>
                          <button type="button" onClick={() => applyEditorCommand("italic")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black italic bg-white hover:bg-gray-50 disabled:opacity-60">I</button>
                          <button type="button" onClick={() => applyEditorCommand("underline")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black underline bg-white hover:bg-gray-50 disabled:opacity-60">U</button>
                          <button type="button" onClick={() => applyEditorCommand("insertUnorderedList")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black bg-white hover:bg-gray-50 disabled:opacity-60">Lista</button>
                          <button type="button" onClick={() => applyEditorCommand("insertOrderedList")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black bg-white hover:bg-gray-50 disabled:opacity-60">Lista 1.</button>
                          <button type="button" onClick={() => applyEditorCommand("justifyLeft")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black bg-white hover:bg-gray-50 disabled:opacity-60">Izq</button>
                          <button type="button" onClick={() => applyEditorCommand("justifyCenter")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black bg-white hover:bg-gray-50 disabled:opacity-60">Centro</button>
                          <button type="button" onClick={() => applyEditorCommand("justifyRight")} disabled={!status.connected} className="px-3 py-2 rounded-xl border border-black/10 text-xs font-black text-black bg-white hover:bg-gray-50 disabled:opacity-60">Der</button>
                          <label className="text-[10px] font-black uppercase tracking-widest text-black ml-2">Tamano</label>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              const size = e.target.value
                              if (!size) return
                              applyEditorCommand("fontSize", size)
                              e.currentTarget.value = ""
                            }}
                            disabled={!status.connected}
                            className="px-3 py-2 rounded-xl border border-black/10 text-xs font-bold text-black bg-white disabled:opacity-60"
                          >
                            <option value="" disabled>Seleccionar</option>
                            <option value="2">Pequeno</option>
                            <option value="3">Normal</option>
                            <option value="4">Grande</option>
                            <option value="5">Muy grande</option>
                          </select>
                          <label className="text-[10px] font-black uppercase tracking-widest text-black ml-2">Color</label>
                          <input
                            type="color"
                            defaultValue="#111111"
                            onChange={(e) => applyEditorCommand("foreColor", e.target.value)}
                            disabled={!status.connected}
                            className="w-10 h-10 p-1 rounded-xl border border-black/10 bg-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            title="Color del texto"
                          />
                        </div>
                        <div
                          ref={editorRef}
                          contentEditable={status.connected}
                          suppressContentEditableWarning
                          onInput={(e) => setSendBody(e.currentTarget.innerHTML)}
                          onKeyUp={(e) => {
                            if (e.key === "@") setShowTemplateMentionSuggestions(true)
                            if (e.key === "Escape") setShowTemplateMentionSuggestions(false)
                          }}
                          onBlur={() => {
                            window.setTimeout(() => setShowTemplateMentionSuggestions(false), 120)
                          }}
                          className="w-full min-h-[240px] text-black px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40 rounded-b-2xl whitespace-pre-wrap"
                        />
                        {showTemplateMentionSuggestions ? (
                          <div className="px-4 pb-3 pt-2 flex items-center gap-2 flex-wrap">
                            <p className="text-[10px] font-black uppercase tracking-widest text-black/45 mr-1">
                              Personalizar con @
                            </p>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                insertTemplateMention("nombre_cliente")
                              }}
                              className="inline-flex items-center px-3 py-1.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 font-black text-[10px] uppercase tracking-widest hover:bg-sky-200"
                            >
                              nombre_cliente
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                insertTemplateMention("nombre_prospecto")
                              }}
                              className="inline-flex items-center px-3 py-1.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200 font-black text-[10px] uppercase tracking-widest hover:bg-violet-200"
                            >
                              nombre_prospecto
                            </button>
                          </div>
                        ) : null}
                        {!sendBodyText.trim() ? (
                          <p className="px-4 pb-3 text-[11px] font-bold text-black/35">
                            Escribe tu mensaje aqui. Puedes usar negrita, cursiva, subrayado, listas y tamano.
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {composerToolPanel === "firma" ? (
                      <SignaturePanel
                        connected={status.connected}
                        includeSignature={includeSignature}
                        signatureName={signatureName}
                        signaturePhone={signaturePhone}
                        signatureLinksText={signatureLinksText}
                        signatureFooterText={signatureFooterText}
                        logoUploading={logoUploading}
                        signatureSaving={signatureSaving}
                        signatureLoading={signatureLoading}
                        signatureLogoUrl={signatureLogoUrl}
                        signatureResult={signatureResult}
                        onToggleIncludeSignature={setIncludeSignature}
                        onChangeSignatureName={setSignatureName}
                        onChangeSignaturePhone={setSignaturePhone}
                        onChangeSignatureLinksText={setSignatureLinksText}
                        onChangeSignatureFooterText={setSignatureFooterText}
                        onUploadSignatureLogo={onUploadSignatureLogo}
                        onSaveSignature={onSaveSignature}
                      />
                    ) : null}

                    {composerToolPanel === "ia" ? (
                      <AIAssistantPanel
                        senderDisplayName={senderDisplayName}
                        draftInstructions={draftInstructions}
                        drafting={drafting}
                        draftResult={draftResult}
                        onChangeDraftInstructions={setDraftInstructions}
                        onDraft={onDraft}
                      />
                    ) : null}
                  </>
                )}

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setComposerStep(1)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-[2rem] bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all active:scale-[0.99]"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposerStep(3)}
                    disabled={!status.connected || !canGoStep3}
                    className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-[2rem] bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/80 transition-all active:scale-[0.99] disabled:opacity-60"
                  >
                    Continuar a confirmar
                  </button>
                </div>
              </div>
            ) : null}

            {composerStep === 3 ? (
              <div className="rounded-[2rem] border border-black/5 bg-white p-8 space-y-5">
                {sendSuccessSummary ? (
                  <div className="rounded-[2rem] border border-(--accents)/40 bg-(--accents) p-8 text-white">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                        <Check size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Correos enviados</p>
                        <p className="text-lg font-black">Envio completado con exito.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                      <div className="rounded-2xl bg-white/15 border border-white/20 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Intentados</p>
                        <p className="text-xl font-black mt-1">{sendSuccessSummary.attempted}</p>
                      </div>
                      <div className="rounded-2xl bg-white/15 border border-white/20 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Enviados</p>
                        <p className="text-xl font-black mt-1">{sendSuccessSummary.sent}</p>
                      </div>
                      <div className="rounded-2xl bg-white/15 border border-white/20 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Fallidos</p>
                        <p className="text-xl font-black mt-1">{sendSuccessSummary.failed}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onSendMore}
                      className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-[2rem] bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-white/90 transition-all active:scale-[0.99]"
                    >
                      Mandar mas
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-[11px] font-black text-black uppercase tracking-widest">3) Confirmar y enviar</p>
                      <p className="text-[11px] font-bold text-black/40">
                        Revisa tu envío y confirma cuando estés listo.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-2xl bg-gray-50/80 border border-black/5 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Audiencia</p>
                        <p className="text-sm font-black text-black mt-1 capitalize">{audience}</p>
                      </div>
                      <div className="rounded-2xl bg-gray-50/80 border border-black/5 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Destinatarios</p>
                        <p className="text-sm font-black text-black mt-1">{selectedList.length}</p>
                      </div>
                      <div className="rounded-2xl bg-gray-50/80 border border-black/5 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Estado Gmail</p>
                        <p className={`text-sm font-black mt-1 ${hasSendScope ? "text-emerald-700" : "text-red-700"}`}>
                          {hasSendScope ? "Listo para enviar" : "Falta permiso gmail.send"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/5 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Asunto</p>
                      <p className="text-sm font-black text-black mt-1 break-words">{sendSubject || "(sin asunto)"}</p>
                    </div>

                    <div className="rounded-2xl border border-black/5 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Mensaje</p>
                      {sendBodyText.trim() ? (
                        <div
                          className="text-sm font-bold text-black/70 mt-1 whitespace-pre-wrap break-words [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5"
                          dangerouslySetInnerHTML={{ __html: composedMessage.html }}
                        />
                      ) : (
                        <p className="text-sm font-bold text-black/70 mt-1 whitespace-pre-wrap break-words">
                          (sin mensaje)
                        </p>
                      )}
                    </div>

                    {selectedRecipientsPreview.length > 0 ? (
                      <div className="rounded-2xl border border-black/5 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">
                          Vista previa de destinatarios
                        </p>
                        <div className="space-y-1">
                          {selectedRecipientsPreview.map((recipient) => (
                            <p key={recipient.email} className="text-[11px] font-bold text-black/60 truncate">
                              {recipient.label} · {recipient.email}
                            </p>
                          ))}
                          {selectedList.length > selectedRecipientsPreview.length ? (
                            <p className="text-[11px] font-bold text-black/40">
                              +{selectedList.length - selectedRecipientsPreview.length} más
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setComposerStep(2)}
                        className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-[2rem] bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all active:scale-[0.99]"
                      >
                        Volver al redactor
                      </button>
                      <button
                        onClick={onBulkSend}
                        disabled={!status.connected || !hasSendScope || bulkSending}
                        className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-[2rem] bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/80 transition-all active:scale-[0.99] disabled:opacity-60"
                      >
                        {bulkSending ? "Enviando…" : `Confirmar y enviar (${selectedList.length})`}
                      </button>
                    </div>

                    <div className="rounded-2xl border border-black/5 bg-gray-50/60 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">
                        O programa este envío
                      </p>
                      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                        <input
                          type="datetime-local"
                          value={scheduleAt}
                          onChange={(e) => setScheduleAt(e.target.value)}
                          className="w-full md:w-auto text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
                        />
                        <button
                          type="button"
                          onClick={onScheduleSend}
                          disabled={!status.connected || !hasSendScope || scheduling}
                          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-(--accents) text-white font-black text-[10px] uppercase tracking-widest hover:opacity-90 transition-all active:scale-[0.99] disabled:opacity-60"
                        >
                          {scheduling ? "Programando…" : "Programar correo"}
                        </button>
                      </div>
                      {scheduleResult ? (
                        <div className="mt-2 text-[11px] font-bold text-black/60 whitespace-pre-wrap">{scheduleResult}</div>
                      ) : null}
                    </div>

                    {bulkResult ? <div className="text-[11px] font-bold text-black/60 whitespace-pre-wrap">{bulkResult}</div> : null}
                    {sendResult ? <div className="text-[11px] font-bold text-black/60 whitespace-pre-wrap">{sendResult}</div> : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        )}
      </motion.div>
    </div>
  )
}

