import type { SupabaseClient } from "@supabase/supabase-js"
import { DATABASE } from "@/src/config"

type ConnectionRow = {
  user_id: string
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  provider_email: string | null
  zoom_user_id: string | null
}

function basicAuthHeader() {
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error("Missing Zoom OAuth credentials")
  return "Basic " + btoa(`${clientId}:${clientSecret}`)
}

async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams()
  body.set("grant_type", "refresh_token")
  body.set("refresh_token", refreshToken)

  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`zoom_refresh_failed: ${text.slice(0, 500)}`)
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

export async function getZoomAccessTokenForUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_ZOOM_CONNECTIONS)
    .select("user_id, access_token, refresh_token, expires_at, provider_email, zoom_user_id")
    .eq("user_id", userId)
    .maybeSingle<ConnectionRow>()

  if (error) throw new Error(error.message)
  if (!data?.refresh_token) throw new Error("Zoom no conectado")

  const now = Date.now()
  const expiresAtMs = data.expires_at ? new Date(data.expires_at).getTime() : 0
  const isTokenValid = !!data.access_token && expiresAtMs - now > 30_000

  if (isTokenValid && data.access_token) {
    return {
      accessToken: data.access_token,
      providerEmail: data.provider_email ?? null,
      zoomUserId: data.zoom_user_id ?? null,
    }
  }

  const refreshed = await refreshAccessToken(data.refresh_token)

  await supabase
    .from(DATABASE.TABLES.WS_ZOOM_CONNECTIONS)
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
    zoomUserId: data.zoom_user_id ?? null,
  }
}
