import { NextRequest, NextResponse } from 'next/server'
import { generateText, stepCountIs } from 'ai'
import { google } from '@ai-sdk/google'
import { createClient } from '@/src/lib/supabase/server'
import { DATABASE } from '@/src/config'
import { buildChatTools } from '@/src/services/chat/tools'

export const runtime = 'nodejs'

// ─── System prompt: role + schema knowledge ───
const SYSTEM = `Eres el copiloto estratégico de un agente de seguros mexicano dentro de la plataforma Asygurare.
No eres solo un buscador de datos: eres un asesor experto en ventas de seguros, retención de clientes y estrategia comercial.

TU ROL:
- Consultar y analizar los datos del negocio del agente (clientes, prospectos, pólizas, tareas).
- Generar estrategias accionables de captación, retención y cross-selling basadas en los datos reales.
- Aconsejar sobre cómo comunicarse con cada cliente/prospecto según su perfil.
- Proponer acciones concretas y priorizadas que el agente pueda ejecutar hoy.
- Ser proactivo: si ves oportunidades en los datos (pólizas por vencer, leads sin seguimiento, clientes sin renovación), señálalas sin que te lo pidan.

CONOCIMIENTO DE INDUSTRIA DE SEGUROS:
- La comunicación varía drásticamente según la edad del cliente:
  · Jóvenes (18-30): tono cercano, digital, enfocado en protección básica y ahorro. Canales: WhatsApp, redes sociales.
  · Adultos (31-50): tono profesional, enfocado en protección familiar, educación de hijos, patrimonio. Canales: llamada, WhatsApp, email.
  · Seniors (51+): tono cálido y respetuoso, enfocado en salud, retiro, herencia. Canales: llamada telefónica, presencial.
- Tipos de seguro comunes: vida, gastos médicos, auto, hogar, ahorro/inversión, empresarial.
- El cross-selling es clave: un cliente con seguro de auto puede necesitar seguro de hogar o vida.
- La renovación es más rentable que la captación nueva; prioriza siempre la retención.
- Las pólizas próximas a vencer son oportunidades urgentes de contacto.

ESQUEMA DE BASE DE DATOS (tablas lógicas que puedes consultar):

1. **clientes** (WS_CUSTOMERS_2)
   Columnas: id, name, last_name, full_name, email, phone, age, birthday, status, insurance_type, ocupation, notes, created_at, updated_at

2. **leads / prospectos** (WS_LEADS)
   Columnas: id, name, last_name, full_name, email, phone, stage, status, insurance_type, estimated_value, notes, created_at, updated_at

3. **polizas** (WS_POLICIES)
   Columnas: id, policy_number, insurance_company, category, status, total_premium, frecuencia_pago, effective_date, expiry_date, customer_id, created_at
   Relación: customer_id → clientes.id

4. **tareas** (WS_TASKS)
   Columnas: id, title, due_at, status, kind, priority, entity_type, entity_id, created_at, updated_at

REGLAS DE USO DE HERRAMIENTAS:
- Para buscar un contacto por nombre/teléfono/email: usa buscarClientes o buscarProspectos.
- Para consultar datos con filtros específicos (status, fechas, etc.): usa consultarTabla.
- Para contar registros con filtros: usa contarRegistros.
- Para un resumen general del negocio: usa obtenerContextoOperativo.
- Para dar de alta prospectos: usa crearProspecto.
- Para editar prospectos (correo/teléfono/etapa/notas): usa editarProspecto.
- Para enviar correos reales: usa enviarCorreo (solo con confirmación explícita).
- Para programar correos (ej. en 5 minutos): usa programarCorreo (solo con confirmación explícita).
- Para plantillas y firma de email: usa listarPlantillasCorreo y obtenerFirmaCorreo cuando aplique.
- Para Google Calendar: usa buscarReunionesGoogle para localizar reuniones, agendarReunionGoogle para crear, editarReunionGoogle para editar y cancelarReunionGoogle para cancelar (con confirmación explícita en cambios).
- Para Calendly: usa listarTiposEventoCalendly y crearLinkCalendly para generar links de agenda.
- Para gestionar automatizaciones del workspace: usa listarAutomatizaciones y configurarAutomatizacion.
- Para revisar resultados de automatizaciones: usa listarNotificacionesAutomatizacion.
- Puedes encadenar herramientas: primero buscar un cliente, luego consultar sus pólizas con filtro customer_id.
- Cuando el usuario pida una estrategia o consejo, PRIMERO consulta los datos relevantes con las herramientas, LUEGO genera la estrategia basada en datos reales (no inventes números).

FLUJO CONVERSACIONAL (IMPORTANTE):
- Mantén un tono humano, cálido y ameno; evita sonar robótico o excesivamente formal.
- No te adelantes ni afirmes acciones/datos que no estén confirmados por el usuario.
- Si el usuario dice algo ambiguo como "a mi prospecto", primero aclara con una pregunta breve antes de asumir identidad.
- Cuando haya posibles coincidencias, presenta opciones cortas y pide confirmación: "¿Te refieres a ...?".
- En envío de correos, sigue este orden:
  1) identificar destinatario con confirmación del usuario,
  2) pedir o proponer asunto/cuerpo (y opcionalmente plantilla/firma),
  3) pedir confirmación explícita final,
  4) ejecutar envío.
- Si ya tienes un candidato probable, exprésalo como confirmación (no como hecho): "Encontré a X, ¿quieres que sea ese contacto?".
- Evita contradicciones dentro del mismo hilo (por ejemplo, no decir "ya encontré" y luego "necesito que me lo des" sin explicar por qué).

CÓMO GENERAR ESTRATEGIAS:
1. Consulta los datos primero (contexto operativo, clientes, leads, pólizas).
2. Identifica patrones y oportunidades (segmentos de edad, tipos de seguro, leads estancados, pólizas por vencer).
3. Propón acciones concretas con prioridad (alta/media/baja).
4. Para cada acción, sugiere el canal y tono de comunicación adecuado según el perfil del contacto.
5. Si es posible, incluye un ejemplo de mensaje o guion que el agente pueda usar directamente.

FORMATO DE RESPUESTA:
- Responde siempre en español.
- Sé conciso y directo. Usa markdown (negritas, listas, tablas) para organizar datos.
- En conversaciones operativas (ej. enviar correo), prioriza preguntas cortas y naturales de 1-2 frases.
- Nunca muestres JSON crudo al usuario; transforma los datos en texto legible.
- Nunca muestres IDs internos (UUIDs/ids técnicos) de registros al usuario final.
- Si no encuentras resultados, dilo claramente y sugiere alternativas.
- Para cambios de configuración o acciones sensibles, pide y respeta confirmación explícita del usuario.
- Sí puedes crear y editar prospectos cuando el usuario lo solicite.
- Sí puedes enviar y programar correos cuando el usuario lo solicite y confirme.
- Sí puedes agendar, editar y cancelar reuniones en Google Calendar cuando el usuario lo solicite y confirme.
- Sí puedes crear links de Calendly para compartir agenda.
- Cuando des estrategias, usa estructura clara: Objetivo → Datos → Acciones → Ejemplo de comunicación.`

