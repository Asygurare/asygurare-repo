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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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
          .map((e) => String(e || "").trim())
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
          .map((r) => (r.email || "").trim())
          .filter((e) => e && isValidEmail(e))
      )
    ).slice(0, limit)
  }

  if (emails.length === 0) {
    return NextResponse.json({ ok: false, error: "No hay emails válidos para enviar" }, { status: 400 })
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
    const r = await sendOne(accessToken, providerEmail, to, subject, html, text)
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

