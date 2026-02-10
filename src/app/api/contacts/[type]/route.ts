import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

type Contact = {
  id: string
  name?: string | null
  last_name?: string | null
  email?: string | null
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ type: string }> }
) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  const { type } = await ctx.params
  const isLeads = type === "prospectos"
  const isCustomers = type === "clientes"
  if (!isLeads && !isCustomers) {
    return NextResponse.json({ ok: false, error: "type inválido" }, { status: 400 })
  }

  const table = isLeads ? DATABASE.TABLES.WS_LEADS : DATABASE.TABLES.WS_CUSTOMERS_2
  const select = isLeads ? "id,name,last_name,email,updated_at" : "id,name,last_name,email,created_at"

  const { data, error } = await supabase
    .from(table)
    .select(select)
    .eq("user_id", user.id)
    .limit(500)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const rows = ((data as Contact[]) || []).filter((r) => !!r.email)
  return NextResponse.json({ ok: true, contacts: rows }, { status: 200, headers: { "Cache-Control": "no-store" } })
}

