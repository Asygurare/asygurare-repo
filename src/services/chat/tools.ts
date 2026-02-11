import { tool } from 'ai'
import { z } from 'zod'
import { SupabaseClient } from '@supabase/supabase-js'
import * as fn from '@/src/lib/utils/functions'

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
  }
}
