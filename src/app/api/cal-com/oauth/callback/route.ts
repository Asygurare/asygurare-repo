import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

function getCalComRedirectUri(url: URL) {
  const fromEnv = process.env.CALCOM_REDIRECT_URI?.trim()
  if (fromEnv) return fromEnv
  return `${url.origin}/api/cal-com/oauth/callback`
}

type TokenResponse = {
  access_token: string
  token_type?: string
  refresh_token?: string
  expires_in?: number
}

type CalComMeResponse = {
  user?: {
    id?: number
    email?: string
    username?: string
  }
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

  const redirectAfter = cookies["calcom_oauth_redirect_after"] || "/calendario"
  const redirectTo = new URL(redirectAfter, origin)

  if (error) {
    redirectTo.searchParams.set("calcom", "error")
    redirectTo.searchParams.set("reason", error)
    return NextResponse.redirect(redirectTo)
  }
  if (!code || !returnedState) {
    redirectTo.searchParams.set("calcom", "error")
    redirectTo.searchParams.set("reason", "missing_code_or_state")
    return NextResponse.redirect(redirectTo)
  }

  const expectedState = cookies["calcom_oauth_state"]
  if (!expectedState || expectedState !== returnedState) {
    redirectTo.searchParams.set("calcom", "error")
    redirectTo.searchParams.set("reason", "invalid_state")
    return NextResponse.redirect(redirectTo)
  }

  const clientId = process.env.CALCOM_CLIENT_ID
  const clientSecret = process.env.CALCOM_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    redirectTo.searchParams.set("calcom", "error")
    redirectTo.searchParams.set("reason", "missing_calcom_credentials")
    return NextResponse.redirect(redirectTo)
  }

  const redirectUri = getCalComRedirectUri(url)
  const body = JSON.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  })

  const tokenRes = await fetch("https://api.cal.com/v2/auth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "")
    redirectTo.searchParams.set("calcom", "error")
    redirectTo.searchParams.set("reason", "token_exchange_failed")
    if (text) redirectTo.searchParams.set("detail", text.slice(0, 500))
    return NextResponse.redirect(redirectTo)
  }

  const tokens = (await tokenRes.json()) as TokenResponse
  const meRes = await fetch("https://api.cal.com/v2/me", {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "cal-api-version": "2024-08-13",
    },
    cache: "no-store",
  })
  const meJson = (await meRes.json().catch(() => ({}))) as CalComMeResponse
  const providerEmail = meJson.user?.email ?? null
  const calcomUserId = meJson.user?.id != null ? String(meJson.user.id) : null
  const calcomUsername = meJson.user?.username ?? null

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

  const { error: upsertError } = await supabase
    .from(DATABASE.TABLES.WS_CALCOM_CONNECTIONS)
    .upsert(
      {
        user_id: user.id,
        provider: "calcom",
        provider_email: providerEmail,
        calcom_user_id: calcomUserId,
        calcom_username: calcomUsername,
        token_type: tokens.token_type ?? null,
        access_token: tokens.access_token ?? null,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )

  if (upsertError) {
    redirectTo.searchParams.set("calcom", "error")
    redirectTo.searchParams.set("reason", "db_upsert_failed")
    redirectTo.searchParams.set("detail", upsertError.message.slice(0, 200))
    return NextResponse.redirect(redirectTo)
  }

  const successRedirect = new URL(redirectAfter, origin)
  successRedirect.searchParams.set("calcom", "connected")
  const res = NextResponse.redirect(successRedirect)

  const isSecure = url.protocol === "https:" || process.env.NODE_ENV === "production"
  const clearCookie = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/api/cal-com/oauth/callback",
  }
  res.cookies.set("calcom_oauth_state", "", clearCookie)
  res.cookies.set("calcom_oauth_redirect_after", "", clearCookie)
  return res
}
