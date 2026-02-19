import { NextResponse } from "next/server"
import { randomBase64UrlString } from "@/src/lib/utils/pkce"

export const runtime = "edge"

function getCalendlyRedirectUri(reqUrl: URL) {
  const fromEnv = process.env.CALENDLY_REDIRECT_URI?.trim()
  if (fromEnv) return fromEnv
  return `${reqUrl.origin}/api/calendly/oauth/callback`
}

export async function GET(request: Request) {
  const clientId = process.env.CALENDLY_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: "Missing CALENDLY_CLIENT_ID" }, { status: 500 })
  }

  const reqUrl = new URL(request.url)
  const redirectUri = getCalendlyRedirectUri(reqUrl)
  const state = randomBase64UrlString(16)

  const authUrl = new URL("https://auth.calendly.com/oauth/authorize")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("state", state)

  const res = NextResponse.redirect(authUrl.toString())
  const isSecure = reqUrl.protocol === "https:" || process.env.NODE_ENV === "production"
  const cookieBase = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    maxAge: 10 * 60,
    path: "/api/calendly/oauth/callback",
  }
  res.cookies.set("calendly_oauth_state", state, cookieBase)
  res.cookies.set("calendly_oauth_redirect_after", "/calendario", cookieBase)
  return res
}

