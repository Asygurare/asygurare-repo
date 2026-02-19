import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"

export const runtime = "edge"

type DraftBody = {
  // Opcional: sirve para personalizar redacción
  to?: string
  audience?: "prospectos" | "clientes"
  instructions: string
  // opcional: si ya hay algo escrito, Gemini lo mejora
  currentSubject?: string
  currentText?: string
  language?: "es-MX" | "en-US"
  tone?: "formal" | "friendly" | "direct" | "warm"
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function stripCodeFences(raw: string) {
  const s = raw.trim()
  // remove leading/trailing triple backticks, optionally with `json`
  if (s.startsWith("```")) {
    const lines = s.split("\n")
    // drop first fence line
    if (lines.length >= 2 && lines[0]!.startsWith("```")) lines.shift()
    // drop last fence line
    if (lines.length >= 1 && lines[lines.length - 1]!.startsWith("```")) lines.pop()
    return lines.join("\n").trim()
  }
  return s
}

function sanitizeJsonString(raw: string) {
  // Gemini a veces incluye saltos de línea *literales* dentro de strings JSON.
  // Eso es inválido para JSON.parse. Aquí los convertimos a secuencias escapadas.
  let out = ""
  let inString = false
  let escaped = false

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!

    if (inString) {
      if (escaped) {
        escaped = false
        out += ch
        continue
      }
      if (ch === "\\") {
        escaped = true
        out += ch
        continue
      }
      if (ch === '"') {
        inString = false
        out += ch
        continue
      }
      if (ch === "\r") {
        // ignora CR (Windows)
        continue
      }
      if (ch === "\n") {
        out += "\\n"
        continue
      }
      if (ch === "\t") {
        out += "\\t"
        continue
      }
      // Otros separadores problemáticos en JS/JSON
      if (ch === "\u2028") {
        out += "\\u2028"
        continue
      }
      if (ch === "\u2029") {
        out += "\\u2029"
        continue
      }
      out += ch
      continue
    }

    if (ch === '"') {
      inString = true
      out += ch
      continue
    }
    out += ch
  }

  return out
}

function extractFirstJsonObject(raw: string) {
  const s = stripCodeFences(raw)
  const start = s.indexOf("{")
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < s.length; i++) {
    const ch = s[i]!
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === "\\") {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') inString = true
    if (ch === "{") depth++
    if (ch === "}") {
      depth--
      if (depth === 0) {
        return s.slice(start, i + 1)
      }
    }
  }

  return null
}

function extractLooseJsonField(raw: string, field: "subject" | "text") {
  const s = stripCodeFences(raw)
  const key = `"${field}"`
  const k = s.indexOf(key)
  if (k === -1) return null

  const colon = s.indexOf(":", k + key.length)
  if (colon === -1) return null

  // find first quote after colon
  let q = -1
  for (let i = colon + 1; i < s.length; i++) {
    const ch = s[i]!
    if (ch === '"') {
      q = i
      break
    }
    // if we hit structural chars before quote, abort
    if (ch === "{" || ch === "}") break
  }
  if (q === -1) return null

  let out = ""
  let escaped = false
  for (let i = q + 1; i < s.length; i++) {
    const ch = s[i]!
    if (escaped) {
      escaped = false
      out += ch
      continue
    }
    if (ch === "\\") {
      escaped = true
      out += ch
      continue
    }
    if (ch === '"') {
      return out
    }
    // tolerate raw newlines (Gemini sometimes breaks JSON)
    if (ch === "\r") continue
    if (ch === "\n") {
      out += "\\n"
      continue
    }
    out += ch
  }

  // truncated: return what we have
  return out.trim() || null
}

function normalizeYear(text: string, currentYear: number) {
  // Si el modelo inventa otro año (ej. 2024) lo normalizamos al actual.
  // Solo aplica a años 20xx para evitar tocar números que no son años.
  return text.replace(/\b20(1\d|2\d|3\d)\b/g, String(currentYear))
}

function normalizePlaceholders(text: string) {
  return text
    .replace(/\[\s*tu nombre(?: completo)?\s*\]/gi, "user_name")
    .replace(/\btu nombre(?: completo)?\b/gi, "user_name")
    .replace(/\[\s*nombre del cliente\s*\]/gi, "client_name")
    .replace(/\bnombre del cliente\b/gi, "client_name")
    .replace(/\[\s*nombre del prospecto\s*\]/gi, "nombre_prospecto")
    .replace(/\bnombre del prospecto\b/gi, "nombre_prospecto")
}

function ensureCompleteMessage(text: string) {
  let out = text.trim()
  if (!out) return out

  if (!/[.!?…]$/.test(out)) out += "."
  if (!/\buser_name\b/i.test(out)) out += "\n\nSaludos,\nuser_name"
  return out
}

