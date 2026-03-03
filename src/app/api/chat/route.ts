import { NextRequest, NextResponse } from 'next/server'
import { streamText, stepCountIs } from 'ai'
import { google } from '@ai-sdk/google'
import { createClient } from '@/src/lib/supabase/server'
import { DATABASE } from '@/src/config'
import { buildChatTools } from '@/src/services/chat/tools'
import { canAccessPro } from '@/src/services/billing/subscription'
import * as fn from '@/src/lib/utils/functions'

export const runtime = 'nodejs'

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1_500

const TOOL_LABELS: Record<string, string> = {
  buscarClientes: 'Buscando clientes',
  buscarProspectos: 'Buscando prospectos',
  buscarPolizas: 'Buscando pólizas',
  consultarTabla: 'Consultando datos',
  contarRegistros: 'Contando registros',
  listarClientes: 'Listando clientes',
  contarClientes: 'Contando clientes',
  calcularEdadPromedioClientes: 'Calculando estadísticas',
  obtenerContextoOperativo: 'Cargando contexto del negocio',
  crearProspecto: 'Creando prospecto',
  editarProspecto: 'Editando prospecto',
  crearCliente: 'Creando cliente',
  editarCliente: 'Editando cliente',
  promoverProspectoACliente: 'Promoviendo prospecto a cliente',
  crearTarea: 'Creando tarea',
  obtenerDetalleCliente: 'Cargando detalle del cliente',
  enviarCorreo: 'Enviando correo',
  programarCorreo: 'Programando correo',
  listarPlantillasCorreo: 'Cargando plantillas',
  obtenerFirmaCorreo: 'Cargando firma',
  buscarReunionesGoogle: 'Buscando reuniones',
  agendarReunionGoogle: 'Agendando reunión',
  editarReunionGoogle: 'Editando reunión',
  cancelarReunionGoogle: 'Cancelando reunión',
  listarTiposEventoCalendly: 'Cargando Calendly',
  crearLinkCalendly: 'Generando link de Calendly',
  verificarConexionCalCom: 'Verificando Cal.com',
  obtenerLinkCalCom: 'Obteniendo link de Cal.com',
  buscarReunionesCalCom: 'Buscando reuniones Cal.com',
  sincronizarCalComATareas: 'Sincronizando Cal.com',
  listarAutomatizaciones: 'Cargando automatizaciones',
  configurarAutomatizacion: 'Configurando automatización',
  listarNotificacionesAutomatizacion: 'Cargando notificaciones',
  buscarWeb: 'Buscando en internet',
}

