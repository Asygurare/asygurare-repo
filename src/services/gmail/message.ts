function base64UrlEncodeUtf8(input: string) {
  const bytes = new TextEncoder().encode(input)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  const base64 = btoa(binary)
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function base64EncodeUtf8(input: string) {
  const bytes = new TextEncoder().encode(input)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary) // mantiene padding
}

function encodeSubject(subject: string) {
  // RFC 2047 encoded-word (UTF-8 Base64) para soportar acentos/UTF-8.
  return `=?UTF-8?B?${base64EncodeUtf8(subject)}?=`
}

export function buildRawMessage({
  from,
  to,
  subject,
  html,
  text,
}: {
  from?: string | null
  to: string
  subject: string
  html?: string
  text?: string
}) {
  const contentType = html
    ? 'text/html; charset="UTF-8"'
    : 'text/plain; charset="UTF-8"'
  const body = html ?? text ?? ""

  const lines = [
    ...(from ? [`From: ${from}`] : []),
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: ${contentType}`,
    "Content-Transfer-Encoding: 7bit",
    "",
    body,
  ]

  return base64UrlEncodeUtf8(lines.join("\r\n"))
}

