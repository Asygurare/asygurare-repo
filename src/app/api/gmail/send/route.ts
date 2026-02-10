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

function isValidEmail(email: string) {
  // suficiente para validación básica UI/API
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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
  if (!isValidEmail(to)) {
    return NextResponse.json({ ok: false, error: "Email inválido" }, { status: 400 })
  }
  if (!html && !text) {
    return NextResponse.json({ ok: false, error: "html o text es requerido" }, { status: 400 })
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

  const raw = buildRawMessage({ from: providerEmail, to, subject, html, text })
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
      subject,
      audience: "single",
      gmail_message_id: data?.id ?? null,
    },
  ])

  return NextResponse.json({ ok: true, data }, { status: 200 })
}

