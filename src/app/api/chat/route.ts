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
- Puedes encadenar herramientas: primero buscar un cliente, luego consultar sus pólizas con filtro customer_id.
- Cuando el usuario pida una estrategia o consejo, PRIMERO consulta los datos relevantes con las herramientas, LUEGO genera la estrategia basada en datos reales (no inventes números).

CÓMO GENERAR ESTRATEGIAS:
1. Consulta los datos primero (contexto operativo, clientes, leads, pólizas).
2. Identifica patrones y oportunidades (segmentos de edad, tipos de seguro, leads estancados, pólizas por vencer).
3. Propón acciones concretas con prioridad (alta/media/baja).
4. Para cada acción, sugiere el canal y tono de comunicación adecuado según el perfil del contacto.
5. Si es posible, incluye un ejemplo de mensaje o guion que el agente pueda usar directamente.

FORMATO DE RESPUESTA:
- Responde siempre en español.
- Sé conciso y directo. Usa markdown (negritas, listas, tablas) para organizar datos.
- Nunca muestres JSON crudo al usuario; transforma los datos en texto legible.
- Si no encuentras resultados, dilo claramente y sugiere alternativas.
- Si el usuario pide algo que realmente no puedes hacer (modificar datos directamente, enviar correos), explícalo y sugiere cómo hacerlo manualmente.
- Cuando des estrategias, usa estructura clara: Objetivo → Datos → Acciones → Ejemplo de comunicación.`

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

    const result = await generateText({
      model: google('gemini-2.5-flash'),
      system: SYSTEM,
      messages,
      tools,
      stopWhen: stepCountIs(5),
    })

    const assistantText = result.text || 'No pude generar una respuesta. Reintenta.'

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
