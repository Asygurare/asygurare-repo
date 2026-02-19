import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

type SignatureLink = {
  label: string
  url: string
}

type SignatureBody = {
  signature_name?: string | null
  include_signature?: boolean
  logo_path?: string | null
  logo_url?: string | null
  phone?: string | null
  footer_text?: string | null
  links?: SignatureLink[]
}

function sanitizeLinks(links: unknown): SignatureLink[] {
  if (!Array.isArray(links)) return []
  return links
    .map((item) => {
      const label = String((item as SignatureLink)?.label ?? "").trim()
      const url = String((item as SignatureLink)?.url ?? "").trim()
      if (!label || !url) return null
      return { label, url }
    })
    .filter((x): x is SignatureLink => !!x)
}

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_EMAIL_SIGNATURES)
    .select("signature_name,include_signature,logo_path,logo_url,phone,footer_text,links,updated_at")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, signature: data ?? null }, { status: 200 })
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  let body: SignatureBody
  try {
    body = (await request.json()) as SignatureBody
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 })
  }

  const signatureName = String(body.signature_name ?? "Tu firma de correo").trim() || "Tu firma de correo"
  const includeSignature = body.include_signature !== false
  const logoPath = body.logo_path ? String(body.logo_path).trim() : null
  const logoUrl = body.logo_url ? String(body.logo_url).trim() : null
  const phone = body.phone ? String(body.phone).trim() : null
  const footerText = body.footer_text ? String(body.footer_text).trim() : null
  const links = sanitizeLinks(body.links)

  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_EMAIL_SIGNATURES)
    .upsert(
      [
        {
          user_id: user.id,
          signature_name: signatureName,
          include_signature: includeSignature,
          logo_path: logoPath,
          logo_url: logoUrl,
          phone,
          footer_text: footerText,
          links,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "user_id" }
    )
    .select("signature_name,include_signature,logo_path,logo_url,phone,footer_text,links,updated_at")
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, signature: data }, { status: 200 })
}
