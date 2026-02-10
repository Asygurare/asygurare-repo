import type { SupabaseClient } from "@supabase/supabase-js"
import { DATABASE } from "@/src/config"

type ConnectionRow = {
  user_id: string
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  provider_email: string | null
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.GMAIL_CLIENT_ID
  if (!clientId) throw new Error("Missing GMAIL_CLIENT_ID")

  const body = new URLSearchParams()
  body.set("client_id", clientId)
  if (process.env.GMAIL_CLIENT_SECRET) body.set("client_secret", process.env.GMAIL_CLIENT_SECRET)
  body.set("refresh_token", refreshToken)
  body.set("grant_type", "refresh_token")

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`refresh_failed: ${text.slice(0, 500)}`)
  }

  const json = (await res.json()) as {
    access_token: string
    expires_in: number
    scope?: string
    token_type?: string
  }

  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    scope: json.scope ?? null,
    tokenType: json.token_type ?? null,
  }
}

export async function getGmailAccessTokenForUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_GMAIL_CONNECTIONS)
    .select("user_id, access_token, refresh_token, expires_at, provider_email")
    .eq("user_id", userId)
    .maybeSingle<ConnectionRow>()

  if (error) throw new Error(error.message)
  if (!data?.refresh_token) throw new Error("Gmail no conectado")

  const now = Date.now()
  const expiresAtMs = data.expires_at ? new Date(data.expires_at).getTime() : 0
  const isTokenValid = !!data.access_token && expiresAtMs - now > 30_000

  if (isTokenValid && data.access_token) {
    return { accessToken: data.access_token, providerEmail: data.provider_email ?? null }
  }

  const refreshed = await refreshAccessToken(data.refresh_token)

  await supabase
    .from(DATABASE.TABLES.WS_GMAIL_CONNECTIONS)
    .update({
      access_token: refreshed.accessToken,
      expires_at: refreshed.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)

  return { accessToken: refreshed.accessToken, providerEmail: data.provider_email ?? null }
}