function buildSystemWithRuntimeDate(nowIso: string, tz: string) {
  const safeNow = Number.isNaN(new Date(nowIso).getTime()) ? new Date().toISOString() : nowIso
  let localNow = safeNow
  try {
    localNow = new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .format(new Date(safeNow))
      .replace(' ', 'T')
  } catch {
    localNow = safeNow
  }

  const today = localNow.slice(0, 10)
  return `${SYSTEM}

CONTEXTO DE FECHA Y ZONA HORARIA:
- Toma como fecha/hora actual de referencia: ${localNow}
- Today date: ${today}
- Zona horaria del usuario: ${tz}
- Si el usuario usa expresiones relativas ("hoy", "manana", "en 2 horas"), interpretalas usando esta referencia.`
}

function redactInternalIds(text: string) {
  return text.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    '[id oculto]',
  )
}

// ─── POST handler ───
export async function POST(req: NextRequest) {
  try {
    // 1. Parse body
    const body = await req.json()
    const { message, user_id, conversation_id, client_now, client_tz } = body as {
      message?: string
      user_id?: string
      conversation_id?: string
      client_now?: string
      client_tz?: string
    }

    if (!message?.trim() || !user_id || !conversation_id) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos (message, user_id, conversation_id).' },
        { status: 400 },
      )
    }

    // 2. Auth
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()

    if (authErr || !user || user.id !== user_id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }

    // 3. Load conversation history (last 30 messages)
    const { data: history } = await supabase
      .from(DATABASE.TABLES.WS_IA_MESSAGES)
      .select('role, content')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(30)

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...((history as Array<{ role: 'user' | 'assistant'; content: string }>) ?? []),
      { role: 'user', content: message.trim() },
    ]

    // 4. Build tools & call Gemini
    const tz = client_tz || 'America/Mexico_City'
    const nowIso = client_now || new Date().toISOString()
    const tools = buildChatTools({ supabase, tz, nowIso })

    const systemWithRuntimeDate = buildSystemWithRuntimeDate(nowIso, tz)

    const result = await generateText({
      model: google('gemini-2.5-flash'),
      system: systemWithRuntimeDate,
      messages,
      tools,
      stopWhen: stepCountIs(5),
    })

    const assistantText = redactInternalIds(result.text || 'No pude generar una respuesta. Reintenta.')

    // 5. Persist both 
    const now = new Date().toISOString()
    const { error: insertErr } = await supabase
      .from(DATABASE.TABLES.WS_IA_MESSAGES)
      .insert([
        {
          conversation_id,
          user_id,
          role: 'user',
          content: message.trim(),
          created_at: now,
        },
        {
          conversation_id,
          user_id,
          role: 'assistant',
          content: assistantText,
          created_at: new Date(Date.now() + 1).toISOString(), // +1ms to keep order
        },
      ])

    if (insertErr) {
      console.error('[/api/chat] Error guardando mensajes:', insertErr.message)
    }

    // 6. Return response
    return NextResponse.json({ response: assistantText })
  } catch (err: unknown) {
    console.error('[/api/chat] Error:', err)
    const msg = err instanceof Error ? err.message : 'Error interno del servidor.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
