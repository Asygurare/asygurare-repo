import { tool } from 'ai'
import { z } from 'zod'
import { SupabaseClient } from '@supabase/supabase-js'
import * as fn from '@/src/lib/utils/functions'
import { DATABASE } from '@/src/config'
import { DEFAULT_AUTOMATIONS, isAutomationKey } from '@/src/services/automations/config'
import { getGmailAccessTokenForUser } from '@/src/services/gmail/accessToken'
import { buildRawMessage } from '@/src/services/gmail/message'
import { getCalendlyAccessTokenForUser } from '@/src/services/calendly/accessToken'
import { getCalComAccessTokenForUser } from '@/src/services/calcom/accessToken'

// ─── Context passed from the route ───
type ToolCtx = {
  supabase: SupabaseClient
  tz: string
  nowIso: string
}

// ─── Reusable filter schema (matches existing functions.ts) ───
const FilterSchema = z.object({
  column: z.string(),
  op: z.enum([
    'eq', 'neq', 'ilike', 'gt', 'gte', 'lt', 'lte', 'isnull', 'notnull', 'in',
  ]),
  value: z.string().optional(),
})

// ─── Build all chat tools for AI SDK generateText ───
export function buildChatTools(ctx: ToolCtx) {
  const { supabase, tz, nowIso } = ctx
  const normalizeEmail = (raw: string | null | undefined) => {
    const value = String(raw || '').trim()
    const angleMatch = value.match(/<([^>]+)>/)
    const email = angleMatch?.[1] ?? value
    return email.trim().toLowerCase()
  }
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const hasCalendarScope = (scope: string | null | undefined) => {
    if (!scope) return false
    return (
      scope.includes('https://www.googleapis.com/auth/calendar') ||
      scope.includes('https://www.googleapis.com/auth/calendar.events')
    )
  }
  const applySenderPlaceholder = (template: string, senderName: string) =>
    template
      .replace(/\buser_name\b/gi, senderName)
      .replace(/\[\s*tu nombre(?: completo)?\s*\]/gi, senderName)
      .replace(/\btu nombre(?: completo)?\b/gi, senderName)
  const resolveSenderName = async (userId: string, userEmail?: string | null) => {
    const { data: profile } = await supabase
      .from(DATABASE.TABLES.PROFILES)
      .select('first_name,last_name')
      .eq('id', userId)
      .maybeSingle<{ first_name: string | null; last_name: string | null }>()
    const first = String(profile?.first_name ?? '').trim()
    const last = String(profile?.last_name ?? '').trim()
    const full = `${first} ${last}`.trim()
    if (full) return full
    const email = String(userEmail ?? '').trim()
    if (email.includes('@')) return email.split('@')[0] || 'user_name'
    return 'user_name'
  }

  return {
    consultarTabla: tool({
      description:
        'Consulta segura sobre tablas del workspace (clientes, leads, polizas, tareas). Permite filtros, orden y límite. Read-only.',
      inputSchema: z.object({
        table: z.string().describe("Tabla lógica: 'clientes' | 'leads' | 'polizas' | 'tareas'"),
        select: z.array(z.string()).optional().describe('Columnas a devolver'),
        filters: z.array(FilterSchema).optional().describe('Filtros AND: { column, op, value }'),
        orderBy: z.string().optional().describe('Columna para ordenar'),
        orderDir: z.enum(['asc', 'desc']).optional().describe('Dirección de orden'),
        limit: z.number().optional().describe('Máximo de filas (default 10, max 50)'),
      }),
      execute: async (args) =>
        fn.consultarTablaWorkspace(supabase, {
          table: args.table,
          select: args.select,
          filters: args.filters,
          orderBy: args.orderBy,
          orderDir: args.orderDir,
          limit: args.limit,
        }),
    }),

    contarRegistros: tool({
      description:
        'Cuenta registros en una tabla del workspace con filtros opcionales (read-only).',
      inputSchema: z.object({
        table: z.string().describe("Tabla lógica: 'clientes' | 'leads' | 'polizas' | 'tareas'"),
        filters: z.array(FilterSchema).optional().describe('Filtros AND'),
      }),
      execute: async (args) =>
        fn.contarRegistrosWorkspace(supabase, {
          table: args.table,
          filters: args.filters,
        }),
    }),

    buscarClientes: tool({
      description:
        'Busca clientes por texto libre (nombre, teléfono, email). Usa FTS + trigram.',
      inputSchema: z.object({
        query: z.string().describe('Texto a buscar'),
        limit: z.number().optional().describe('Máximo de resultados (default 6)'),
      }),
      execute: async (args) =>
        fn.buscarClientesWorkspace(supabase, {
          query: args.query,
          limit: args.limit,
        }),
    }),

    buscarProspectos: tool({
      description:
        'Busca prospectos/leads por texto libre (nombre, teléfono, email, notas). Usa FTS + trigram.',
      inputSchema: z.object({
        query: z.string().describe('Texto a buscar'),
        limit: z.number().optional().describe('Máximo de resultados (default 6)'),
      }),
      execute: async (args) =>
        fn.buscarProspectosWorkspace(supabase, {
          query: args.query,
          limit: args.limit,
        }),
    }),

    buscarPolizas: tool({
      description:
        'Busca pólizas por texto (número de póliza, aseguradora, categoría/ramo). Usa FTS + trigram.',
      inputSchema: z.object({
        query: z.string().describe('Texto a buscar'),
        limit: z.number().optional().describe('Máximo de resultados (default 6)'),
      }),
      execute: async (args) =>
        fn.buscarPolizasWorkspace(supabase, {
          query: args.query,
          limit: args.limit,
        }),
    }),

    listarClientes: tool({
      description:
        'Lista clientes (últimos registrados por defecto). No necesita criterio de búsqueda.',
      inputSchema: z.object({
        limit: z.number().optional().describe('Máximo de clientes (default 12)'),
      }),
      execute: async (args) =>
        fn.listarClientesWorkspace(supabase, { limit: args.limit }),
    }),

    contarClientes: tool({
      description: 'Devuelve el número total de clientes.',
      inputSchema: z.object({}),
      execute: async () => fn.contarClientesWorkspace(supabase),
    }),

    calcularEdadPromedioClientes: tool({
      description:
        'Calcula la edad promedio de los clientes usando la columna age o birthday.',
      inputSchema: z.object({
        sampleLimit: z.number().optional().describe('Clientes a muestrear (default 200)'),
      }),
      execute: async (args) =>
        fn.calcularEdadPromedioClientesWorkspace(supabase, {
          sampleLimit: args.sampleLimit,
        }),
    }),

    obtenerContextoOperativo: tool({
      description:
        'Snapshot compacto del estado operativo: tareas próximas, leads recientes, pólizas recientes y próximas a vencer. Úsalo al inicio de la conversación o cuando el usuario pida un resumen general.',
      inputSchema: z.object({}),
      execute: async () =>
        fn.obtenerContextoOperativoWorkspaceConCache(supabase, { tz, nowIso }),
    }),

    crearTarea: tool({
      description:
        'Crea una nueva tarea/recordatorio. Ideal para "recuérdame llamar a X mañana". Requiere confirmación explícita.',
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        due_at: z.string().optional().describe('Fecha/hora ISO de vencimiento'),
        priority: z.enum(['alta', 'media', 'baja']).optional(),
        kind: z.string().optional().describe("Tipo: 'llamada', 'correo', 'reunion', 'seguimiento', 'otro'"),
        entity_type: z.string().optional().describe("'cliente' | 'prospecto' | null"),
        entity_id: z.string().optional().describe('ID del cliente o prospecto asociado'),
        confirm: z.boolean(),
      }),
      execute: async (args) => {
        if (!args.confirm) {
          return { ok: false, requires_confirmation: true, message: 'Falta confirmación explícita para crear tarea.' }
        }

        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        const dueAt = args.due_at ? new Date(args.due_at) : null
        if (dueAt && Number.isNaN(dueAt.getTime())) return { ok: false, error: 'Fecha inválida.' }

        const payload = {
          user_id: userId,
          title: String(args.title).trim(),
          due_at: dueAt?.toISOString() || null,
          status: 'pendiente',
          priority: args.priority || 'media',
          kind: args.kind || 'otro',
          entity_type: args.entity_type || null,
          entity_id: args.entity_id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const { data, error } = await supabase
          .from(DATABASE.TABLES.WS_TASKS)
          .insert([payload])
          .select('id,title,due_at,status,priority,kind')
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, task: data }
      },
    }),

    obtenerDetalleCliente: tool({
      description:
        'Obtiene el perfil completo de un cliente: datos personales, sus pólizas y tareas pendientes, todo en una sola llamada.',
      inputSchema: z.object({
        client_id: z.string().min(1).describe('ID del cliente'),
      }),
      execute: async (args) => {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        const { data: client, error: clientErr } = await supabase
          .from(DATABASE.TABLES.WS_CUSTOMERS_2)
          .select('id,name,last_name,full_name,email,phone,age,birthday,status,insurance_type,ocupation,notes,created_at')
          .eq('id', args.client_id)
          .eq('user_id', userId)
          .maybeSingle()
        if (clientErr) return { ok: false, error: clientErr.message }
        if (!client) return { ok: false, error: 'Cliente no encontrado.' }

        const { data: policies } = await supabase
          .from(DATABASE.TABLES.WS_POLICIES)
          .select('id,policy_number,insurance_company,category,status,total_premium,frecuencia_pago,effective_date,expiry_date')
          .eq('customer_id', args.client_id)
          .eq('user_id', userId)
          .order('expiry_date', { ascending: true })
          .limit(20)

        const { data: tasks } = await supabase
          .from(DATABASE.TABLES.WS_TASKS)
          .select('id,title,due_at,status,priority,kind')
          .eq('entity_type', 'cliente')
          .eq('entity_id', args.client_id)
          .eq('user_id', userId)
          .order('due_at', { ascending: true })
          .limit(10)

        return {
          ok: true,
          client,
          policies: policies || [],
          pending_tasks: (tasks || []).filter((t: Record<string, unknown>) => t.status !== 'completada' && t.status !== 'done'),
        }
      },
    }),

    crearCliente: tool({
      description:
        'Crea un nuevo cliente. Requiere confirmación explícita del usuario.',
      inputSchema: z.object({
        name: z.string().min(1),
        last_name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        age: z.number().optional(),
        birthday: z.string().optional(),
        status: z.string().optional(),
        insurance_type: z.string().optional(),
        ocupation: z.string().optional(),
        notes: z.string().optional(),
        confirm: z.boolean(),
      }),
      execute: async (args) => {
        if (!args.confirm) {
          return { ok: false, requires_confirmation: true, message: 'Falta confirmación explícita para crear cliente.' }
        }

        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        const first = String(args.name).trim()
        const last = String(args.last_name || '').trim()
        const payload = {
          user_id: userId,
          name: first,
          last_name: last || null,
          full_name: `${first} ${last}`.trim(),
          email: args.email ? normalizeEmail(args.email) : null,
          phone: String(args.phone || '').trim() || null,
          age: args.age ?? null,
          birthday: args.birthday || null,
          status: String(args.status || '').trim() || 'activo',
          insurance_type: String(args.insurance_type || '').trim() || null,
          ocupation: String(args.ocupation || '').trim() || null,
          notes: String(args.notes || '').trim() || null,
          updated_at: new Date().toISOString(),
        }

        const { data, error } = await supabase
          .from(DATABASE.TABLES.WS_CUSTOMERS_2)
          .insert([payload])
          .select('id,name,last_name,full_name,email,phone,status,insurance_type')
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, client: data }
      },
    }),

    editarCliente: tool({
      description:
        'Edita un cliente existente (nombre, correo, teléfono, notas, etc.). Requiere confirmación explícita.',
      inputSchema: z.object({
        id: z.string().min(1),
        name: z.string().optional(),
        last_name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        age: z.number().optional(),
        birthday: z.string().optional(),
        status: z.string().optional(),
        insurance_type: z.string().optional(),
        ocupation: z.string().optional(),
        notes: z.string().optional(),
        confirm: z.boolean(),
      }),
      execute: async (args) => {
        if (!args.confirm) {
          return { ok: false, requires_confirmation: true, message: 'Falta confirmación explícita para editar cliente.' }
        }

        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (args.name !== undefined) patch.name = String(args.name).trim() || null
        if (args.last_name !== undefined) patch.last_name = String(args.last_name).trim() || null
        if (args.name !== undefined || args.last_name !== undefined) {
          const n = args.name !== undefined ? String(args.name).trim() : ''
          const l = args.last_name !== undefined ? String(args.last_name).trim() : ''
          if (n || l) patch.full_name = `${n} ${l}`.trim()
        }
        if (args.email !== undefined) patch.email = args.email ? normalizeEmail(args.email) : null
        if (args.phone !== undefined) patch.phone = String(args.phone).trim() || null
        if (args.age !== undefined) patch.age = args.age
        if (args.birthday !== undefined) patch.birthday = args.birthday || null
        if (args.status !== undefined) patch.status = String(args.status).trim() || null
        if (args.insurance_type !== undefined) patch.insurance_type = String(args.insurance_type).trim() || null
        if (args.ocupation !== undefined) patch.ocupation = String(args.ocupation).trim() || null
        if (args.notes !== undefined) patch.notes = String(args.notes).trim() || null

        const { data, error } = await supabase
          .from(DATABASE.TABLES.WS_CUSTOMERS_2)
          .update(patch)
          .eq('id', args.id)
          .eq('user_id', userId)
          .select('id,name,last_name,full_name,email,phone,status,insurance_type')
          .maybeSingle()
        if (error) return { ok: false, error: error.message }
        if (!data) return { ok: false, error: 'Cliente no encontrado.' }
        return { ok: true, client: data }
      },
    }),

    promoverProspectoACliente: tool({
      description:
        'Convierte un prospecto en cliente: copia sus datos a clientes y marca el prospecto como "convertido". Requiere confirmación explícita.',
      inputSchema: z.object({
        lead_id: z.string().min(1),
        insurance_type: z.string().optional(),
        notes: z.string().optional(),
        confirm: z.boolean(),
      }),
      execute: async (args) => {
        if (!args.confirm) {
          return { ok: false, requires_confirmation: true, message: 'Falta confirmación para promover prospecto a cliente.' }
        }

        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        const { data: lead, error: leadErr } = await supabase
          .from(DATABASE.TABLES.WS_LEADS)
          .select('id,name,last_name,email,phone,insurance_type,notes')
          .eq('id', args.lead_id)
          .eq('user_id', userId)
          .maybeSingle()
        if (leadErr) return { ok: false, error: leadErr.message }
        if (!lead) return { ok: false, error: 'Prospecto no encontrado.' }

        const first = String((lead as Record<string, unknown>).name || '').trim()
        const last = String((lead as Record<string, unknown>).last_name || '').trim()
        const clientPayload = {
          user_id: userId,
          name: first,
          last_name: last || null,
          full_name: `${first} ${last}`.trim(),
          email: (lead as Record<string, unknown>).email ? normalizeEmail(String((lead as Record<string, unknown>).email)) : null,
          phone: String((lead as Record<string, unknown>).phone || '').trim() || null,
          status: 'activo',
          insurance_type: args.insurance_type || String((lead as Record<string, unknown>).insurance_type || '').trim() || null,
          notes: args.notes || String((lead as Record<string, unknown>).notes || '').trim() || null,
          updated_at: new Date().toISOString(),
        }

        const { data: newClient, error: insertErr } = await supabase
          .from(DATABASE.TABLES.WS_CUSTOMERS_2)
          .insert([clientPayload])
          .select('id,name,last_name,full_name,email,phone,status')
          .single()
        if (insertErr) return { ok: false, error: insertErr.message }

        await supabase
          .from(DATABASE.TABLES.WS_LEADS)
          .update({ stage: 'Convertido', status: 'convertido', updated_at: new Date().toISOString() })
          .eq('id', args.lead_id)
          .eq('user_id', userId)

        return { ok: true, client: newClient, message: 'Prospecto convertido a cliente exitosamente.' }
      },
    }),

    crearProspecto: tool({
      description:
        'Crea un nuevo prospecto (lead). Requiere confirmación explícita del usuario.',
      inputSchema: z.object({
        name: z.string().min(1),
        last_name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        stage: z.string().optional(),
        status: z.string().optional(),
        insurance_type: z.string().optional(),
        estimated_value: z.number().optional(),
        notes: z.string().optional(),
        confirm: z.boolean(),
      }),
      execute: async (args) => {
        if (!args.confirm) {
          return { ok: false, requires_confirmation: true, message: 'Falta confirmación explícita para crear prospecto.' }
        }

        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        const payload = {
          user_id: userId,
          name: String(args.name).trim(),
          last_name: String(args.last_name || '').trim() || null,
          email: args.email ? normalizeEmail(args.email) : null,
          phone: String(args.phone || '').trim() || null,
          stage: String(args.stage || '').trim() || 'Primer contacto',
          status: String(args.status || '').trim() || 'nuevo',
          insurance_type: String(args.insurance_type || '').trim() || null,
          estimated_value: args.estimated_value ?? null,
          notes: String(args.notes || '').trim() || null,
          updated_at: new Date().toISOString(),
        }

        const { data, error } = await supabase
          .from(DATABASE.TABLES.WS_LEADS)
          .insert([payload])
          .select('id,name,last_name,email,phone,stage,status,insurance_type,estimated_value')
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, lead: data }
      },
    }),

    editarProspecto: tool({
      description:
        'Edita un prospecto existente (por ejemplo correo, teléfono, etapa o notas). Requiere confirmación explícita.',
      inputSchema: z.object({
        id: z.string().min(1),
        name: z.string().optional(),
        last_name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        stage: z.string().optional(),
        status: z.string().optional(),
        insurance_type: z.string().optional(),
        estimated_value: z.number().optional(),
        notes: z.string().optional(),
        confirm: z.boolean(),
      }),
      execute: async (args) => {
        if (!args.confirm) {
          return { ok: false, requires_confirmation: true, message: 'Falta confirmación explícita para editar prospecto.' }
        }

        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (args.name !== undefined) patch.name = String(args.name).trim() || null
        if (args.last_name !== undefined) patch.last_name = String(args.last_name).trim() || null
        if (args.email !== undefined) patch.email = args.email ? normalizeEmail(args.email) : null
        if (args.phone !== undefined) patch.phone = String(args.phone).trim() || null
        if (args.stage !== undefined) patch.stage = String(args.stage).trim() || null
        if (args.status !== undefined) patch.status = String(args.status).trim() || null
        if (args.insurance_type !== undefined) patch.insurance_type = String(args.insurance_type).trim() || null
        if (args.estimated_value !== undefined) patch.estimated_value = args.estimated_value
        if (args.notes !== undefined) patch.notes = String(args.notes).trim() || null

        const { data, error } = await supabase
          .from(DATABASE.TABLES.WS_LEADS)
          .update(patch)
          .eq('id', args.id)
          .eq('user_id', userId)
          .select('id,name,last_name,email,phone,stage,status,insurance_type,estimated_value')
          .maybeSingle()
        if (error) return { ok: false, error: error.message }
        if (!data) return { ok: false, error: 'Prospecto no encontrado.' }
        return { ok: true, lead: data }
      },
    }),

    listarPlantillasCorreo: tool({
      description: 'Lista plantillas de correo del usuario para elegir antes de enviar.',
      inputSchema: z.object({
        limit: z.number().optional(),
      }),
      execute: async (args) => {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }
        const limit = Math.max(1, Math.min(50, Number(args.limit || 10)))

        const { data, error } = await supabase
          .from(DATABASE.TABLES.WS_EMAIL_TEMPLATES)
          .select('id,name,category,subject,updated_at')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(limit)
        if (error) return { ok: false, error: error.message }
        return { ok: true, templates: data || [] }
      },
    }),

    obtenerFirmaCorreo: tool({
      description: 'Obtiene firma de correo configurada para decidir si se agrega.',
      inputSchema: z.object({}),
      execute: async () => {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        const { data, error } = await supabase
          .from(DATABASE.TABLES.WS_EMAIL_SIGNATURES)
          .select('signature_name,include_signature,logo_url,phone,footer_text,links,updated_at')
          .eq('user_id', userId)
          .maybeSingle()
        if (error) return { ok: false, error: error.message }
        return { ok: true, signature: data || null }
      },
    }),

    enviarCorreo: tool({
      description: 'Envía un correo real por Gmail. Requiere confirmación explícita.',
      inputSchema: z.object({
        to: z.string().email(),
        subject: z.string().min(1).max(250),
        html: z.string().optional(),
        text: z.string().optional(),
        confirm: z.boolean(),
      }),
      execute: async (args) => {
        if (!args.confirm) {
          return { ok: false, requires_confirmation: true, message: 'Falta confirmación explícita para enviar correo.' }
        }

        const { data: authData } = await supabase.auth.getUser()
        const user = authData.user
        if (!user) return { ok: false, error: 'No autorizado' }

        const to = normalizeEmail(args.to)
        if (!isValidEmail(to)) return { ok: false, error: 'Email inválido' }
        let subject = String(args.subject || '').trim()
        let html = args.html?.trim()
        let text = args.text?.trim()
        if (!subject) return { ok: false, error: 'Asunto requerido' }
        if (!html && !text) return { ok: false, error: 'Debes incluir html o text' }

        const senderName = await resolveSenderName(user.id, user.email)
        subject = applySenderPlaceholder(subject, senderName)
        if (html) html = applySenderPlaceholder(html, senderName)
        if (text) text = applySenderPlaceholder(text, senderName)

        const tok = await getGmailAccessTokenForUser(supabase, user.id)
        const raw = buildRawMessage({
          from: tok.providerEmail ?? null,
          to,
          subject,
          html,
          text,
        })

        const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tok.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw }),
        })
        if (!gmailRes.ok) {
          const detail = await gmailRes.text().catch(() => '')
          return { ok: false, error: 'gmail_send_failed', detail: detail.slice(0, 600) }
        }

        const data = (await gmailRes.json()) as { id?: string }
        await supabase.from(DATABASE.TABLES.WS_GMAIL_SENT_EMAILS).insert([
          {
            user_id: user.id,
            to_email: to,
            subject,
            audience: 'single',
            gmail_message_id: data?.id ?? null,
          },
        ])
        return { ok: true, to, subject, gmail_message_id: data?.id ?? null }
      },
    }),

    programarCorreo: tool({
      description: 'Programa un correo para envío futuro (ej. en 5 minutos). Requiere confirmación explícita.',
      inputSchema: z.object({
        to: z.string().email(),
        subject: z.string().min(1).max(250),
        html: z.string().optional(),
        text: z.string().optional(),
        sendInMinutes: z.number().optional(),
        scheduledForIso: z.string().optional(),
        timezone: z.string().optional(),
        confirm: z.boolean(),
      }),
      execute: async (args) => {
        if (!args.confirm) {
          return { ok: false, requires_confirmation: true, message: 'Falta confirmación explícita para programar correo.' }
        }
        const { data: authData } = await supabase.auth.getUser()
        const user = authData.user
        if (!user) return { ok: false, error: 'No autorizado' }

        const to = normalizeEmail(args.to)
        if (!isValidEmail(to)) return { ok: false, error: 'Email inválido' }
        let subject = String(args.subject || '').trim()
        let html = args.html?.trim()
        let text = args.text?.trim()
        if (!subject) return { ok: false, error: 'Asunto requerido' }
        if (!html && !text) return { ok: false, error: 'Debes incluir html o text' }

        const senderName = await resolveSenderName(user.id, user.email)
        subject = applySenderPlaceholder(subject, senderName)
        if (html) html = applySenderPlaceholder(html, senderName)
        if (text) text = applySenderPlaceholder(text, senderName)

        const parsedDate = args.scheduledForIso ? new Date(args.scheduledForIso) : null
        const hasIso = parsedDate && !Number.isNaN(parsedDate.getTime())
        const sendInMinutes = Math.max(1, Number(args.sendInMinutes || 5))
        const scheduledFor = hasIso ? parsedDate : new Date(Date.now() + sendInMinutes * 60_000)
        if (Number.isNaN(scheduledFor.getTime())) return { ok: false, error: 'Horario inválido' }
        if (scheduledFor.getTime() < Date.now() + 30_000) {
          return { ok: false, error: 'El horario debe ser al menos 30 segundos en el futuro.' }
        }

        const timezone = String(args.timezone || tz || 'America/Mexico_City')
        const { data, error } = await supabase
          .from(DATABASE.TABLES.WS_SCHEDULED_EMAILS)
          .insert([
            {
              user_id: user.id,
              audience: null,
              recipients: [to],
              subject,
              text: text || null,
              html: html || null,
              scheduled_for: scheduledFor.toISOString(),
              timezone,
              status: 'pending',
            },
          ])
          .select('id,scheduled_for,status,subject,timezone')
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, scheduled: data }
      },
    }),

    agendarReunionGoogle: tool({
      description: 'Crea una reunión en Google Calendar. Requiere confirmación explícita.',
      inputSchema: z.object({
        summary: z.string().min(1).max(200),
        startIso: z.string(),
        endIso: z.string().optional(),
        durationMinutes: z.number().optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        attendees: z.array(z.string().email()).optional(),
        timeZone: z.string().optional(),
        includeMeetLink: z.boolean().optional(),
        confirm: z.boolean(),
      }),
      execute: async (args) => {
        if (!args.confirm) {
          return { ok: false, requires_confirmation: true, message: 'Falta confirmación para agendar reunión.' }
        }
        const { data: authData } = await supabase.auth.getUser()
        const user = authData.user
        if (!user) return { ok: false, error: 'No autorizado' }

        const { data: conn, error: connErr } = await supabase
          .from(DATABASE.TABLES.WS_GMAIL_CONNECTIONS)
          .select('scope')
          .eq('user_id', user.id)
          .maybeSingle<{ scope: string | null }>()
        if (connErr) return { ok: false, error: connErr.message }
        if (!conn || !hasCalendarScope(conn.scope)) {
          return { ok: false, error: 'calendar_not_connected', message: 'Conecta Google Calendar primero.' }
        }

        const start = new Date(args.startIso)
        if (Number.isNaN(start.getTime())) return { ok: false, error: 'startIso inválido' }
        const end = args.endIso
          ? new Date(args.endIso)
          : new Date(start.getTime() + Math.max(5, Number(args.durationMinutes || 30)) * 60_000)
        if (Number.isNaN(end.getTime())) return { ok: false, error: 'endIso inválido' }
        if (end.getTime() <= start.getTime()) return { ok: false, error: 'La hora de fin debe ser mayor.' }

        const tok = await getGmailAccessTokenForUser(supabase, user.id)
        const timeZone = String(args.timeZone || tz || 'America/Mexico_City')
        const includeMeet = args.includeMeetLink !== false

        const payload: Record<string, unknown> = {
          summary: String(args.summary).trim(),
          description: args.description?.trim() || undefined,
          location: args.location?.trim() || undefined,
          start: { dateTime: start.toISOString(), timeZone },
          end: { dateTime: end.toISOString(), timeZone },
          attendees: (args.attendees || []).map((email) => ({ email: normalizeEmail(email) })),
        }
        if (includeMeet) {
          payload.conferenceData = {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          }
        }

        const query = includeMeet ? '?conferenceDataVersion=1' : ''
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${query}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tok.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const detail = await res.text().catch(() => '')
          return { ok: false, error: 'calendar_create_failed', detail: detail.slice(0, 700) }
        }

        const data = (await res.json()) as {
          id?: string
          summary?: string
          status?: string
          htmlLink?: string
          hangoutLink?: string
          start?: unknown
          end?: unknown
        }
        return {
          ok: true,
          event: {
            id: data.id || null,
            summary: data.summary || null,
            status: data.status || null,
            htmlLink: data.htmlLink || null,
            hangoutLink: data.hangoutLink || null,
            start: data.start || null,
            end: data.end || null,
          },
        }
      },
    }),

    buscarReunionesGoogle: tool({
      description: 'Busca reuniones en Google Calendar por texto/rango de fechas.',
      inputSchema: z.object({
        query: z.string().optional(),
        timeMinIso: z.string().optional(),
        timeMaxIso: z.string().optional(),
        limit: z.number().optional(),
      }),
      execute: async (args) => {
        const { data: authData } = await supabase.auth.getUser()
        const user = authData.user
        if (!user) return { ok: false, error: 'No autorizado' }

        const tok = await getGmailAccessTokenForUser(supabase, user.id)
        const params = new URLSearchParams()
        params.set('singleEvents', 'true')
        params.set('orderBy', 'startTime')
        params.set('maxResults', String(Math.max(1, Math.min(50, Number(args.limit || 10)))))
        if (args.query?.trim()) params.set('q', args.query.trim())
        if (args.timeMinIso) params.set('timeMin', new Date(args.timeMinIso).toISOString())
        if (args.timeMaxIso) params.set('timeMax', new Date(args.timeMaxIso).toISOString())

        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
          { headers: { Authorization: `Bearer ${tok.accessToken}` } },
        )
        if (!res.ok) {
          const detail = await res.text().catch(() => '')
          return { ok: false, error: 'calendar_list_failed', detail: detail.slice(0, 700) }
        }
        const json = (await res.json()) as {
          items?: Array<{
            id?: string
            summary?: string
            status?: string
            htmlLink?: string
            start?: { dateTime?: string; date?: string }
            end?: { dateTime?: string; date?: string }
            organizer?: { email?: string }
          }>
        }

        const events = (json.items || []).map((e) => ({
          id: e.id || null,
          summary: e.summary || '(Sin título)',
          status: e.status || null,
          htmlLink: e.htmlLink || null,
          start: e.start?.dateTime || e.start?.date || null,
          end: e.end?.dateTime || e.end?.date || null,
          organizer: e.organizer?.email || null,
        }))

        return { ok: true, events }
      },
    }),

    editarReunionGoogle: tool({
      description: 'Edita una reunión existente de Google Calendar por id. Requiere confirmación explícita.',
      inputSchema: z.object({
        eventId: z.string().min(1),
        summary: z.string().optional(),
        startIso: z.string().optional(),
        endIso: z.string().optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        attendees: z.array(z.string().email()).optional(),
        timeZone: z.string().optional(),
        confirm: z.boolean(),
      }),
      execute: async (args) => {
        if (!args.confirm) {
          return { ok: false, requires_confirmation: true, message: 'Falta confirmación para editar reunión.' }
        }
        const { data: authData } = await supabase.auth.getUser()
        const user = authData.user
        if (!user) return { ok: false, error: 'No autorizado' }

        const tok = await getGmailAccessTokenForUser(supabase, user.id)
        const existingRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(args.eventId)}`,
          { headers: { Authorization: `Bearer ${tok.accessToken}` } },
        )
        if (!existingRes.ok) return { ok: false, error: 'No se encontró la reunión a editar.' }
        const existing = (await existingRes.json()) as Record<string, unknown>

        const timeZone = String(args.timeZone || tz || 'America/Mexico_City')
        if (args.summary !== undefined) existing.summary = args.summary.trim()
        if (args.description !== undefined) existing.description = args.description.trim()
        if (args.location !== undefined) existing.location = args.location.trim()
        if (args.attendees !== undefined) {
          existing.attendees = args.attendees.map((email) => ({ email: normalizeEmail(email) }))
        }
        if (args.startIso !== undefined) {
          const start = new Date(args.startIso)
          if (Number.isNaN(start.getTime())) return { ok: false, error: 'startIso inválido' }
          existing.start = { dateTime: start.toISOString(), timeZone }
        }
        if (args.endIso !== undefined) {
          const end = new Date(args.endIso)
          if (Number.isNaN(end.getTime())) return { ok: false, error: 'endIso inválido' }
          existing.end = { dateTime: end.toISOString(), timeZone }
        }

        const updateRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(args.eventId)}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${tok.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(existing),
          },
        )
        if (!updateRes.ok) {
          const detail = await updateRes.text().catch(() => '')
          return { ok: false, error: 'calendar_update_failed', detail: detail.slice(0, 700) }
        }
        const data = (await updateRes.json()) as { id?: string; summary?: string; status?: string; htmlLink?: string }
        return { ok: true, event: data }
      },
    }),

    cancelarReunionGoogle: tool({
      description: 'Cancela una reunión existente de Google Calendar por id. Requiere confirmación explícita.',
      inputSchema: z.object({
        eventId: z.string().min(1),
        confirm: z.boolean(),
      }),
      execute: async (args) => {
        if (!args.confirm) {
          return { ok: false, requires_confirmation: true, message: 'Falta confirmación para cancelar reunión.' }
        }
        const { data: authData } = await supabase.auth.getUser()
        const user = authData.user
        if (!user) return { ok: false, error: 'No autorizado' }

        const tok = await getGmailAccessTokenForUser(supabase, user.id)
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(args.eventId)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${tok.accessToken}` },
          },
        )
        if (!res.ok) {
          const detail = await res.text().catch(() => '')
          return { ok: false, error: 'calendar_delete_failed', detail: detail.slice(0, 700) }
        }
        return { ok: true, canceled: true, eventId: args.eventId }
      },
    }),

    listarTiposEventoCalendly: tool({
      description: 'Lista tipos de evento activos de Calendly del usuario.',
      inputSchema: z.object({
        limit: z.number().optional(),
      }),
      execute: async (args) => {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        const { data: conn } = await supabase
          .from(DATABASE.TABLES.WS_CALENDLY_CONNECTIONS)
          .select('calendly_user_uri,organization_uri')
          .eq('user_id', userId)
          .maybeSingle<{ calendly_user_uri: string | null; organization_uri: string | null }>()

        let accessToken: string
        let calendlyUserUri: string | null
        try {
          const token = await getCalendlyAccessTokenForUser(supabase, userId)
          accessToken = token.accessToken
          calendlyUserUri = token.calendlyUserUri ?? conn?.calendly_user_uri ?? null
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Calendly no conectado' }
        }

        const params = new URLSearchParams()
        params.set('count', String(Math.max(1, Math.min(50, Number(args.limit || 10)))))
        params.set('active', 'true')
        if (calendlyUserUri) params.set('user', calendlyUserUri)
        else if (conn?.organization_uri) params.set('organization', conn.organization_uri)

        const res = await fetch(`https://api.calendly.com/event_types?${params.toString()}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        })
        if (!res.ok) {
          const detail = await res.text().catch(() => '')
          return { ok: false, error: 'calendly_api_failed', detail: detail.slice(0, 700) }
        }
        const json = (await res.json()) as {
          collection?: Array<{ uri?: string; name?: string; scheduling_url?: string; duration?: number }>
        }
        return {
          ok: true,
          event_types: (json.collection || []).map((i) => ({
            uri: i.uri || null,
            name: i.name || 'Evento sin nombre',
            scheduling_url: i.scheduling_url || null,
            duration: i.duration || null,
          })),
        }
      },
    }),

    crearLinkCalendly: tool({
      description: 'Genera link de Calendly para compartir (opcionalmente prellenado).',
      inputSchema: z.object({
        eventTypeUri: z.string().optional(),
        eventTypeName: z.string().optional(),
        prefillName: z.string().optional(),
        prefillEmail: z.string().email().optional(),
      }),
      execute: async (args) => {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        const { data: conn } = await supabase
          .from(DATABASE.TABLES.WS_CALENDLY_CONNECTIONS)
          .select('calendly_user_uri,organization_uri')
          .eq('user_id', userId)
          .maybeSingle<{ calendly_user_uri: string | null; organization_uri: string | null }>()

        let accessToken: string
        let calendlyUserUri: string | null
        try {
          const token = await getCalendlyAccessTokenForUser(supabase, userId)
          accessToken = token.accessToken
          calendlyUserUri = token.calendlyUserUri ?? conn?.calendly_user_uri ?? null
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Calendly no conectado' }
        }

        const params = new URLSearchParams()
        params.set('count', '50')
        params.set('active', 'true')
        if (calendlyUserUri) params.set('user', calendlyUserUri)
        else if (conn?.organization_uri) params.set('organization', conn.organization_uri)

        const typesRes = await fetch(`https://api.calendly.com/event_types?${params.toString()}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        })
        if (!typesRes.ok) {
          const detail = await typesRes.text().catch(() => '')
          return { ok: false, error: 'calendly_api_failed', detail: detail.slice(0, 700) }
        }
        const json = (await typesRes.json()) as {
          collection?: Array<{ uri?: string; name?: string; scheduling_url?: string }>
        }
        const eventTypes = (json.collection || []).map((i) => ({
          uri: i.uri || null,
          name: i.name || 'Evento sin nombre',
          scheduling_url: i.scheduling_url || null,
        }))
        if (eventTypes.length === 0) {
          return { ok: false, error: 'No hay tipos de evento activos en Calendly.' }
        }

        let selected = eventTypes[0]!
        if (args.eventTypeUri) {
          const byUri = eventTypes.find((x) => x.uri === args.eventTypeUri)
          if (!byUri) return { ok: false, error: 'No se encontró el tipo de evento por URI.' }
          selected = byUri
        } else if (args.eventTypeName) {
          const q = args.eventTypeName.toLowerCase().trim()
          const byName = eventTypes.find((x) => String(x.name || '').toLowerCase().includes(q))
          if (!byName) {
            return { ok: false, error: 'No se encontró un tipo de evento con ese nombre.', options: eventTypes.slice(0, 10) }
          }
          selected = byName
        }

        const base = String(selected.scheduling_url || '').trim()
        if (!base) return { ok: false, error: 'El tipo de evento seleccionado no tiene scheduling_url.' }
        const link = new URL(base)
        if (args.prefillName) link.searchParams.set('name', args.prefillName.trim())
        if (args.prefillEmail) link.searchParams.set('email', normalizeEmail(args.prefillEmail))

        return {
          ok: true,
          link: link.toString(),
          event_type: { uri: selected.uri || null, name: selected.name || null },
        }
      },
    }),

    listarAutomatizaciones: tool({
      description: 'Lista automatizaciones del usuario (activas/inactivas).',
      inputSchema: z.object({}),
      execute: async () => {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        const { data, error } = await supabase
          .from(DATABASE.TABLES.WS_AUTOMATIONS)
          .select('key,enabled,config')
          .eq('user_id', userId)
        if (error) return { ok: false, error: error.message }

        const byKey = new Map<string, any>()
        ;(data || []).forEach((row: any) => byKey.set(String(row.key || ''), row))
        const automations = DEFAULT_AUTOMATIONS.map((base) => {
          const row = byKey.get(base.key)
          return row
            ? { key: row.key, enabled: Boolean(row.enabled), config: row.config || {} }
            : base
        })

        return { ok: true, automations }
      },
    }),

    configurarAutomatizacion: tool({
      description:
        'Activa/desactiva o configura automatizaciones (cumpleaños y renovaciones). Requiere confirmación explícita.',
      inputSchema: z.object({
        key: z.string(),
        enabled: z.boolean(),
        days_before: z.number().optional(),
        timezone: z.string().optional(),
        template_id: z.string().optional(),
        confirm: z.boolean(),
      }),
      execute: async (args) => {
        if (!args.confirm) {
          return { ok: false, requires_confirmation: true, message: 'Falta confirmación explícita.' }
        }
        if (!isAutomationKey(args.key)) return { ok: false, error: 'key inválido' }

        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        const base = DEFAULT_AUTOMATIONS.find((x) => x.key === args.key)
        const config = {
          ...(base?.config || {}),
          ...(args.days_before !== undefined
            ? { days_before: Math.max(1, Math.min(120, Number(args.days_before))) }
            : {}),
          ...(args.timezone ? { timezone: String(args.timezone).trim() } : {}),
          ...(args.template_id !== undefined ? { template_id: String(args.template_id || '').trim() || null } : {}),
        }

        const payload = {
          user_id: userId,
          key: args.key,
          enabled: args.enabled === true,
          config,
          updated_at: new Date().toISOString(),
        }

        const { data, error } = await supabase
          .from(DATABASE.TABLES.WS_AUTOMATIONS)
          .upsert([payload], { onConflict: 'user_id,key' })
          .select('key,enabled,config')
          .single()
        if (error) return { ok: false, error: error.message }

        return { ok: true, automation: data }
      },
    }),

    listarNotificacionesAutomatizacion: tool({
      description: 'Lista notificaciones de automatizaciones.',
      inputSchema: z.object({
        limit: z.number().optional(),
      }),
      execute: async (args) => {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }
        const limit = Math.max(1, Math.min(200, Number(args.limit || 30)))

        const { data, error } = await supabase
          .from(DATABASE.TABLES.WS_AUTOMATION_LOGS)
          .select('id,automation_key,target_table,status,message,run_date,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit)
        if (error) return { ok: false, error: error.message }
        return { ok: true, logs: data || [] }
      },
    }),

    verificarConexionCalCom: tool({
      description: 'Verifica si el usuario tiene Cal.com conectado y devuelve info de la conexión.',
      inputSchema: z.object({}),
      execute: async () => {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        const { data, error } = await supabase
          .from(DATABASE.TABLES.WS_CALCOM_CONNECTIONS)
          .select('provider_email,calcom_username')
          .eq('user_id', userId)
          .maybeSingle<{ provider_email: string | null; calcom_username: string | null }>()
        if (error) return { ok: false, error: error.message }
        if (!data) return { ok: true, connected: false, message: 'Cal.com no está conectado. Puede conectarlo desde la sección de Calendario.' }
        return {
          ok: true,
          connected: true,
          email: data.provider_email || null,
          username: data.calcom_username || null,
        }
      },
    }),

    obtenerLinkCalCom: tool({
      description: 'Obtiene el link de agenda de Cal.com del usuario para compartir con prospectos/clientes. Devuelve la URL de scheduling.',
      inputSchema: z.object({}),
      execute: async () => {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        const { data, error } = await supabase
          .from(DATABASE.TABLES.WS_CALCOM_CONNECTIONS)
          .select('calcom_username,provider_email')
          .eq('user_id', userId)
          .maybeSingle<{ calcom_username: string | null; provider_email: string | null }>()
        if (error) return { ok: false, error: error.message }
        if (!data || !data.calcom_username) {
          return { ok: false, error: 'Cal.com no está conectado o no se encontró el nombre de usuario. Puede conectarlo desde la sección de Calendario.' }
        }

        let accessToken: string
        try {
          const token = await getCalComAccessTokenForUser(supabase, userId)
          accessToken = token.accessToken
        } catch (e) {
          return {
            ok: true,
            link: `https://cal.com/${data.calcom_username}`,
            username: data.calcom_username,
            event_types: [],
            note: 'No se pudieron obtener los tipos de evento específicos.',
          }
        }

        try {
          const res = await fetch(`https://api.cal.com/v2/event-types?username=${encodeURIComponent(data.calcom_username)}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'cal-api-version': '2024-08-13',
            },
            cache: 'no-store',
          })

          if (res.ok) {
            const json = (await res.json()) as {
              data?: Array<{ id?: number; slug?: string; title?: string; length?: number }>
            }
            const eventTypes = (json.data ?? []).map((et) => ({
              title: et.title || 'Evento',
              duration: et.length || null,
              link: et.slug ? `https://cal.com/${data.calcom_username}/${et.slug}` : null,
            }))

            return {
              ok: true,
              link: `https://cal.com/${data.calcom_username}`,
              username: data.calcom_username,
              event_types: eventTypes,
            }
          }
        } catch {
          // Fall through to basic link
        }

        return {
          ok: true,
          link: `https://cal.com/${data.calcom_username}`,
          username: data.calcom_username,
          event_types: [],
        }
      },
    }),

    buscarReunionesCalCom: tool({
      description: 'Lista próximas reuniones/bookings de Cal.com del usuario.',
      inputSchema: z.object({
        limit: z.number().optional().describe('Máximo de bookings (default 10, max 50)'),
      }),
      execute: async (args) => {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        const { data: conn } = await supabase
          .from(DATABASE.TABLES.WS_CALCOM_CONNECTIONS)
          .select('provider_email')
          .eq('user_id', userId)
          .maybeSingle<{ provider_email: string | null }>()
        if (!conn) return { ok: false, error: 'Cal.com no está conectado. Puede conectarlo desde la sección de Calendario.' }

        let accessToken: string
        try {
          const token = await getCalComAccessTokenForUser(supabase, userId)
          accessToken = token.accessToken
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Error obteniendo token de Cal.com' }
        }

        const max = Math.max(1, Math.min(50, Number(args.limit || 10)))
        const params = new URLSearchParams()
        params.set('afterStart', new Date().toISOString())
        params.set('take', String(max))
        params.set('sortStart', 'asc')

        const res = await fetch(`https://api.cal.com/v2/bookings?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'cal-api-version': '2024-08-13',
          },
          cache: 'no-store',
        })

        if (!res.ok) {
          const detail = await res.text().catch(() => '')
          return { ok: false, error: 'calcom_api_failed', detail: detail.slice(0, 600) }
        }

        const json = (await res.json()) as {
          data?: Array<{
            id?: number
            uid?: string
            title?: string
            status?: string
            start?: string
            end?: string
            location?: string
            meetingUrl?: string
          }>
        }

        const bookings = (json.data ?? []).map((b) => ({
          id: b.uid ?? String(b.id ?? ''),
          title: b.title ?? 'Evento Cal.com',
          status: b.status ?? 'accepted',
          start: b.start ?? null,
          end: b.end ?? null,
          location: b.location ?? b.meetingUrl ?? null,
        }))

        return { ok: true, bookings }
      },
    }),

    sincronizarCalComATareas: tool({
      description: 'Sincroniza los bookings de Cal.com como tareas en Asygurare. Requiere confirmación explícita.',
      inputSchema: z.object({
        confirm: z.boolean(),
      }),
      execute: async (args) => {
        if (!args.confirm) {
          return { ok: false, requires_confirmation: true, message: 'Falta confirmación para sincronizar Cal.com.' }
        }

        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id
        if (!userId) return { ok: false, error: 'No autorizado' }

        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/cal-com/sync/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })

          if (!res.ok) {
            return { ok: false, error: 'Error al sincronizar Cal.com con tareas.' }
          }

          const data = (await res.json()) as { created?: number; updated?: number; canceled?: number; total?: number }
          return {
            ok: true,
            message: `Sincronización completada: ${data.created ?? 0} creadas, ${data.updated ?? 0} actualizadas, ${data.canceled ?? 0} canceladas.`,
          }
        } catch {
          return { ok: false, error: 'No se pudo conectar con el servicio de sincronización.' }
        }
      },
    }),
  }
}
