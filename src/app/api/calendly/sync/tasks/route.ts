import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"
import { getCalendlyAccessTokenForUser } from "@/src/services/calendly/accessToken"

export const runtime = "edge"

type CalendlyEventsResponse = {
  collection?: Array<{
    uri?: string
    name?: string
    status?: string
    start_time?: string
    end_time?: string
    event_type?: string
    location?: {
      type?: string
      location?: string
      join_url?: string
      status?: string
    }
  }>
}

type MappingRow = {
  event_uri: string
  task_id: string
}

type TaskRow = {
  id: string
  status: "open" | "done"
}

export async function POST(request: Request) {
  const reqUrl = new URL(request.url)
  const max = Math.max(1, Math.min(100, Number(reqUrl.searchParams.get("max") || 50)))

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  }

  const { data: conn, error: connError } = await supabase
    .from(DATABASE.TABLES.WS_CALENDLY_CONNECTIONS)
    .select("calendly_user_uri, organization_uri")
    .eq("user_id", user.id)
    .maybeSingle<{ calendly_user_uri: string | null; organization_uri: string | null }>()

  if (connError) {
    return NextResponse.json({ ok: false, error: connError.message }, { status: 500 })
  }
  if (!conn) {
    return NextResponse.json({ ok: false, error: "calendly_not_connected" }, { status: 400 })
  }

  let accessToken: string
  let calendlyUserUri: string | null
  try {
    const token = await getCalendlyAccessTokenForUser(supabase, user.id)
    accessToken = token.accessToken
    calendlyUserUri = token.calendlyUserUri ?? conn.calendly_user_uri
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error obteniendo token de Calendly" },
      { status: 400 }
    )
  }

  const params = new URLSearchParams()
  params.set("min_start_time", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  params.set("count", String(max))
  params.set("sort", "start_time:asc")
  if (calendlyUserUri) params.set("user", calendlyUserUri)
  else if (conn.organization_uri) params.set("organization", conn.organization_uri)

  const calendlyRes = await fetch(`https://api.calendly.com/scheduled_events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!calendlyRes.ok) {
    const text = await calendlyRes.text().catch(() => "")
    return NextResponse.json({ ok: false, error: "calendly_api_failed", detail: text.slice(0, 600) }, { status: 502 })
  }

  const json = (await calendlyRes.json()) as CalendlyEventsResponse
  const events = (json.collection || []).filter((e) => !!e.uri)
  const eventUris = events.map((e) => e.uri as string)
  if (eventUris.length === 0) {
    return NextResponse.json({ ok: true, created: 0, updated: 0, canceled: 0, total: 0 }, { status: 200 })
  }

  const { data: mappings, error: mapErr } = await supabase
    .from(DATABASE.TABLES.WS_CALENDLY_EVENT_TASKS)
    .select("event_uri, task_id")
    .eq("user_id", user.id)
    .in("event_uri", eventUris)

  if (mapErr) {
    return NextResponse.json({ ok: false, error: mapErr.message }, { status: 500 })
  }

  const mappingByEvent = new Map<string, MappingRow>((mappings || []).map((m: any) => [m.event_uri, m]))
  const mappedTaskIds = (mappings || []).map((m: any) => m.task_id).filter(Boolean)

  let tasksById = new Map<string, TaskRow>()
  if (mappedTaskIds.length > 0) {
    const { data: tasksData } = await supabase
      .from(DATABASE.TABLES.WS_TASKS)
      .select("id, status")
      .in("id", mappedTaskIds)
    tasksById = new Map<string, TaskRow>(((tasksData || []) as any[]).map((t) => [String(t.id), { id: String(t.id), status: (t.status || "open") as "open" | "done" }]))
  }

  let created = 0
  let updated = 0
  let canceled = 0

  for (const ev of events) {
    const eventUri = ev.uri as string
    const title = ev.name || "Cita Calendly"
    const start = ev.start_time
    if (!start) continue

    const mapping = mappingByEvent.get(eventUri)
    const mappedTask = mapping ? tasksById.get(mapping.task_id) : null
    const isCanceled = String(ev.status || "").toLowerCase() === "canceled"

    if (isCanceled && mapping) {
      const { error: updateTaskErr } = await supabase
        .from(DATABASE.TABLES.WS_TASKS)
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", mapping.task_id)
        .eq("user_id", user.id)
      if (updateTaskErr) continue

      await supabase
        .from(DATABASE.TABLES.WS_CALENDLY_EVENT_TASKS)
        .update({ canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("event_uri", eventUri)

      canceled += 1
      continue
    }

    if (mapping && mappedTask) {
      const { error: updErr } = await supabase
        .from(DATABASE.TABLES.WS_TASKS)
        .update({
          title,
          due_at: start,
          kind: "Cita",
          status: mappedTask.status === "done" ? "done" : "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", mapping.task_id)
        .eq("user_id", user.id)
      if (updErr) continue

      await supabase
        .from(DATABASE.TABLES.WS_CALENDLY_EVENT_TASKS)
        .update({ canceled_at: null, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("event_uri", eventUri)

      updated += 1
      continue
    }

    const taskId = crypto.randomUUID()
    const now = new Date().toISOString()
    const joinUrl = ev.location?.join_url || null
    const notesParts = [
      "Sincronizado automáticamente desde Calendly.",
      `Evento: ${eventUri}`,
      joinUrl ? `Join: ${joinUrl}` : null,
    ].filter(Boolean)

    const { error: createTaskErr } = await supabase.from(DATABASE.TABLES.WS_TASKS).insert({
      id: taskId,
      user_id: user.id,
      title,
      description: "Evento importado desde Calendly",
      notes: notesParts.join("\n"),
      kind: "Cita",
      priority: "Media",
      status: "open",
      due_at: start,
      completed_at: null,
      entity_type: "none",
      entity_id: null,
      created_at: now,
      updated_at: now,
    })
    if (createTaskErr) continue

    const { error: mapUpsertErr } = await supabase.from(DATABASE.TABLES.WS_CALENDLY_EVENT_TASKS).upsert(
      {
        user_id: user.id,
        event_uri: eventUri,
        task_id: taskId,
        canceled_at: null,
        updated_at: now,
      },
      { onConflict: "user_id,event_uri" }
    )
    if (mapUpsertErr) continue
    created += 1
  }

  return NextResponse.json(
    {
      ok: true,
      created,
      updated,
      canceled,
      total: events.length,
    },
    { status: 200 }
  )
}