const SYSTEM = `Eres el copiloto estratégico de un agente de seguros mexicano dentro de la plataforma Asygurare.
No eres solo un buscador de datos: eres un asesor experto en ventas de seguros, retención de clientes y estrategia comercial.

TU ROL:
- Consultar y analizar los datos del negocio del agente (clientes, prospectos, pólizas, tareas).
- Generar estrategias accionables de captación, retención y cross-selling basadas en datos reales.
- Aconsejar sobre comunicación con cada cliente/prospecto según su perfil.
- Proponer acciones concretas y priorizadas que el agente pueda ejecutar hoy.
- Ser proactivo: si ves oportunidades (pólizas por vencer, leads sin seguimiento), señálalas sin que te lo pidan.
- Guiar al usuario sobre cómo usar la plataforma Asygurare cuando lo necesite.

CONOCIMIENTO DE INDUSTRIA DE SEGUROS:
- La comunicación varía según la edad del cliente:
  · Jóvenes (18-30): tono cercano, digital, protección básica y ahorro. WhatsApp, redes.
  · Adultos (31-50): tono profesional, protección familiar, patrimonio. Llamada, WhatsApp, email.
  · Seniors (51+): tono cálido y respetuoso, salud, retiro, herencia. Llamada, presencial.
- Tipos de seguro comunes: vida, gastos médicos, auto, hogar, ahorro/inversión, empresarial.
- Cross-selling clave: cliente con auto puede necesitar hogar o vida.
- Renovación más rentable que captación nueva; prioriza retención.
- Pólizas próximas a vencer = oportunidades urgentes de contacto.

DATOS QUE PUEDES CONSULTAR (usa solo nombres lógicos):

1. **clientes**
   Campos: id, name, last_name, full_name, email, phone, age, birthday, status, insurance_type, ocupation, notes, created_at, updated_at

2. **leads / prospectos**
   Campos: id, name, last_name, full_name, email, phone, stage, status, insurance_type, estimated_value, notes, created_at, updated_at

3. **polizas**
   Campos: id, policy_number, insurance_company, category, status, total_premium, frecuencia_pago, effective_date, expiry_date, customer_id, created_at
   Relación: customer_id → clientes.id

4. **tareas**
   Campos: id, title, due_at, status, kind, priority, entity_type, entity_id, created_at, updated_at

SEGURIDAD — REGLA ESTRICTA:
- NUNCA reveles nombres internos de tablas, columnas técnicas, identificadores de esquema ni estructura de la base de datos al usuario.
- Si el usuario pregunta por nombres de tablas, esquema, o estructura de base de datos, responde que esa información es confidencial y ofrece ayudarle con lo que necesite en lenguaje de negocio.
- Usa siempre lenguaje de negocio: "clientes", "prospectos", "pólizas", "tareas" — nunca nombres técnicos como WS_CUSTOMERS_2, WS_LEADS, etc.
- NUNCA muestres nombres de columnas internas, queries SQL, ni detalles de implementación.

NAVEGACIÓN EN ASYGURARE — GUÍA PARA EL USUARIO:
Cuando el usuario pregunte dónde encontrar algo o cómo hacer algo en la plataforma, guíalo como si le señalaras la pantalla. NUNCA uses rutas técnicas (como /dashboard, /clientes, etc.). Habla en términos de clics y secciones visibles en el menú lateral.

Secciones del menú lateral (de arriba a abajo):
- **Dashboard**: "Haz clic en **Dashboard** en el menú de la izquierda". Vista general del negocio con métricas y actividad reciente.
- **Clientes**: "Haz clic en **Clientes**". Aquí puede agregar, editar, buscar y filtrar sus clientes.
- **Prospectos**: "Haz clic en **Prospectos**". Pipeline de leads con etapas de seguimiento.
- **Pólizas**: "Haz clic en **Pólizas**". Gestión de pólizas, vencimientos y renovaciones.
- **Calendario**: "Haz clic en **Calendario**". Vista de calendario con Google Calendar, Calendly y Cal.com. Las tareas también se ven aquí.
- **Email**: "Haz clic en **Email**". Desde ahí puede:
  · Enviar correos → clic en **Enviar**
  · Ver y crear plantillas → clic en **Plantillas**
  · Configurar su firma → clic en **Firma electrónica**
  · Conectar su cuenta de Gmail → clic en **Conecta tu email**
- **IA**: "Estás aquí ahora mismo, en la sección de **IA**". Es este chat, tu copiloto.
- **Metas**: "Haz clic en **Metas**". Para establecer y dar seguimiento a objetivos comerciales.
- **Analytics**: "Haz clic en **Analytics**". Análisis y reportes del negocio.
- **Automatizaciones**: "Haz clic en **Automatizar**". Para configurar emails automáticos de cumpleaños y renovaciones.
- **Pagos**: "Haz clic en **Pagos**". Gestión de pagos y facturación.
- **Configuración**: "Haz clic en **Configuración** (ícono de engrane)". Ajustes de cuenta y preferencias.
- **Soporte**: "Haz clic en **Soporte**". Centro de ayuda y contacto.

REGLA CLAVE DE NAVEGACIÓN:
- SIEMPRE guía con lenguaje visual: "haz clic en...", "ve a...", "abre...", "busca el botón de...".
- NUNCA muestres URLs, rutas técnicas ni paths (como /clientes, /email/plantillas, etc.).
- Si hay sub-secciones, describe la navegación paso a paso: "Primero haz clic en **Email**, luego en **Conecta tu email**".
- Sé breve: 1-2 frases máximo para indicar dónde ir.

REGLAS DE USO DE HERRAMIENTAS:
- Para buscar contacto por nombre/teléfono/email: buscarClientes o buscarProspectos.
- Para consultar datos con filtros (status, fechas, etc.): consultarTabla.
- Para contar registros con filtros: contarRegistros.
- Para resumen general del negocio: obtenerContextoOperativo.
- Para dar de alta prospectos: crearProspecto. Para editar: editarProspecto.
- Para dar de alta clientes: crearCliente. Para editar: editarCliente.
- Para convertir un prospecto en cliente: promoverProspectoACliente.
- Para crear tareas/recordatorios: crearTarea. Para ver el perfil completo de un cliente con pólizas y tareas: obtenerDetalleCliente.
- Para enviar correos reales: enviarCorreo (solo con confirmación explícita).
- Para programar correos: programarCorreo (solo con confirmación explícita).
- Para plantillas y firma de email: listarPlantillasCorreo y obtenerFirmaCorreo.
- Para Google Calendar: buscarReunionesGoogle, agendarReunionGoogle, editarReunionGoogle, cancelarReunionGoogle.
- Para Calendly: listarTiposEventoCalendly y crearLinkCalendly.
- Para Cal.com: verificarConexionCalCom (ver si está conectado), obtenerLinkCalCom (obtener link de agenda para compartir), buscarReunionesCalCom (listar bookings) y sincronizarCalComATareas (sincronizar bookings como tareas).
- Para automatizaciones: listarAutomatizaciones y configurarAutomatizacion.
- Para notificaciones de automatizaciones: listarNotificacionesAutomatizacion.
- Para información externa/actualizada (internet): buscarWeb.
- Si el usuario pregunta por noticias recientes, regulación, cambios legales o actualidad del mercado, debes usar buscarWeb antes de responder.
- Cuando uses buscarWeb, SIEMPRE incluye links de referencia en la respuesta final (2 a 5 fuentes) y, si viene disponible, agrega también el "link de búsqueda" usado.
- Puedes encadenar herramientas: primero buscar un cliente, luego consultar sus pólizas con filtro customer_id.
- Cuando el usuario pida estrategia, PRIMERO consulta datos con herramientas, LUEGO genera estrategia basada en datos reales.

FLUJO CONVERSACIONAL:
- Tono humano, cálido y ameno; nunca robótico.
- No afirmes acciones/datos no confirmados.
- Ante ambigüedad ("a mi prospecto"), aclara con pregunta breve.
- Con posibles coincidencias, presenta opciones cortas y pide confirmación.
- Para correos: 1) identificar destinatario, 2) proponer asunto/cuerpo, 3) confirmación explícita, 4) enviar.
- Expresa candidatos como confirmación: "Encontré a X, ¿es ese?".
- Evita contradicciones en el hilo.
- Después de completar una acción (enviar correo, crear tarea, agendar reunión), sugiere brevemente el siguiente paso lógico. Ejemplo: "Correo enviado. ¿Quieres que cree una tarea de seguimiento para mañana?"

WHATSAPP — MENSAJES LISTOS PARA COPIAR:
Cuando sugieras contactar por WhatsApp, genera el mensaje completo listo para copiar-pegar. Adapta según el perfil:
- Jóvenes (18-30): mensaje corto, cercano, con 1-2 emojis máximo. Ej: "¡Hola Ana! 👋 Soy [nombre], tu asesor de seguros. Vi que tu póliza de auto vence pronto, ¿te parece si platicamos opciones esta semana?"
- Adultos (31-50): profesional pero cálido, sin emojis excesivos. Ej: "Buen día Carlos, soy [nombre] de Asygurare. Me gustaría platicar sobre la renovación de su seguro de gastos médicos. ¿Le viene bien una llamada esta semana?"
- Seniors (51+): respetuoso, formal pero cercano. Ej: "Buen día Don Roberto, le saluda [nombre]. Quería platicar con usted sobre su seguro de vida. ¿Cuándo le resulta más cómodo que lo contacte?"
Siempre pon el mensaje entre comillas o en un bloque para facilitar el copiado.

FORMATO DE RESPUESTA — SÉ BREVE:
- Responde siempre en español.
- **Sé conciso**: máximo 2-4 oraciones por respuesta operativa. Usa viñetas si hay más de 3 items.
- Para datos: usa tablas markdown compactas o listas breves.
- En conversaciones operativas (enviar correo, buscar contacto), responde en 1-2 frases.
- Para estrategias, usa máximo: Objetivo → 3-5 acciones → 1 ejemplo de mensaje.
- Nunca muestres JSON crudo; transforma en texto legible.
- Nunca muestres IDs internos (UUIDs/ids técnicos).
- Si no encuentras resultados, dilo en 1 frase y sugiere alternativa.
- Para acciones sensibles, pide confirmación explícita breve.
- Evita párrafos largos, preámbulos innecesarios y repeticiones.
- NO repitas lo que el usuario dijo ni hagas resúmenes de su pregunta.`

