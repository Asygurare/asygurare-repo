import type { SupabaseClient } from "@supabase/supabase-js"
import { DATABASE } from "@/src/config"

type ConnectionRow = {
  user_id: string
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  provider_email: string | null
  calendly_user_uri: string | null
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.CALENDLY_CLIENT_ID
  const clientSecret = process.env.CALENDLY_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error("Missing Calendly OAuth credentials")

  const body = new URLSearchParams()
  body.set("grant_type", "refresh_token")
  body.set("refresh_token", refreshToken)
  body.set("client_id", clientId)
  body.set("client_secret", clientSecret)

  const res = await fetch("https://auth.calendly.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`calendly_refresh_failed: ${text.slice(0, 500)}`)
  }

  const json = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope?: string
    token_type?: string
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    scope: json.scope ?? null,
    tokenType: json.token_type ?? null,
  }
}

export async function getCalendlyAccessTokenForUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_CALENDLY_CONNECTIONS)
    .select("user_id, access_token, refresh_token, expires_at, provider_email, calendly_user_uri")
    .eq("user_id", userId)
    .maybeSingle<ConnectionRow>()

  if (error) throw new Error(error.message)
  if (!data?.refresh_token) throw new Error("Calendly no conectado")

  const now = Date.now()
  const expiresAtMs = data.expires_at ? new Date(data.expires_at).getTime() : 0
  const isTokenValid = !!data.access_token && expiresAtMs - now > 30_000

  if (isTokenValid && data.access_token) {
    return {
      accessToken: data.access_token,
      providerEmail: data.provider_email ?? null,
      calendlyUserUri: data.calendly_user_uri ?? null,
    }
  }

  const refreshed = await refreshAccessToken(data.refresh_token)

  await supabase
    .from(DATABASE.TABLES.WS_CALENDLY_CONNECTIONS)
    .update({
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken,
      expires_at: refreshed.expiresAt,
      scope: refreshed.scope,
      token_type: refreshed.tokenType,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)

  return {
    accessToken: refreshed.accessToken,
    providerEmail: data.provider_email ?? null,
    calendlyUserUri: data.calendly_user_uri ?? null,
  }
}