function buildFallbackBody({
  instructions,
  audience,
  tone,
}: {
  instructions: string
  audience?: "prospectos" | "clientes"
  tone: string
}) {
  const low = instructions.toLowerCase()
  const isSeasonal =
    low.includes("año nuevo") ||
    low.includes("ano nuevo") ||
    low.includes("felicitar") ||
    low.includes("navidad") ||
    low.includes("fin de año") ||
    low.includes("fin de ano")

  const intro = "Hola, ¿cómo estás?"
  const seasonalBody =
    tone === "direct"
      ? "Solo quería desearte un excelente Año Nuevo, con salud, paz y muchos logros."
      : "Solo quería desearte un excelente Año Nuevo, lleno de salud, tranquilidad y grandes logros para ti y tu familia."

  const genericBody =
    audience === "clientes"
      ? "Solo quería mantenerme en contacto y agradecerte tu confianza."
      : "Solo quería mantenerme en contacto y ponerme a tus órdenes."

  const closing =
    tone === "direct"
      ? "Quedo atento(a) si necesitas algo.\n\nSaludos,\nuser_name"
      : "Quedo a tus órdenes para cualquier cosa que necesites.\n\nSaludos,\nuser_name"

  const body = isSeasonal ? seasonalBody : genericBody

  return [intro, "\n\n", body, "\n\n", closing].join("").trim()
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function geminiGenerate({
  apiKey,
  model,
  prompt,
}: {
  apiKey: string
  model: string
  prompt: string
}) {
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  )
  url.searchParams.set("key", apiKey)

  return fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        // Margen alto para evitar recortes del mensaje.
        maxOutputTokens: 4096,
      },
    }),
  })
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Missing GOOGLE_GENERATIVE_AI_API_KEY" }, { status: 500 })
  }

  let body: DraftBody
  try {
    body = (await request.json()) as DraftBody
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 })
  }

  const instructions = (body.instructions || "").trim()
  if (!instructions) {
    return NextResponse.json({ ok: false, error: "instructions es requerido" }, { status: 400 })
  }

  const language = body.language ?? "es-MX"
  const tone = body.tone ?? "warm"
  const now = new Date()
  const currentYear = now.getFullYear()
  // Preferimos Flash por disponibilidad/latencia y mejor consistencia para JSON simple.
  const preferredModel = process.env.GEMINI_MODEL || "gemini-2.5-flash"
  const modelFallbacks = [
    preferredModel,
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-2.5-pro",
  ].filter((m, i, arr) => !!m && arr.indexOf(m) === i)

  const system = [
    "Eres un asistente experto en redacción de correos para un agente de seguros.",
    "Objetivo principal: mantener una comunicación adecuada y cordial con el cliente.",
    "NO hagas pitch de ventas ni propongas llamadas/reuniones a menos que el usuario lo pida explícitamente.",
    `Idioma: ${language}. Tono: ${tone}.`,
    `Fecha actual (server): ${now.toISOString()} (año ${currentYear}).`,
    "IMPORTANTE: Responde SOLO un JSON válido, sin markdown, sin texto adicional.",
    "NO uses ``` ni texto antes/después del JSON.",
    "En el JSON, usa \\n para saltos de línea dentro de strings (no pongas saltos de línea literales dentro de comillas).",
    "Devuelve el JSON en UNA SOLA LÍNEA.",
    "Límites: subject <= 100 caracteres. text <= 450 palabras.",
    "No uses saludos de temporada (Año Nuevo/Navidad) a menos que el usuario lo pida explícitamente.",
    "No inventes años/fechas. Si necesitas mencionar un año, usa el año actual.",
    "Firma final: usa 'Saludos,' y en la siguiente linea exactamente 'user_name'.",
    "No uses placeholders como '[Tu Nombre]'. Usa 'user_name'.",
    "No cortes el mensaje: entregalo completo y bien cerrado.",
  ].join("\n")

  const context = [
    body.to ? `Destinatario (email): ${body.to}` : null,
    body.audience ? `Audiencia: ${body.audience}` : null,
    body.currentSubject ? `Asunto actual: ${body.currentSubject}` : null,
    body.currentText ? `Mensaje actual: ${body.currentText}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const userPrompt = [
    context ? `Contexto:\n${context}` : null,
    "Tarea: redacta un correo listo para enviar.",
    "Devuelve este JSON exacto:",
    `{"subject": string, "text": string}`,
    "Reglas:",
    "- No inventes datos personales del destinatario.",
    "- Maximo ~450 palabras en text.",
    "- No incluyas CTA a menos que el usuario lo solicite explícitamente.",
    "- No incluyas explicaciones ni variantes, solo una versión final.",
    "- Si necesitas placeholders, usa nombre_cliente o nombre_prospecto (y user_name para el remitente).",
    `Instrucciones del usuario:\n${instructions}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  const fullPrompt = `${system}\n\n${userPrompt}`

  // Reintentos con backoff + fallback de modelo cuando hay saturación temporal.
  let lastDetail = ""
  let lastStatus = 0
  let lastEmptyDebug = ""
  for (const model of modelFallbacks) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const geminiRes = await geminiGenerate({ apiKey, model, prompt: fullPrompt })
      if (geminiRes.ok) {
        const json = (await geminiRes.json()) as any
        const text =
          json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ?? ""

        const rawOut = String(text).trim()
        if (!rawOut) {
          const debug = {
            model_used: model,
            finishReason: json?.candidates?.[0]?.finishReason ?? null,
            promptFeedback: json?.promptFeedback ?? null,
            safetyRatings: json?.candidates?.[0]?.safetyRatings ?? null,
            // guardamos una muestra por si el shape cambió
            responsePreview: (() => {
              try {
                return JSON.stringify(json).slice(0, 800)
              } catch {
                return null
              }
            })(),
          }
          lastEmptyDebug = JSON.stringify(debug)

          // Trátalo como fallo reintentable: backoff y/o probar otro modelo.
          const base = 350 * Math.pow(2, attempt)
          const jitter = Math.floor(Math.random() * 200)
          await sleep(base + jitter)
          continue
        }
        const direct = safeJsonParse<{ subject: string; text: string }>(sanitizeJsonString(stripCodeFences(rawOut)))
        const extracted = extractFirstJsonObject(rawOut)
        const parsed =
          direct ??
          (extracted ? safeJsonParse<{ subject: string; text: string }>(sanitizeJsonString(extracted)) : null)

        if (!parsed?.subject || !parsed?.text) {
          // Fallback “tolerante”: rescata subject/text aunque el JSON venga incompleto/cortado.
          const looseSubject = extractLooseJsonField(rawOut, "subject")
          const looseText = extractLooseJsonField(rawOut, "text")
          if (looseSubject || looseText) {
            const subject = normalizePlaceholders(
              normalizeYear((looseSubject ?? "Asunto").trim(), currentYear)
            )
            const text =
              looseText && looseText.trim()
                ? ensureCompleteMessage(
                    normalizePlaceholders(normalizeYear(looseText.trim(), currentYear))
                  )
                : buildFallbackBody({ instructions, audience: body.audience, tone })
            return NextResponse.json(
              {
                ok: true,
                draft: {
                  subject,
                  text,
                },
                model_used: model,
                repaired: true,
              },
              { status: 200, headers: { "Cache-Control": "no-store" } }
            )
          }

          // Último fallback: si Gemini devolvió texto (aunque no sea JSON), úsalo como cuerpo.
          const firstLine = rawOut.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? ""
          const fallbackSubject =
            (body.currentSubject && body.currentSubject.trim()) ||
            (firstLine.length > 0 ? firstLine.slice(0, 78) : "Asunto")
          return NextResponse.json(
            {
              ok: true,
              draft: {
                subject: normalizePlaceholders(normalizeYear(fallbackSubject, currentYear)),
                text: rawOut.trim()
                  ? ensureCompleteMessage(normalizePlaceholders(normalizeYear(rawOut, currentYear)))
                  : buildFallbackBody({ instructions, audience: body.audience, tone }),
              },
              model_used: model,
              repaired: true,
              note: "fallback_text_used",
            },
            { status: 200, headers: { "Cache-Control": "no-store" } }
          )
        }

        // Normalizaciones post-parse (año + cuerpo mínimo)
        const normalizedSubject = normalizePlaceholders(
          normalizeYear(String(parsed.subject).trim(), currentYear)
        )
        const normalizedTextRaw = normalizePlaceholders(
          normalizeYear(String(parsed.text).trim(), currentYear)
        )
        const normalizedText =
          normalizedTextRaw.length >= 20
            ? ensureCompleteMessage(normalizedTextRaw)
            : buildFallbackBody({ instructions, audience: body.audience, tone })

        return NextResponse.json(
          { ok: true, draft: { subject: normalizedSubject, text: normalizedText }, model_used: model },
          { status: 200, headers: { "Cache-Control": "no-store" } }
        )
      }

      lastStatus = geminiRes.status
      const detail = await geminiRes.text().catch(() => "")
      lastDetail = detail.slice(0, 1500)

      // Retry only for transient load/availability errors
      const transient = geminiRes.status === 429 || geminiRes.status === 503
      if (!transient) break

      // Exponential backoff with small jitter
      const base = 400 * Math.pow(2, attempt)
      const jitter = Math.floor(Math.random() * 200)
      await sleep(base + jitter)
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: lastEmptyDebug ? "gemini_empty_output" : "gemini_failed",
      status: lastStatus || 502,
      detail: lastEmptyDebug || lastDetail,
      hint: lastEmptyDebug
        ? "Gemini devolvió respuesta vacía (a veces por truncamiento/MAX_TOKENS o forma de respuesta). Reintenta o fija GEMINI_MODEL=gemini-1.5-flash."
        : "Saturación temporal de Gemini. Reintenta en unos segundos o usa un modelo Flash.",
    },
    { status: 502 }
  )

}