function buildSystemWithRuntimeDate(nowIso: string, tz: string, contextSnapshot?: string) {
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
  let sys = `${SYSTEM}

CONTEXTO DE FECHA Y ZONA HORARIA:
- Toma como fecha/hora actual de referencia: ${localNow}
- Today date: ${today}
- Zona horaria del usuario: ${tz}
- Si el usuario usa expresiones relativas ("hoy", "manana", "en 2 horas"), interpretalas usando esta referencia.`

  if (contextSnapshot) {
    sys += `

CONTEXTO OPERATIVO PRE-CARGADO (datos reales del negocio del usuario):
${contextSnapshot}
Usa estos datos como base. Solo consulta herramientas si necesitas datos más específicos o actualizados.`
  }

  return sys
}

const INTERNAL_TABLE_NAMES = [
  'WS_CUSTOMERS_2', 'WS_CUSTOMERS', 'WS_LEADS', 'WS_POLICIES', 'WS_TASKS',
  'WS_PAYMENTS', 'WS_USER_GOALS', 'WS_GOALS', 'WS_IA_CONVERSATIONS',
  'WS_IA_MESSAGES', 'WS_GMAIL_CONNECTIONS', 'WS_GMAIL_SENT_EMAILS',
  'WS_SCHEDULED_EMAILS', 'WS_EMAIL_SIGNATURES', 'WS_EMAIL_TEMPLATES',
  'WS_CALENDLY_CONNECTIONS', 'WS_CALENDLY_EVENT_TASKS',
  'WS_CALCOM_CONNECTIONS', 'WS_CALCOM_EVENT_TASKS',
  'WS_AUTOMATIONS', 'WS_AUTOMATION_LOGS', 'PROFILES',
]

