import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

type UpdateTemplateBody = {
  name?: string
  category?: "temporal" | "asesor" | "seguimiento" | "propuesta" | "otro"
  subject?: string
  html?: string
  text?: string
  attachments?: Array<{ name?: string; url?: string; path?: string; mime_type?: string }>
  tag_label?: "prospectos" | "clientes" | "polizas" | "cumpleanos" | "eventos" | "personalizar"
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

function normalizeTag(input: unknown) {
  const value = String(input ?? "").trim().toLowerCase()
  if (
    value === "prospectos" ||
    value === "clientes" ||
    value === "polizas" ||
    value === "cumpleanos" ||
    value === "eventos" ||
    value === "personalizar"
  ) {
    return value
  }
  return "prospectos"
}

function defaultTagColor(tag: string) {
  if (tag === "prospectos") return "#93c5fd"
  if (tag === "clientes") return "#86efac"
  if (tag === "polizas") return "#fca5a5"
  if (tag === "cumpleanos") return "#f9a8d4"
  if (tag === "eventos") return "#c4b5fd"
  return "#a3a3a3"
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  let body: UpdateTemplateBody
  try {
    body = (await request.json()) as UpdateTemplateBody
  } catch {
    return NextResponse.json({ ok: false, error: "Body invalido" }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.name === "string") patch.name = body.name.trim()
  if (typeof body.category === "string") patch.category = body.category
  if (typeof body.subject === "string") patch.subject = body.subject.trim()
  if (typeof body.html === "string") patch.html = body.html || null
  if (typeof body.text === "string") patch.text = body.text || null
  if (Array.isArray(body.attachments)) patch.attachments = sanitizeAttachments(body.attachments)
  if (typeof body.tag_label === "string") patch.tag_label = normalizeTag(body.tag_label)
  if (typeof body.tag_color === "string") patch.tag_color = body.tag_color.trim()
  if (typeof body.tag_custom_label === "string") patch.tag_custom_label = body.tag_custom_label.trim() || null
  if (patch.tag_label && !patch.tag_color) patch.tag_color = defaultTagColor(String(patch.tag_label))

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "Nada que actualizar" }, { status: 400 })
  }

  let data: any = null
  {
    const res = await supabase
      .from(DATABASE.TABLES.WS_EMAIL_TEMPLATES)
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id,name,category,subject,html,text,attachments,tag_label,tag_color,tag_custom_label")
      .single()

    if (!res.error) data = res.data
    else if (isMissingTemplateColumn(res.error)) {
      const legacyPatch = { ...patch }
      delete (legacyPatch as any).attachments
      const legacyRes = await supabase
        .from(DATABASE.TABLES.WS_EMAIL_TEMPLATES)
        .update(legacyPatch)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id,name,category,subject,html,text")
        .single()
      if (legacyRes.error) return NextResponse.json({ ok: false, error: legacyRes.error.message }, { status: 500 })
      data = {
        ...legacyRes.data,
        attachments: [],
        tag_label: normalizeTag((patch as any).tag_label),
        tag_color:
          typeof (patch as any).tag_color === "string" && String((patch as any).tag_color).trim()
            ? String((patch as any).tag_color)
            : defaultTagColor(normalizeTag((patch as any).tag_label)),
        tag_custom_label:
          typeof (patch as any).tag_custom_label === "string" ? String((patch as any).tag_custom_label) : null,
      }
    } else {
      return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true, template: data }, { status: 200 })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  const { error } = await supabase
    .from(DATABASE.TABLES.WS_EMAIL_TEMPLATES)
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 200 })
}
