import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 })

  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_SCHEDULED_EMAILS)
    .update({ status: "cancelled", processed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["pending", "processing"])
    .select("id,status")
    .maybeSingle()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ ok: false, error: "No se pudo cancelar" }, { status: 400 })
  return NextResponse.json({ ok: true, scheduled: data }, { status: 200 })
}
