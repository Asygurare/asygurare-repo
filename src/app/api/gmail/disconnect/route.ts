import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

export async function POST() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_GMAIL_CONNECTIONS)
    .select("access_token, refresh_token")
    .eq("user_id", user.id)
    .maybeSingle<{ access_token: string | null; refresh_token: string | null }>()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const tokenToRevoke = data?.refresh_token || data?.access_token || null
  if (tokenToRevoke) {
    const body = new URLSearchParams()
    body.set("token", tokenToRevoke)
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }).catch(() => null)
  }

  const { error: delError } = await supabase
    .from(DATABASE.TABLES.WS_GMAIL_CONNECTIONS)
    .delete()
    .eq("user_id", user.id)

  if (delError) {
    return NextResponse.json({ ok: false, error: delError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

