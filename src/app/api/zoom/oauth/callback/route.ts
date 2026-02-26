import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

function getZoomRedirectUri(url: URL) {
  const fromEnv = process.env.ZOOM_REDIRECT_URI?.trim()
  if (fromEnv) return fromEnv
  return `${url.origin}/api/zoom/oauth/callback`
}

type TokenResponse = {
  access_token: string
  token_type?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
}

type ZoomMeResponse = {
  id?: string
  email?: string
  first_name?: string
  last_name?: string
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const returnedState = url.searchParams.get("state")
  const error = url.searchParams.get("error")
  const origin = url.origin

  const cookieHeader = request.headers.get("cookie") || ""
  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const idx = c.indexOf("=")
        if (idx === -1) return [c, ""]
        return [c.slice(0, idx), decodeURIComponent(c.slice(idx + 1))]
      })
  )

  const redirectAfter = cookies["zoom_oauth_redirect_after"] || "/calendario"
  const redirectTo = new URL(redirectAfter, origin)

  if (error) {
    redirectTo.searchParams.set("zoom", "error")
    redirectTo.searchParams.set("reason", error)
    return NextResponse.redirect(redirectTo)
  }
  if (!code || !returnedState) {
    redirectTo.searchParams.set("zoom", "error")
    redirectTo.searchParams.set("reason", "missing_code_or_state")
    return NextResponse.redirect(redirectTo)
  }

  const expectedState = cookies["zoom_oauth_state"]
  if (!expectedState || expectedState !== returnedState) {
    redirectTo.searchParams.set("zoom", "error")
    redirectTo.searchParams.set("reason", "invalid_state")
    return NextResponse.redirect(redirectTo)
  }

  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    redirectTo.searchParams.set("zoom", "error")
    redirectTo.searchParams.set("reason", "missing_zoom_credentials")
    return NextResponse.redirect(redirectTo)
  }

  const redirectUri = getZoomRedirectUri(url)
  const body = new URLSearchParams()
  body.set("grant_type", "authorization_code")
  body.set("code", code)
  body.set("redirect_uri", redirectUri)

  const tokenRes = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
    },
    body,
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "")
    redirectTo.searchParams.set("zoom", "error")
    redirectTo.searchParams.set("reason", "token_exchange_failed")
    if (text) redirectTo.searchParams.set("detail", text.slice(0, 500))
    return NextResponse.redirect(redirectTo)
  }

  const tokens = (await tokenRes.json()) as TokenResponse

  const meRes = await fetch("https://api.zoom.us/v2/users/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store",
  })
  const meJson = (await meRes.json().catch(() => ({}))) as ZoomMeResponse
  const providerEmail = meJson.email ?? null
  const zoomUserId = meJson.id ?? null

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const login = new URL("/login", origin)
    login.searchParams.set("next", redirectAfter)
    return NextResponse.redirect(login)
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null

  const { data: existing } = await supabase
    .from(DATABASE.TABLES.WS_ZOOM_CONNECTIONS)
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle<{ refresh_token: string | null }>()

  const refreshToken = tokens.refresh_token ?? existing?.refresh_token ?? null
  const { error: upsertError } = await supabase
    .from(DATABASE.TABLES.WS_ZOOM_CONNECTIONS)
    .upsert(
      {
        user_id: user.id,
        provider: "zoom",
        provider_email: providerEmail,
        zoom_user_id: zoomUserId,
        scope: tokens.scope ?? null,
        token_type: tokens.token_type ?? null,
        access_token: tokens.access_token ?? null,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )

  if (upsertError) {
    redirectTo.searchParams.set("zoom", "error")
    redirectTo.searchParams.set("reason", "db_upsert_failed")
    redirectTo.searchParams.set("detail", upsertError.message.slice(0, 200))
    return NextResponse.redirect(redirectTo)
  }

  const successRedirect = new URL(redirectAfter, origin)
  successRedirect.searchParams.set("zoom", "connected")
  const res = NextResponse.redirect(successRedirect)

  const isSecure = url.protocol === "https:" || process.env.NODE_ENV === "production"
  const clearCookie = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/api/zoom/oauth/callback",
  }
  res.cookies.set("zoom_oauth_state", "", clearCookie)
  res.cookies.set("zoom_oauth_redirect_after", "", clearCookie)
  return res
}
