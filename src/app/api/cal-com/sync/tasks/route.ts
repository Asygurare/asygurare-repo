import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { getCalComAccessTokenForUser } from "@/src/services/calcom/accessToken"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

type CalComBooking = {
  id?: number
  uid?: string
  title?: string
  status?: string
  start?: string
  end?: string
  location?: string
  meetingUrl?: string
}

type CalComBookingsResponse = {
  status?: string
  data?: CalComBooking[]
}

type MappingRow = {
  booking_uid: string
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
    .from(DATABASE.TABLES.WS_CALCOM_CONNECTIONS)
    .select("provider_email")
    .eq("user_id", user.id)
    .maybeSingle<{ provider_email: string | null }>()

  if (connError) {
    return NextResponse.json({ ok: false, error: connError.message }, { status: 500 })
  }
  if (!conn) {
    return NextResponse.json({ ok: false, error: "calcom_not_connected" }, { status: 400 })
  }

  let accessToken: string
  try {
    const token = await getCalComAccessTokenForUser(supabase, user.id)
    accessToken = token.accessToken
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error obteniendo token de Cal.com" },
      { status: 400 }
    )
  }

  const params = new URLSearchParams()
  params.set("afterStart", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  params.set("take", String(max))
  params.set("sortStart", "asc")

  const calcomRes = await fetch(
    `https://api.cal.com/v2/bookings?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "cal-api-version": "2024-08-13",
      },
      cache: "no-store",
    }
  )

  if (!calcomRes.ok) {
    const text = await calcomRes.text().catch(() => "")
    return NextResponse.json(
      { ok: false, error: "calcom_api_failed", detail: text.slice(0, 600) },
      { status: 502 }
    )
  }

  const json = (await calcomRes.json()) as CalComBookingsResponse
  const bookings = (json.data ?? []).filter((b) => !!b.uid)
  const bookingUids = bookings.map((b) => b.uid as string)

  if (bookingUids.length === 0) {
    return NextResponse.json(
      { ok: true, created: 0, updated: 0, canceled: 0, total: 0 },
      { status: 200 }
    )
  }

  const { data: mappings, error: mapErr } = await supabase
    .from(DATABASE.TABLES.WS_CALCOM_EVENT_TASKS)
    .select("booking_uid, task_id")
    .eq("user_id", user.id)
    .in("booking_uid", bookingUids)

  if (mapErr) {
    return NextResponse.json({ ok: false, error: mapErr.message }, { status: 500 })
  }

  const mappingByBooking = new Map<string, MappingRow>(
    (mappings || []).map((m: { booking_uid: string; task_id: string }) => [m.booking_uid, m])
  )
  const mappedTaskIds = (mappings || []).map((m: { task_id: string }) => m.task_id).filter(Boolean)

  let tasksById = new Map<string, TaskRow>()
  if (mappedTaskIds.length > 0) {
    const { data: tasksData } = await supabase
      .from(DATABASE.TABLES.WS_TASKS)
      .select("id, status")
      .in("id", mappedTaskIds)
    tasksById = new Map<string, TaskRow>(
      ((tasksData || []) as { id: string; status: string }[]).map((t) => [
        String(t.id),
        { id: String(t.id), status: (t.status || "open") as "open" | "done" },
      ])
    )
  }

  let created = 0
  let updated = 0
  let canceled = 0

  for (const ev of bookings) {
    const bookingUid = ev.uid as string
    const title = ev.title || "Cita Cal.com"
    const start = ev.start
    if (!start) continue

    const mapping = mappingByBooking.get(bookingUid)
    const mappedTask = mapping ? tasksById.get(mapping.task_id) : null
    const isCanceled = String(ev.status || "").toLowerCase() === "cancelled"

    if (isCanceled && mapping) {
      await supabase
        .from(DATABASE.TABLES.WS_TASKS)
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", mapping.task_id)
        .eq("user_id", user.id)

      await supabase
        .from(DATABASE.TABLES.WS_CALCOM_EVENT_TASKS)
        .update({ canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("booking_uid", bookingUid)

      canceled += 1
      continue
    }

    if (mapping && mappedTask) {
      await supabase
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

      await supabase
        .from(DATABASE.TABLES.WS_CALCOM_EVENT_TASKS)
        .update({ canceled_at: null, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("booking_uid", bookingUid)

      updated += 1
      continue
    }

    const taskId = crypto.randomUUID()
    const now = new Date().toISOString()
    const joinUrl = ev.location ?? ev.meetingUrl ?? null
    const notesParts = [
      "Sincronizado automáticamente desde Cal.com.",
      `Booking: ${bookingUid}`,
      joinUrl ? `Join: ${joinUrl}` : null,
    ].filter(Boolean)

    const { error: createTaskErr } = await supabase.from(DATABASE.TABLES.WS_TASKS).insert({
      id: taskId,
      user_id: user.id,
      title,
      description: "Evento importado desde Cal.com",
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

    const { error: mapUpsertErr } = await supabase
      .from(DATABASE.TABLES.WS_CALCOM_EVENT_TASKS)
      .upsert(
        {
          user_id: user.id,
          booking_uid: bookingUid,
          task_id: taskId,
          canceled_at: null,
          updated_at: now,
        },
        { onConflict: "user_id,booking_uid" }
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
      total: bookings.length,
    },
    { status: 200 }
  )
}
