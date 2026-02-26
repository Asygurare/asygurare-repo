import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ connected: false }, { status: 200 })
  }

  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_ZOOM_CONNECTIONS)
    .select("provider_email, zoom_user_id, updated_at, created_at")
    .eq("user_id", user.id)
    .maybeSingle<{
      provider_email: string | null
      zoom_user_id: string | null
      updated_at: string | null
      created_at: string | null
    }>()

  if (error) {
    return NextResponse.json({ connected: false, error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ connected: false }, { status: 200 })
  }

  return NextResponse.json(
    {
      connected: true,
      email: data.provider_email ?? null,
      zoom_user_id: data.zoom_user_id ?? null,
      updated_at: data.updated_at ?? null,
      created_at: data.created_at ?? null,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  )
}
