import { NextResponse } from "next/server"
import { randomBase64UrlString, sha256Base64Url } from "@/src/lib/utils/pkce"

export const runtime = "edge"

const BASE_SCOPES = [
  "openid",
  "email",
  "profile",
]

const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
]

export async function GET(request: Request) {
  const clientId = process.env.GMAIL_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: "Missing GMAIL_CLIENT_ID" }, { status: 500 })
  }

  const reqUrl = new URL(request.url)
  const origin = reqUrl.origin
  const redirectUri = `${origin}/api/gmail/oauth/callback`
  const service = reqUrl.searchParams.get("service") === "calendar" ? "calendar" : "gmail"

  const scopes = service === "calendar" ? [...BASE_SCOPES, ...CALENDAR_SCOPES] : [...BASE_SCOPES, ...GMAIL_SCOPES]
  const redirectAfter = service === "calendar" ? "/calendario" : "/email"
  const successParam = service === "calendar" ? "gcal" : "gmail"

  const state = randomBase64UrlString(16)
  const codeVerifier = randomBase64UrlString(48)
  const codeChallenge = await sha256Base64Url(codeVerifier)

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", scopes.join(" "))
  authUrl.searchParams.set("access_type", "offline")
  authUrl.searchParams.set("prompt", "consent")
  authUrl.searchParams.set("include_granted_scopes", "true")
  authUrl.searchParams.set("state", state)
  authUrl.searchParams.set("code_challenge", codeChallenge)
  authUrl.searchParams.set("code_challenge_method", "S256")

  const res = NextResponse.redirect(authUrl.toString())
  const isSecure = reqUrl.protocol === "https:" || process.env.NODE_ENV === "production"
  const cookieBase = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    maxAge: 10 * 60,
    path: "/api/gmail/oauth/callback",
  }
  res.cookies.set("gmail_oauth_state", state, cookieBase)
  res.cookies.set("gmail_oauth_verifier", codeVerifier, cookieBase)
  res.cookies.set("gmail_oauth_redirect_after", redirectAfter, cookieBase)
  res.cookies.set("gmail_oauth_success_param", successParam, cookieBase)
  return res
}

