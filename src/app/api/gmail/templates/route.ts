import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

type TemplateCategory = "temporal" | "asesor" | "seguimiento" | "propuesta" | "otro"
type TemplateTag = "prospectos" | "clientes" | "polizas" | "cumpleaños" | "eventos" | "personalizar"

type EmailTemplate = {
  id: string
  name: string
  category: TemplateCategory
  subject: string
  html: string | null
  text: string | null
  attachments: Array<{ name: string; url: string; path: string; mime_type: string }>
  tag_label?: TemplateTag | null
  tag_color?: string | null
  tag_custom_label?: string | null
  is_system: boolean
}

type CreateTemplateBody = {
  name?: string
  category?: TemplateCategory
  subject?: string
  html?: string
  text?: string
  attachments?: Array<{ name?: string; url?: string; path?: string; mime_type?: string }>
  tag_label?: TemplateTag
  tag_color?: string
  tag_custom_label?: string
}

type TemplateAttachment = { name: string; url: string; path: string; mime_type: string }

function isMissingTemplateColumn(error: unknown) {
  const code = String((error as any)?.code ?? "")
  const message = String((error as any)?.message ?? "").toLowerCase()
  return (
    code === "42703" ||
    message.includes("attachments") ||
    message.includes("tag_label") ||
    message.includes("tag_color") ||
    message.includes("tag_custom_label")
  )
}

function sanitizeAttachments(input: unknown): TemplateAttachment[] {
  if (!Array.isArray(input)) return []
  return input
    .slice(0, 2)
    .map((item) => {
      const name = String((item as any)?.name ?? "").trim()
      const url = String((item as any)?.url ?? "").trim()
      const path = String((item as any)?.path ?? "").trim()
      const mime_type = String((item as any)?.mime_type ?? "application/octet-stream").trim()
      if (!name || !url || !path) return null
      return { name, url, path, mime_type }
    })
    .filter((x): x is TemplateAttachment => !!x)
}

function normalizeTag(input: unknown): TemplateTag {
  const value = String(input ?? "").trim().toLowerCase()
  if (
    value === "prospectos" ||
    value === "clientes" ||
    value === "polizas" ||
    value === "cumpleanos" ||
    value === "eventos" ||
    value === "personalizar"
  ) {
    return value as TemplateTag
  }
  return "prospectos"
}

function defaultTagColor(tag: TemplateTag) {
  if (tag === "prospectos") return "#93c5fd"
  if (tag === "clientes") return "#86efac"
  if (tag === "polizas") return "#fca5a5"
  if (tag === "cumpleaños") return "#f9a8d4"
  if (tag === "eventos") return "#c4b5fd"
  return "#a3a3a3"
}



export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  let data: any[] | null = null
  {
    const res = await supabase
      .from(DATABASE.TABLES.WS_EMAIL_TEMPLATES)
      .select("id,name,category,subject,html,text,attachments,tag_label,tag_color,tag_custom_label")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (!res.error) data = (res.data as any[]) ?? []
    else if (isMissingTemplateColumn(res.error)) {
      const legacyRes = await supabase
        .from(DATABASE.TABLES.WS_EMAIL_TEMPLATES)
        .select("id,name,category,subject,html,text")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
      if (legacyRes.error) return NextResponse.json({ ok: false, error: legacyRes.error.message }, { status: 500 })
      data = ((legacyRes.data as any[]) ?? []).map((row) => ({
        ...row,
        attachments: [],
        tag_label: "prospectos",
        tag_color: defaultTagColor("prospectos"),
        tag_custom_label: null,
      }))
    } else {
      return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 })
    }
  }

  const customTemplates: EmailTemplate[] = (((data as any[]) ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? "Template"),
    category: (row.category ?? "otro") as TemplateCategory,
    subject: String(row.subject ?? ""),
    html: typeof row.html === "string" ? row.html : null,
    text: typeof row.text === "string" ? row.text : null,
    attachments: sanitizeAttachments(row.attachments),
    tag_label: normalizeTag(row.tag_label),
    tag_color:
      typeof row.tag_color === "string" && row.tag_color.trim()
        ? row.tag_color
        : defaultTagColor(normalizeTag(row.tag_label)),
    tag_custom_label: typeof row.tag_custom_label === "string" ? row.tag_custom_label : null,
    is_system: false,
  })) as EmailTemplate[])

  return NextResponse.json({ ok: true, templates: [ ...customTemplates] }, { status: 200 })
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  let body: CreateTemplateBody
  try {
    body = (await request.json()) as CreateTemplateBody
  } catch {
    return NextResponse.json({ ok: false, error: "Body invalido" }, { status: 400 })
  }

  const name = String(body.name ?? "").trim()
  const category = (body.category ?? "otro") as TemplateCategory
  const subject = String(body.subject ?? "").trim()
  const html = typeof body.html === "string" ? body.html : ""
  const text = typeof body.text === "string" ? body.text : ""
  const attachments = sanitizeAttachments(body.attachments)
  const tag_label = normalizeTag(body.tag_label)
  const tag_color = String(body.tag_color ?? defaultTagColor(tag_label)).trim() || defaultTagColor(tag_label)
  const tag_custom_label = body.tag_custom_label ? String(body.tag_custom_label).trim() : null

  if (!name) return NextResponse.json({ ok: false, error: "name requerido" }, { status: 400 })
  if (!subject) return NextResponse.json({ ok: false, error: "subject requerido" }, { status: 400 })
  if (!html.trim() && !text.trim()) {
    return NextResponse.json({ ok: false, error: "html o text requerido" }, { status: 400 })
  }

  let data: any = null
  {
    const res = await supabase
      .from(DATABASE.TABLES.WS_EMAIL_TEMPLATES)
      .insert([
        {
          user_id: user.id,
          name,
          category,
          subject,
          html: html || null,
          text: text || null,
          attachments,
          tag_label,
          tag_color,
          tag_custom_label,
        },
      ])
      .select("id,name,category,subject,html,text,attachments,tag_label,tag_color,tag_custom_label")
      .single()

    if (!res.error) data = res.data
    else if (isMissingTemplateColumn(res.error)) {
      const legacyRes = await supabase
        .from(DATABASE.TABLES.WS_EMAIL_TEMPLATES)
        .insert([
          {
            user_id: user.id,
            name,
            category,
            subject,
            html: html || null,
            text: text || null,
          },
        ])
        .select("id,name,category,subject,html,text")
        .single()
      if (legacyRes.error) return NextResponse.json({ ok: false, error: legacyRes.error.message }, { status: 500 })
      data = {
        ...legacyRes.data,
        attachments: [],
        tag_label,
        tag_color,
        tag_custom_label,
      }
    } else {
      return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true, template: data }, { status: 201 })
}
