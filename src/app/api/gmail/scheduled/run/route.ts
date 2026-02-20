import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { DATABASE } from "@/src/config"
import { getGmailAccessTokenForUser } from "@/src/services/gmail/accessToken"
import { buildRawMessage } from "@/src/services/gmail/message"

export const runtime = "edge"

type ScheduledRow = {
  id: string
  user_id: string
  audience?: string | null
  recipients?: unknown
  subject: string
  text?: string | null
  html?: string | null
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

function isSchedulerAuthorized(request: Request, secret: string) {
  const incomingSecret = request.headers.get("x-scheduler-secret")
  if (incomingSecret && incomingSecret === secret) return true

  const authHeader = request.headers.get("authorization") || ""
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
  return bearer === secret
}

async function sendOne(
  accessToken: string,
  from: string | null,
  to: string,
  subject: string,
  html?: string,
  text?: string,
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

async function run(request: Request) {
  const secret = process.env.GMAIL_SCHEDULER_SECRET || process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Missing GMAIL_SCHEDULER_SECRET/CRON_SECRET" }, { status: 500 })
  }
  if (!isSchedulerAuthorized(request, secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized scheduler" }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const nowIso = new Date().toISOString()
  const { data: dueRows, error } = await admin
    .from(DATABASE.TABLES.WS_SCHEDULED_EMAILS)
    .select("id,user_id,audience,recipients,subject,text,html,status")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(50)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!dueRows || dueRows.length === 0) return NextResponse.json({ ok: true, processed: 0, jobs: [] }, { status: 200 })

  const jobs: Array<{ id: string; status: string; attempted: number; sent: number; failed: number }> = []

  for (const row of dueRows as ScheduledRow[]) {
    const lock = await admin
      .from(DATABASE.TABLES.WS_SCHEDULED_EMAILS)
      .update({ status: "processing" })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle()
    if (!lock.data) continue

    try {
      const recipientsRaw = Array.isArray(row.recipients) ? row.recipients : []
      const recipients = Array.from(
        new Set(
          recipientsRaw
            .map((x) => normalizeEmail(String(x || "")))
            .filter((x) => !!x && isValidEmail(x)),
        ),
      ).slice(0, 50)

      if (recipients.length === 0) {
        await admin
          .from(DATABASE.TABLES.WS_SCHEDULED_EMAILS)
          .update({
            status: "failed",
            attempted_count: 0,
            sent_count: 0,
            failed_count: 0,
            last_error: "No hay destinatarios válidos",
            processed_at: new Date().toISOString(),
          })
          .eq("id", row.id)
        jobs.push({ id: row.id, status: "failed", attempted: 0, sent: 0, failed: 0 })
        continue
      }

      const tokenRes = await getGmailAccessTokenForUser(admin as any, row.user_id)
      const ok: Array<{ to: string; subject: string; id: string | null }> = []
      const failed: Array<{ to: string; error: string }> = []

      for (const to of recipients) {
        try {
          const sent = await sendOne(
            tokenRes.accessToken,
            tokenRes.providerEmail ?? null,
            to,
            String(row.subject || ""),
            row.html || undefined,
            row.text || undefined,
          )
          ok.push({ to, subject: String(row.subject || ""), id: sent.id ?? null })
        } catch (e) {
          failed.push({ to, error: e instanceof Error ? e.message : String(e) })
        }
      }

      if (ok.length > 0) {
        await admin.from(DATABASE.TABLES.WS_GMAIL_SENT_EMAILS).insert(
          ok.map((s) => ({
            user_id: row.user_id,
            to_email: s.to,
            subject: s.subject,
            audience: row.audience ?? "scheduled",
            gmail_message_id: s.id,
          })),
        )
      }

      const status = failed.length === 0 ? "sent" : ok.length > 0 ? "partial" : "failed"
      await admin
        .from(DATABASE.TABLES.WS_SCHEDULED_EMAILS)
        .update({
          status,
          attempted_count: recipients.length,
          sent_count: ok.length,
          failed_count: failed.length,
          last_error: failed.length > 0 ? failed.slice(0, 5).map((f) => `${f.to}: ${f.error}`).join(" | ") : null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id)

      jobs.push({ id: row.id, status, attempted: recipients.length, sent: ok.length, failed: failed.length })
    } catch (e) {
      await admin
        .from(DATABASE.TABLES.WS_SCHEDULED_EMAILS)
        .update({
          status: "failed",
          last_error: e instanceof Error ? e.message.slice(0, 1000) : String(e).slice(0, 1000),
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id)
      jobs.push({ id: row.id, status: "failed", attempted: 0, sent: 0, failed: 0 })
    }
  }

  return NextResponse.json({ ok: true, processed: jobs.length, jobs }, { status: 200 })
}

export async function GET(request: Request) {
  return run(request)
}

export async function POST(request: Request) {
  return run(request)
}
