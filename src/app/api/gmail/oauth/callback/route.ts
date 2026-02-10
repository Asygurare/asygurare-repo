import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"
import { decodeJwtPayload } from "@/src/lib/utils/pkce"

export const runtime = "edge"

type TokenResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope?: string
  token_type?: string
  id_token?: string
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const returnedState = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  const origin = url.origin
  const redirectTo = new URL("/automatizaciones", origin)

  if (error) {
    redirectTo.searchParams.set("gmail", "error")
    redirectTo.searchParams.set("reason", error)
    return NextResponse.redirect(redirectTo)
  }

  if (!code || !returnedState) {
    redirectTo.searchParams.set("gmail", "error")
    redirectTo.searchParams.set("reason", "missing_code_or_state")
    return NextResponse.redirect(redirectTo)
  }

  const clientId = process.env.GMAIL_CLIENT_ID
  if (!clientId) {
    redirectTo.searchParams.set("gmail", "error")
    redirectTo.searchParams.set("reason", "missing_client_id")
    return NextResponse.redirect(redirectTo)
  }

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

  const expectedState = cookies["gmail_oauth_state"]
  const codeVerifier = cookies["gmail_oauth_verifier"]

  if (!expectedState || !codeVerifier || expectedState !== returnedState) {
    redirectTo.searchParams.set("gmail", "error")
    redirectTo.searchParams.set("reason", "invalid_state")
    return NextResponse.redirect(redirectTo)
  }

  const redirectUri = `${origin}/api/gmail/oauth/callback`

  const body = new URLSearchParams()
  body.set("client_id", clientId)
  if (process.env.GMAIL_CLIENT_SECRET) body.set("client_secret", process.env.GMAIL_CLIENT_SECRET)
  body.set("code", code)
  body.set("code_verifier", codeVerifier)
  body.set("redirect_uri", redirectUri)
  body.set("grant_type", "authorization_code")

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "")
    redirectTo.searchParams.set("gmail", "error")
    redirectTo.searchParams.set("reason", "token_exchange_failed")
    if (text) redirectTo.searchParams.set("detail", text.slice(0, 500))
    return NextResponse.redirect(redirectTo)
  }

  const tokens = (await tokenRes.json()) as TokenResponse

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const login = new URL("/login", origin)
    login.searchParams.set("next", "/automatizaciones")
    return NextResponse.redirect(login)
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null

  const idPayload = tokens.id_token ? decodeJwtPayload(tokens.id_token) : null
  const providerEmail =
    (idPayload?.email as string | undefined) ||
    (idPayload?.preferred_username as string | undefined) ||
    null

  // Si Google no manda refresh_token (pasa cuando ya diste consentimiento antes),
  // preservamos el refresh_token ya guardado.
  const { data: existing } = await supabase
    .from(DATABASE.TABLES.WS_GMAIL_CONNECTIONS)
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle<{ refresh_token: string | null }>()

  const refreshToken = tokens.refresh_token ?? existing?.refresh_token ?? null

  const { error: upsertError } = await supabase
    .from(DATABASE.TABLES.WS_GMAIL_CONNECTIONS)
    .upsert(
      {
        user_id: user.id,
        provider: "google",
        provider_email: providerEmail,
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
    redirectTo.searchParams.set("gmail", "error")
    redirectTo.searchParams.set("reason", "db_upsert_failed")
    redirectTo.searchParams.set("detail", upsertError.message.slice(0, 200))
    return NextResponse.redirect(redirectTo)
  }

  const res = NextResponse.redirect(
    new URL("/automatizaciones?gmail=connected", origin)
  )
  // Limpieza cookies PKCE
  const isSecure = url.protocol === "https:" || process.env.NODE_ENV === "production"
  const clearCookie = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/api/gmail/oauth/callback",
  }
  res.cookies.set("gmail_oauth_state", "", clearCookie)
  res.cookies.set("gmail_oauth_verifier", "", clearCookie)
  return res
}

