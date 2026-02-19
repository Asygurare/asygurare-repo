import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"
import { getGmailAccessTokenForUser } from "@/src/services/gmail/accessToken"
import { buildRawMessage } from "@/src/services/gmail/message"

export const runtime = "edge"

type Audience = "prospectos" | "clientes"

type BulkBody = {
  audience?: Audience
  recipients?: string[]
  subject: string
  html?: string
  text?: string
  limit?: number
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

type SenderProfileRow = {
  first_name?: string | null
  last_name?: string | null
}

function normalizeEmail(raw: string) {
  const value = String(raw || "").trim()
  const angleMatch = value.match(/<([^>]+)>/)
  const email = angleMatch?.[1] ?? value
  return email.trim().toLowerCase()
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getContactDisplayName(row?: ContactNameRow | null) {
  if (!row) return ""
  const full = String(row.full_name ?? "").trim()
  if (full) return full
  const first = String(row.name ?? "").trim()
  const last = String(row.last_name ?? "").trim()
  return `${first} ${last}`.trim()
}

function applyRecipientPlaceholders(template: string, recipient: RecipientContext) {
  const clientName = recipient.clientName || recipient.anyName || "Cliente"
  const prospectName = recipient.prospectName || recipient.anyName || "Prospecto"
  const anyName = recipient.anyName || clientName || prospectName || "Cliente"

  return template
    .replace(/\bclient_name\b/gi, anyName)
    .replace(/\bnombre_cliente\b/gi, clientName)
    .replace(/\bnombre_prospecto\b/gi, prospectName)
}

async function fetchContactRows(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  table: string,
  userId: string
) {
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

async function sendOne(
  accessToken: string,
  from: string | null,
  to: string,
  subject: string,
  html?: string,
  text?: string
) {
  const raw = buildRawMessage({ from, to, subject, html, text })
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) {
    const contentType = res.headers.get("content-type") || ""
    const detail = contentType.includes("application/json")
      ? JSON.stringify(await res.json().catch(() => ({})))
      : await res.text().catch(() => "")
    throw new Error(detail.slice(0, 500) || "gmail_send_failed")
  }
  return (await res.json()) as { id?: string }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
) {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let nextIndex = 0

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const i = nextIndex++
      if (i >= items.length) return
      try {
        const value = await fn(items[i]!, i)
        results[i] = { status: "fulfilled", value }
      } catch (reason) {
        results[i] = { status: "rejected", reason }
      }
    }
  })

  await Promise.all(workers)
  return results
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  let body: BulkBody
  try {
    body = (await request.json()) as BulkBody
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 })
  }

  const audience = body.audience
  const subject = (body.subject || "").trim()
  const html = body.html?.trim()
  const text = body.text?.trim()
  const limit = Math.min(Math.max(body.limit ?? 25, 1), 50)
  const recipients = Array.isArray(body.recipients) ? body.recipients : null

  if (!subject) return NextResponse.json({ ok: false, error: "subject requerido" }, { status: 400 })
  if (!html && !text) return NextResponse.json({ ok: false, error: "html o text requerido" }, { status: 400 })

  let emails: string[] = []
  if (recipients && recipients.length > 0) {
    emails = Array.from(
      new Set(
        recipients
          .map((e) => normalizeEmail(String(e || "")))
          .filter((e) => e && isValidEmail(e))
      )
    ).slice(0, 50)
  } else {
    if (audience !== "prospectos" && audience !== "clientes") {
      return NextResponse.json({ ok: false, error: "audience requerido si no hay recipients" }, { status: 400 })
    }

    const table = audience === "prospectos" ? DATABASE.TABLES.WS_LEADS : DATABASE.TABLES.WS_CUSTOMERS_2
    const { data, error } = await supabase
      .from(table)
      .select("email")
      .eq("user_id", user.id)
      .limit(limit)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    emails = Array.from(
      new Set(
        ((data as Array<{ email?: string | null }> | null) ?? [])
          .map((r) => normalizeEmail(String(r.email || "")))
          .filter((e) => e && isValidEmail(e))
      )
    ).slice(0, limit)
  }

  if (emails.length === 0) {
    return NextResponse.json({ ok: false, error: "No hay emails válidos para enviar" }, { status: 400 })
  }

  const senderName = await resolveSenderName(supabase, user)

  const recipientByEmail = new Map<string, RecipientContext>()
  try {
    const [leadsRows, customersRows, customersLegacyRows] = await Promise.all([
      fetchContactRows(supabase, DATABASE.TABLES.WS_LEADS, user.id),
      fetchContactRows(supabase, DATABASE.TABLES.WS_CUSTOMERS_2, user.id),
      fetchContactRows(supabase, DATABASE.TABLES.WS_CUSTOMERS, user.id),
    ])

    for (const row of leadsRows) {
      const email = normalizeEmail(String(row.email ?? ""))
      if (!email) continue
      const existing = recipientByEmail.get(email)
      const prospectName = String(row.name ?? "").trim() || getContactDisplayName(row)
      if (!prospectName) continue
      recipientByEmail.set(email, {
        clientName: existing?.clientName ?? "",
        prospectName,
        anyName: existing?.anyName || prospectName,
      })
    }

    for (const row of [...customersRows, ...customersLegacyRows]) {
      const email = normalizeEmail(String(row.email ?? ""))
      if (!email) continue
      const existing = recipientByEmail.get(email)
      const clientName = String(row.full_name ?? "").trim() || getContactDisplayName(row)
      if (!clientName) continue
      recipientByEmail.set(email, {
        clientName,
        prospectName: existing?.prospectName ?? "",
        anyName: clientName || existing?.anyName || "",
      })
    }
  } catch {
    // Si hay error consultando nombres, continuamos envío sin personalización.
  }

  let accessToken: string
  let providerEmail: string | null
  try {
    const tok = await getGmailAccessTokenForUser(supabase, user.id)
    accessToken = tok.accessToken
    providerEmail = tok.providerEmail ?? null
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Token error" }, { status: 400 })
  }

  const settled = await mapWithConcurrency(emails, 3, async (to) => {
    const recipientContext = recipientByEmail.get(to.toLowerCase()) ?? {
      clientName: "",
      prospectName: "",
      anyName: "",
    }
    const perRecipientSubject = applySenderPlaceholder(
      applyRecipientPlaceholders(subject, recipientContext),
      senderName
    )
    const perRecipientHtml = html
      ? applySenderPlaceholder(applyRecipientPlaceholders(html, recipientContext), senderName)
      : undefined
    const perRecipientText = text
      ? applySenderPlaceholder(applyRecipientPlaceholders(text, recipientContext), senderName)
      : undefined
    const r = await sendOne(
      accessToken,
      providerEmail,
      to,
      perRecipientSubject,
      perRecipientHtml,
      perRecipientText
    )
    return { to, id: r.id ?? null }
  })

  const ok: Array<{ to: string; id: string | null }> = []
  const failed: Array<{ to: string; error: string }> = []

  settled.forEach((s, i) => {
    const to = emails[i]!
    if (s.status === "fulfilled") ok.push(s.value)
    else failed.push({ to, error: s.reason instanceof Error ? s.reason.message : String(s.reason) })
  })

  // Log (best-effort)
  if (ok.length > 0) {
    await supabase.from(DATABASE.TABLES.WS_GMAIL_SENT_EMAILS).insert(
      ok.map((x) => ({
        user_id: user.id,
        to_email: x.to,
        subject,
        audience: recipients ? "selected" : audience ?? null,
        gmail_message_id: x.id,
      }))
    )
  }

  return NextResponse.json(
    {
      ok: true,
      audience: recipients ? "selected" : audience,
      attempted: emails.length,
      sent: ok.length,
      failed: failed.length,
      results: { ok, failed },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  )
}

