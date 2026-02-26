import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"
import { getZoomAccessTokenForUser } from "@/src/services/zoom/accessToken"

export const runtime = "edge"

type ZoomMeeting = {
  id?: number
  uuid?: string
  topic?: string
  type?: number
  start_time?: string
  duration?: number
  timezone?: string
  join_url?: string
  status?: string
}

type ZoomMeetingsResponse = {
  meetings?: ZoomMeeting[]
}

type MappingRow = {
  meeting_id: string
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

  let accessToken: string
  try {
    const token = await getZoomAccessTokenForUser(supabase, user.id)
    accessToken = token.accessToken
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error obteniendo token de Zoom" },
      { status: 400 }
    )
  }

  const params = new URLSearchParams()
  params.set("type", "upcoming")
  params.set("page_size", String(max))

  const zoomRes = await fetch(`https://api.zoom.us/v2/users/me/meetings?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!zoomRes.ok) {
    const text = await zoomRes.text().catch(() => "")
    return NextResponse.json({ ok: false, error: "zoom_api_failed", detail: text.slice(0, 600) }, { status: 502 })
  }

  const json = (await zoomRes.json()) as ZoomMeetingsResponse
  const meetings = (json.meetings || []).filter((m) => !!m.id)
  const meetingIds = meetings.map((m) => String(m.id))
  if (meetingIds.length === 0) {
    return NextResponse.json({ ok: true, created: 0, updated: 0, canceled: 0, total: 0 }, { status: 200 })
  }

  const { data: mappings, error: mapErr } = await supabase
    .from(DATABASE.TABLES.WS_ZOOM_EVENT_TASKS)
    .select("meeting_id, task_id")
    .eq("user_id", user.id)
    .in("meeting_id", meetingIds)

  if (mapErr) {
    return NextResponse.json({ ok: false, error: mapErr.message }, { status: 500 })
  }

  const mappingByMeeting = new Map<string, MappingRow>((mappings || []).map((m: any) => [m.meeting_id, m]))
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

  for (const meeting of meetings) {
    const meetingId = String(meeting.id)
    const title = meeting.topic || "Reunión Zoom"
    const start = meeting.start_time
    if (!start) continue

    const mapping = mappingByMeeting.get(meetingId)
    const mappedTask = mapping ? tasksById.get(mapping.task_id) : null

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
        .from(DATABASE.TABLES.WS_ZOOM_EVENT_TASKS)
        .update({ canceled_at: null, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("meeting_id", meetingId)

      updated += 1
      continue
    }

    const taskId = crypto.randomUUID()
    const now = new Date().toISOString()
    const joinUrl = meeting.join_url || null
    const notesParts = [
      "Sincronizado automáticamente desde Zoom.",
      `Meeting ID: ${meetingId}`,
      joinUrl ? `Join: ${joinUrl}` : null,
    ].filter(Boolean)

    const { error: createTaskErr } = await supabase.from(DATABASE.TABLES.WS_TASKS).insert({
      id: taskId,
      user_id: user.id,
      title,
      description: "Reunión importada desde Zoom",
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

    const { error: mapUpsertErr } = await supabase.from(DATABASE.TABLES.WS_ZOOM_EVENT_TASKS).upsert(
      {
        user_id: user.id,
        meeting_id: meetingId,
        task_id: taskId,
        canceled_at: null,
        updated_at: now,
      },
      { onConflict: "user_id,meeting_id" }
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
      total: meetings.length,
    },
    { status: 200 }
  )
}
