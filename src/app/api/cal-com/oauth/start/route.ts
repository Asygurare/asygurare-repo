import { NextResponse } from "next/server"
import { randomBase64UrlString } from "@/src/lib/utils/pkce"

export const runtime = "edge"

function getCalComRedirectUri(reqUrl: URL) {
  const fromEnv = process.env.CALCOM_REDIRECT_URI?.trim()
  if (fromEnv) return fromEnv
  return `${reqUrl.origin}/api/cal-com/oauth/callback`
}

export async function GET(request: Request) {
  const clientId = process.env.CALCOM_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: "Missing CALCOM_CLIENT_ID" }, { status: 500 })
  }

  const reqUrl = new URL(request.url)
  const redirectUri = getCalComRedirectUri(reqUrl)
  const state = randomBase64UrlString(16)

  const authUrl = new URL("https://app.cal.com/auth/oauth2/authorize")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("state", state)

  const res = NextResponse.redirect(authUrl.toString())
  const isSecure = reqUrl.protocol === "https:" || process.env.NODE_ENV === "production"
  const cookieBase = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    maxAge: 10 * 60,
    path: "/api/cal-com/oauth/callback",
  }
  res.cookies.set("calcom_oauth_state", state, cookieBase)
  res.cookies.set("calcom_oauth_redirect_after", "/calendario", cookieBase)
  return res
}
