import type { SupabaseClient } from "@supabase/supabase-js"
import { DATABASE } from "@/src/config"

type ConnectionRow = {
  user_id: string
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  provider_email: string | null
  calcom_user_id: string | null
  calcom_username: string | null
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.CALCOM_CLIENT_ID
  const clientSecret = process.env.CALCOM_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error("Missing Cal.com OAuth credentials")

  const body = JSON.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  })

  const res = await fetch("https://api.cal.com/v2/auth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`calcom_refresh_failed: ${text.slice(0, 500)}`)
  }

  const json = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type?: string
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    tokenType: json.token_type ?? null,
  }
}

export async function getCalComAccessTokenForUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_CALCOM_CONNECTIONS)
    .select("user_id, access_token, refresh_token, expires_at, provider_email, calcom_user_id, calcom_username")
    .eq("user_id", userId)
    .maybeSingle<ConnectionRow>()

  if (error) throw new Error(error.message)
  if (!data?.refresh_token) throw new Error("Cal.com no conectado")

  const now = Date.now()
  const expiresAtMs = data.expires_at ? new Date(data.expires_at).getTime() : 0
  const isTokenValid = !!data.access_token && expiresAtMs - now > 30_000

  if (isTokenValid && data.access_token) {
    return {
      accessToken: data.access_token,
      providerEmail: data.provider_email ?? null,
      calcomUserId: data.calcom_user_id ?? null,
      calcomUsername: data.calcom_username ?? null,
    }
  }

  const refreshed = await refreshAccessToken(data.refresh_token)

  await supabase
    .from(DATABASE.TABLES.WS_CALCOM_CONNECTIONS)
    .update({
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken,
      expires_at: refreshed.expiresAt,
      token_type: refreshed.tokenType,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)

  return {
    accessToken: refreshed.accessToken,
    providerEmail: data.provider_email ?? null,
    calcomUserId: data.calcom_user_id ?? null,
    calcomUsername: data.calcom_username ?? null,
  }
}
