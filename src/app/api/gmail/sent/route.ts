import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  const url = new URL(request.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200)

  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_GMAIL_SENT_EMAILS)
    .select("id,to_email,subject,audience,gmail_message_id,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json(
    { ok: true, sent: (data as any[]) || [] },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  )
}

