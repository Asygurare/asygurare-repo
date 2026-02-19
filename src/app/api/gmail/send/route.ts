import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"
import { getGmailAccessTokenForUser } from "@/src/services/gmail/accessToken"
import { buildRawMessage } from "@/src/services/gmail/message"

export const runtime = "edge"

type SendBody = {
  to: string
  subject: string
  html?: string
  text?: string
}

type SenderProfileRow = {
  first_name?: string | null
  last_name?: string | null
}

type ContactNameRow = {
  email?: string | null
  name?: string | null
  last_name?: string | null
  full_name?: string | null
}

type RecipientContext = {
  clientName: string
  prospectName: string
  anyName: string
}

function normalizeEmail(raw: string) {
  const value = String(raw || "").trim()
  const angleMatch = value.match(/<([^>]+)>/)
  const email = angleMatch?.[1] ?? value
  return email.trim().toLowerCase()
}

function isValidEmail(email: string) {
  // suficiente para validación básica UI/API
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function resolveSenderName(supabase: Awaited<ReturnType<typeof createServerClient>>, user: any) {
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  const metaFirst = String(metadata.first_name ?? "").trim()
  const metaLast = String(metadata.last_name ?? "").trim()
  const metaFull = `${metaFirst} ${metaLast}`.trim()
  if (metaFull) return metaFull

  const profileRes = await supabase
    .from(DATABASE.TABLES.PROFILES)
    .select("first_name,last_name")
    .eq("id", user.id)
    .maybeSingle()

  const profile = (profileRes.data as SenderProfileRow | null) ?? null
  const first = String(profile?.first_name ?? "").trim()
  const last = String(profile?.last_name ?? "").trim()
  const profileFull = `${first} ${last}`.trim()
  if (profileFull) return profileFull

  const email = String(user?.email ?? "").trim()
  if (email.includes("@")) return email.split("@")[0] ?? "user_name"
  return "user_name"
}

function applySenderPlaceholder(template: string, senderName: string) {
  return template
    .replace(/\buser_name\b/gi, senderName)
    .replace(/\[\s*tu nombre(?: completo)?\s*\]/gi, senderName)
    .replace(/\btu nombre(?: completo)?\b/gi, senderName)
}

function getContactDisplayName(row?: ContactNameRow | null) {
  if (!row) return ""
  const full = String(row.full_name ?? "").trim()
  if (full) return full
  const first = String(row.name ?? "").trim()
  const last = String(row.last_name ?? "").trim()
  return `${first} ${last}`.trim()
}

async function resolveRecipientContext(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  recipientEmail: string
): Promise<RecipientContext> {
  const target = normalizeEmail(recipientEmail)

  const fetchRows = async (table: string) => {
    const full = await supabase
      .from(table)
      .select("email,name,last_name,full_name")
      .eq("user_id", userId)
      .limit(1000)
    if (!full.error) return (full.data as ContactNameRow[] | null) ?? []

    const legacy = await supabase
      .from(table)
      .select("email,name,last_name")
      .eq("user_id", userId)
      .limit(1000)
    return (legacy.data as ContactNameRow[] | null) ?? []
  }

  const [leads, customers2, customersLegacy] = await Promise.all([
    fetchRows(DATABASE.TABLES.WS_LEADS),
    fetchRows(DATABASE.TABLES.WS_CUSTOMERS_2),
    fetchRows(DATABASE.TABLES.WS_CUSTOMERS),
  ])

  const leadRow = leads.find((r) => normalizeEmail(String(r.email ?? "")) === target) ?? null
  const customerRow =
    [...customers2, ...customersLegacy].find((r) => normalizeEmail(String(r.email ?? "")) === target) ?? null

  const leadName = String(leadRow?.name ?? "").trim() || getContactDisplayName(leadRow)
  const customerName = String(customerRow?.full_name ?? "").trim() || getContactDisplayName(customerRow)
  const anyName = customerName || leadName || "Cliente"

  return {
    clientName: customerName || anyName,
    prospectName: leadName || anyName,
    anyName,
  }
}

function applyRecipientPlaceholders(template: string, recipient: RecipientContext) {
  const clientName = recipient.clientName || recipient.anyName || "Cliente"
  const prospectName = recipient.prospectName || recipient.anyName || "Prospecto"
  const anyName = recipient.anyName || clientName || prospectName || "Cliente"

  return template
    .replace(/\bclient_name\b/gi, anyName)
    .replace(/\bnombre_cliente\b/gi, clientName)
    .replace(/\bnombre_prospecto\b/gi, prospectName)
    .replace(/\[\s*nombre del cliente\s*\]/gi, clientName)
    .replace(/\bnombre del cliente\b/gi, clientName)
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  let body: SendBody
  try {
    body = (await request.json()) as SendBody
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 })
  }

  const to = (body.to || "").trim()
  const subject = (body.subject || "").trim()
  const html = body.html?.trim()
  const text = body.text?.trim()

  if (!to || !subject) {
    return NextResponse.json({ ok: false, error: "to y subject son requeridos" }, { status: 400 })
  }
  if (!isValidEmail(normalizeEmail(to))) {
    return NextResponse.json({ ok: false, error: "Email inválido" }, { status: 400 })
  }
  if (!html && !text) {
    return NextResponse.json({ ok: false, error: "html o text es requerido" }, { status: 400 })
  }

  const senderName = await resolveSenderName(supabase, user)
  const recipientContext = await resolveRecipientContext(supabase, user.id, normalizeEmail(to)).catch(() => ({
    clientName: "Cliente",
    prospectName: "Prospecto",
    anyName: "Cliente",
  }))
  const finalSubject = applySenderPlaceholder(applyRecipientPlaceholders(subject, recipientContext), senderName)
  const finalHtml = html
    ? applySenderPlaceholder(applyRecipientPlaceholders(html, recipientContext), senderName)
    : undefined
  const finalText = text
    ? applySenderPlaceholder(applyRecipientPlaceholders(text, recipientContext), senderName)
    : undefined

  let accessToken: string
  let providerEmail: string | null
  try {
    const tok = await getGmailAccessTokenForUser(supabase, user.id)
    accessToken = tok.accessToken
    providerEmail = tok.providerEmail ?? null
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Token error" }, { status: 400 })
  }

  const raw = buildRawMessage({
    from: providerEmail,
    to: normalizeEmail(to),
    subject: finalSubject,
    html: finalHtml,
    text: finalText,
  })
  const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  })

  if (!gmailRes.ok) {
    const contentType = gmailRes.headers.get("content-type") || ""
    const detail = contentType.includes("application/json")
      ? JSON.stringify(await gmailRes.json().catch(() => ({})))
      : await gmailRes.text().catch(() => "")

    if (gmailRes.status === 403 && detail.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) {
      return NextResponse.json(
        {
          ok: false,
          error: "insufficient_scopes",
          detail: detail.slice(0, 1000),
          action: "reconnect_gmail",
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { ok: false, error: "gmail_send_failed", detail: detail.slice(0, 1000) },
      { status: 502 }
    )
  }

  const data = await gmailRes.json()
  // Log (best-effort)
  await supabase.from(DATABASE.TABLES.WS_GMAIL_SENT_EMAILS).insert([
    {
      user_id: user.id,
      to_email: to,
      subject: finalSubject,
      audience: "single",
      gmail_message_id: data?.id ?? null,
    },
  ])

  return NextResponse.json({ ok: true, data }, { status: 200 })
}

