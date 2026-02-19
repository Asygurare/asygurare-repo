import { tool } from 'ai'
import { z } from 'zod'
import { SupabaseClient } from '@supabase/supabase-js'
import * as fn from '@/src/lib/utils/functions'
import { DATABASE } from '@/src/config'
import { DEFAULT_AUTOMATIONS, isAutomationKey } from '@/src/services/automations/config'

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
  }
}
