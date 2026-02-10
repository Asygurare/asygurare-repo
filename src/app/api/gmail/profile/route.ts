import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { getGmailAccessTokenForUser } from "@/src/services/gmail/accessToken"

export const runtime = "edge"

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  let accessToken: string
  try {
    const token = await getGmailAccessTokenForUser(supabase, user.id)
    accessToken = token.accessToken
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error obteniendo token" },
      { status: 400 }
    )
  }

  const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })

  if (!gmailRes.ok) {
    const text = await gmailRes.text().catch(() => "")
    return NextResponse.json({ error: "gmail_api_failed", detail: text.slice(0, 500) }, { status: 502 })
  }

  const profile = await gmailRes.json()
  return NextResponse.json({ ok: true, profile }, { status: 200, headers: { "Cache-Control": "no-store" } })
}

