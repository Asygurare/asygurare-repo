function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  const base64 = btoa(binary)
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export function randomBase64UrlString(byteLength = 32) {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return base64UrlEncodeBytes(bytes)
}

export async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return base64UrlEncodeBytes(new Uint8Array(digest))
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".")
    if (parts.length < 2) return null
    const payload = parts[1]!
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64 + "===".slice((base64.length + 3) % 4)
    const json = atob(padded)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