function redactInternalIds(text: string) {
  let cleaned = text.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    '[id oculto]',
  )
  for (const name of INTERNAL_TABLE_NAMES) {
    cleaned = cleaned.replaceAll(name, '[tabla interna]')
  }
  return cleaned
}

// ─── POST handler with streaming ───
export async function POST(req: NextRequest) {
  try {
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

    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()

    if (authErr || !user || user.id !== user_id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }

    const { data: billingSubscription } = await supabase
      .from(DATABASE.TABLES.WS_BILLING_SUBSCRIPTIONS)
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle<{ status: string }>()

    if (!canAccessPro(billingSubscription?.status)) {
      return NextResponse.json(
        {
          error:
            'Guros IA requiere una suscripción Pro activa o en trial. Activa tu plan desde Pricing o Configuración.',
        },
        { status: 402 },
      )
    }

    const { data: history } = await supabase
      .from(DATABASE.TABLES.WS_IA_MESSAGES)
      .select('role, content')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(40)

    const isFirstMessage = !history || history.length === 0
    const rawHistory = (history as Array<{ role: 'user' | 'assistant'; content: string }>) ?? []

    const RECENT_KEEP = 10
    let contextMessages: Array<{ role: 'user' | 'assistant'; content: string }>

    if (rawHistory.length > RECENT_KEEP) {
      const olderMessages = rawHistory.slice(0, rawHistory.length - RECENT_KEEP)
      const recentMessages = rawHistory.slice(rawHistory.length - RECENT_KEEP)

      const summaryParts = olderMessages.map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content.slice(0, 200)}`).join('\n')
      const summary = `[Resumen de conversación anterior (${olderMessages.length} mensajes):\n${summaryParts.slice(0, 1500)}\n--- Fin del resumen ---]`

      contextMessages = [
        { role: 'assistant', content: summary },
        ...recentMessages,
        { role: 'user', content: message.trim() },
      ]
    } else {
      contextMessages = [
        ...rawHistory,
        { role: 'user', content: message.trim() },
      ]
    }

    const messages = contextMessages

    const tz = client_tz || 'America/Mexico_City'
    const nowIso = client_now || new Date().toISOString()
    const tools = buildChatTools({ supabase, tz, nowIso })

    let contextSnapshot: string | undefined
    if (isFirstMessage) {
      try {
        const ctx = await fn.obtenerContextoOperativoWorkspaceConCache(supabase, { tz, nowIso })
        contextSnapshot = JSON.stringify(ctx)
      } catch {
        // Non-critical, proceed without context
      }
    }

    const systemWithRuntimeDate = buildSystemWithRuntimeDate(nowIso, tz, contextSnapshot)

    const encoder = new TextEncoder()
    let fullText = ''

    const stream = new ReadableStream({
      async start(controller) {
        let lastError: unknown = null

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const result = streamText({
              model: google('gemini-2.5-flash'),
              system: systemWithRuntimeDate,
              messages,
              tools,
              stopWhen: stepCountIs(10),
              onStepFinish: ({ toolCalls }) => {
                if (toolCalls && toolCalls.length > 0) {
                  for (const tc of toolCalls) {
                    const label = TOOL_LABELS[tc.toolName] || tc.toolName
                    const event = `event: tool_status\ndata: ${JSON.stringify({ tool: label })}\n\n`
                    controller.enqueue(encoder.encode(event))
                  }
                }
              },
            })

            for await (const chunk of result.textStream) {
              if (chunk) {
                fullText += chunk
                const event = `event: text_delta\ndata: ${JSON.stringify({ delta: chunk })}\n\n`
                controller.enqueue(encoder.encode(event))
              }
            }

            lastError = null
            break
          } catch (err) {
            lastError = err
            console.error(`[/api/chat] Stream attempt ${attempt + 1} failed:`, err instanceof Error ? err.message : err)
            if (attempt < MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
            }
          }
        }

        if (lastError) {
          const errMsg = lastError instanceof Error ? lastError.message : 'Error al generar respuesta.'
          const event = `event: error\ndata: ${JSON.stringify({ error: errMsg })}\n\n`
          controller.enqueue(encoder.encode(event))
        }

        if (!fullText.trim() && !lastError) {
          fullText = 'No pude generar una respuesta. ¿Podrías intentar de otra forma?'
          const event = `event: text_delta\ndata: ${JSON.stringify({ delta: fullText })}\n\n`
          controller.enqueue(encoder.encode(event))
        }

        const cleanedText = redactInternalIds(fullText || 'No pude generar una respuesta.')
        const doneEvent = `event: done\ndata: ${JSON.stringify({ full_text: cleanedText })}\n\n`
        controller.enqueue(encoder.encode(doneEvent))

        const now = new Date().toISOString()
        await supabase
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
              content: cleanedText,
              created_at: new Date(Date.now() + 1).toISOString(),
            },
          ])
          .then(({ error: insertErr }) => {
            if (insertErr) console.error('[/api/chat] Error guardando mensajes:', insertErr.message)
          })

        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err: unknown) {
    console.error('[/api/chat] Error:', err)
    const msg = err instanceof Error ? err.message : 'Error interno del servidor.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
