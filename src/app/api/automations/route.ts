import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"
import { DEFAULT_AUTOMATIONS, isAutomationKey, type AutomationKey } from "@/src/services/automations/config"

export const runtime = "edge"

type UpsertBody = {
  key?: string
  enabled?: boolean
  config?: Record<string, unknown>
}

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_AUTOMATIONS)
    .select("key,enabled,config")
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const byKey = new Map<string, { key: AutomationKey; enabled: boolean; config: Record<string, unknown> }>()
  ;(data || []).forEach((row: any) => {
    if (isAutomationKey(String(row.key || ""))) {
      byKey.set(String(row.key), {
        key: row.key,
        enabled: Boolean(row.enabled),
        config: (row.config as Record<string, unknown>) || {},
      })
    }
  })

  const automations = DEFAULT_AUTOMATIONS.map((base) => byKey.get(base.key) || base)
  return NextResponse.json({ ok: true, automations }, { status: 200 })
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  let body: UpsertBody
  try {
    body = (await request.json()) as UpsertBody
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 })
  }

  if (!body.key || !isAutomationKey(body.key)) {
    return NextResponse.json({ ok: false, error: "key inválido" }, { status: 400 })
  }

  const payload = {
    user_id: user.id,
    key: body.key,
    enabled: body.enabled === true,
    config: (body.config || {}) as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_AUTOMATIONS)
    .upsert([payload], { onConflict: "user_id,key" })
    .select("key,enabled,config")
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, automation: data }, { status: 200 })
}
