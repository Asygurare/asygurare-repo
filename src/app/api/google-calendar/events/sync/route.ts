import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { getGmailAccessTokenForUser } from "@/src/services/gmail/accessToken"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

type SyncPayload = {
  action: "upsert" | "delete"
  should_sync?: boolean
  task: {
    id: string
    title: string
    description?: string | null
    notes?: string | null
    due_at: string
    kind: string
  }
}

function hasCalendarScope(scope: string | null | undefined) {
  if (!scope) return false
  return (
    scope.includes("https://www.googleapis.com/auth/calendar") ||
    scope.includes("https://www.googleapis.com/auth/calendar.readonly") ||
    scope.includes("https://www.googleapis.com/auth/calendar.events")
  )
}

function normalizeDescription(description?: string | null, notes?: string | null) {
  const chunks = [description?.trim(), notes?.trim()].filter(Boolean)
  return chunks.length > 0 ? chunks.join("\n\n---\n\n") : undefined
}

async function findEventIdByTaskId(accessToken: string, taskId: string) {
  const params = new URLSearchParams()
  params.set("privateExtendedProperty", `asy_task_id=${taskId}`)
  params.set("maxResults", "1")
  params.set("singleEvents", "false")
  params.set("showDeleted", "false")

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`find_event_failed: ${text.slice(0, 500)}`)
  }
  const json = (await res.json()) as { items?: Array<{ id?: string }> }
  const id = json.items?.[0]?.id
  return id || null
}

async function deleteEventIfExists(accessToken: string, taskId: string) {
  const eventId = await findEventIdByTaskId(accessToken, taskId)
  if (!eventId) return { deleted: false }

  const delRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!delRes.ok && delRes.status !== 410 && delRes.status !== 404) {
    const text = await delRes.text().catch(() => "")
    throw new Error(`delete_event_failed: ${text.slice(0, 500)}`)
  }
  return { deleted: true, eventId }
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as SyncPayload | null
  if (!body?.action || !body?.task?.id) {
    return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 })
  }

  const { data: conn, error: connError } = await supabase
    .from(DATABASE.TABLES.WS_GMAIL_CONNECTIONS)
    .select("scope")
    .eq("user_id", user.id)
    .maybeSingle<{ scope: string | null }>()

  if (connError) {
    return NextResponse.json({ ok: false, error: connError.message }, { status: 500 })
  }
  if (!conn || !hasCalendarScope(conn.scope)) {
    return NextResponse.json({ ok: false, error: "calendar_not_connected" }, { status: 400 })
  }

  let accessToken: string
  try {
    const token = await getGmailAccessTokenForUser(supabase, user.id)
    accessToken = token.accessToken
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error obteniendo token de Google" },
      { status: 400 }
    )
  }

  const task = body.task

  try {
    if (body.action === "delete" || body.should_sync === false) {
      const deleted = await deleteEventIfExists(accessToken, task.id)
      return NextResponse.json(
        { ok: true, action: body.action === "delete" ? "delete" : "skip_sync", ...deleted },
        { status: 200 }
      )
    }

    const startDt = new Date(task.due_at)
    if (Number.isNaN(startDt.getTime())) {
      return NextResponse.json({ ok: false, error: "due_at inválido" }, { status: 400 })
    }
    const endDt = new Date(startDt.getTime() + 60 * 60 * 1000)
    const description = normalizeDescription(task.description, task.notes)

    const payload = {
      summary: task.title || "Evento Asygurare",
      description,
      start: { dateTime: startDt.toISOString() },
      end: { dateTime: endDt.toISOString() },
      extendedProperties: {
        private: {
          asy_task_id: task.id,
          source: "asygurare",
        },
      },
    }

    const existingEventId = await findEventIdByTaskId(accessToken, task.id)
    const method = existingEventId ? "PUT" : "POST"
    const url = existingEventId
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingEventId)}`
      : "https://www.googleapis.com/calendar/v3/calendars/primary/events"

    const googleRes = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!googleRes.ok) {
      const text = await googleRes.text().catch(() => "")
      throw new Error(`sync_event_failed: ${text.slice(0, 700)}`)
    }

    const event = (await googleRes.json()) as { id?: string; htmlLink?: string }
    return NextResponse.json(
      {
        ok: true,
        action: existingEventId ? "update" : "insert",
        event_id: event.id || null,
        html_link: event.htmlLink || null,
      },
      { status: 200 }
    )
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error sincronizando con Google Calendar" },
      { status: 502 }
    )
  }
}

