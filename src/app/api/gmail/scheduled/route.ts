import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim())
}

function normalizeEmail(raw: string) {
  const value = String(raw || "").trim()
  const angleMatch = value.match(/<([^>]+)>/)
  const email = angleMatch?.[1] ?? value
  return email.trim().toLowerCase()
}

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50))
  const fromDate = searchParams.get("fromDate")?.trim()
  const toDate = searchParams.get("toDate")?.trim()

  let query = supabase
    .from(DATABASE.TABLES.WS_SCHEDULED_EMAILS)
    .select("id,audience,recipients,subject,scheduled_for,timezone,status,created_at")
    .eq("user_id", user.id)
    .order("scheduled_for", { ascending: false })
    .limit(limit)

  if (fromDate) {
    const d = new Date(fromDate)
    if (!Number.isNaN(d.getTime())) query = query.gte("scheduled_for", d.toISOString())
  }
  if (toDate) {
    const d = new Date(toDate)
    if (!Number.isNaN(d.getTime())) query = query.lte("scheduled_for", d.toISOString())
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, scheduled: data ?? [] }, { status: 200 })
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  let body: {
    audience?: string
    recipients?: string[] | unknown
    subject?: string
    html?: string
    text?: string
    scheduled_for?: string
    timezone?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 })
  }

  const subject = String(body.subject || "").trim()
  const html = body.html?.trim()
  const text = body.text?.trim()
  const scheduledFor = body.scheduled_for?.trim()
  const timezone = String(body.timezone || "America/Mexico_City").trim() || "America/Mexico_City"

  if (!subject) return NextResponse.json({ ok: false, error: "subject es requerido" }, { status: 400 })
  if (!html && !text) return NextResponse.json({ ok: false, error: "html o text es requerido" }, { status: 400 })
  if (!scheduledFor) return NextResponse.json({ ok: false, error: "scheduled_for es requerido" }, { status: 400 })

  const parsed = new Date(scheduledFor)
  if (Number.isNaN(parsed.getTime())) {
    return NextResponse.json({ ok: false, error: "scheduled_for inválido" }, { status: 400 })
  }
  if (parsed.getTime() < Date.now() + 30_000) {
    return NextResponse.json({ ok: false, error: "El horario debe ser al menos 30 segundos en el futuro" }, { status: 400 })
  }

  const recipientsRaw = Array.isArray(body.recipients) ? body.recipients : []
  const recipients = Array.from(
    new Set(
      recipientsRaw
        .map((x) => normalizeEmail(String(x || "")))
        .filter((x) => !!x && isValidEmail(x)),
    ),
  )
  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, error: "Al menos un destinatario válido es requerido" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_SCHEDULED_EMAILS)
    .insert([
      {
        user_id: user.id,
        audience: body.audience?.trim() || null,
        recipients,
        subject,
        html: html || null,
        text: text || null,
        scheduled_for: parsed.toISOString(),
        timezone,
        status: "pending",
      },
    ])
    .select("id,scheduled_for,status,subject,timezone")
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, scheduled: data }, { status: 201 })
}