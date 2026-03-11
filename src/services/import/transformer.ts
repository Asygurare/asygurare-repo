/**
 * Transformer – applies the user-confirmed column mapping to raw file rows
 * and produces Supabase-ready payloads.
 *
 * Responsibilities:
 *   - Coerce values to the expected type (string, number, boolean, date).
 *   - Separate direct fields from additional_fields (leads JSONB).
 *   - Validate required fields and collect per-row errors.
 *   - Return a summary with inserted count and error details.
 */

import type {
  ColumnMapping,
  FieldDescriptor,
  ImportEntity,
  ImportResult,
  ImportRowError,
} from '@/src/types/import'
import { getFieldsForEntity } from './schemas'
import { DATABASE } from '@/src/config/database'
import { supabaseClient } from '@/src/lib/supabase/client'

/** Batch size for Supabase inserts (avoids hitting payload limits). */
const BATCH_SIZE = 50

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Transform all data rows using the confirmed mapping, then bulk-insert into
 * the appropriate Supabase table.
 *
 * @param allRows   All data rows (string[][]) from the parser.
 * @param mapping   User-confirmed column mapping.
 * @param entity    'leads' | 'customers'.
 * @param onProgress Optional callback (inserted so far).
 */
export async function transformAndInsert(
  allRows: string[][],
  mapping: ColumnMapping[],
  entity: ImportEntity,
  onProgress?: (inserted: number) => void,
): Promise<ImportResult> {
  const { data: { user } } = await supabaseClient.auth.getUser()
  if (!user) throw new Error('Sesión expirada. Vuelve a iniciar sesión.')

  const fields = getFieldsForEntity(entity)
  const fieldMap = new Map<string, FieldDescriptor>()
  for (const f of fields) fieldMap.set(f.key, f)

  // Build active mappings (only those with a target assigned)
  const activeMaps = mapping.filter((m) => m.targetKey !== null)

  const table =
    entity === 'leads'
      ? DATABASE.TABLES.WS_LEADS
      : DATABASE.TABLES.WS_CUSTOMERS_2

  const errors: ImportRowError[] = []
  let inserted = 0

  // Build all payloads first, collecting validation errors
  const payloads: Record<string, unknown>[] = []

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i]
    const rowNum = i + 2 // +1 for 0-index, +1 for header row

    try {
      const payload = buildPayload(row, activeMaps, fieldMap, entity, user.id)
      payloads.push(payload)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      errors.push({ row: rowNum, message: msg })
    }
  }

  // Insert in batches
  for (let start = 0; start < payloads.length; start += BATCH_SIZE) {
    const batch = payloads.slice(start, start + BATCH_SIZE)

    const { error } = await supabaseClient.from(table).insert(batch)

    if (error) {
      // Mark all rows in the failed batch
      for (let j = 0; j < batch.length; j++) {
        const globalIdx = start + j
        errors.push({
          row: globalIdx + 2,
          message: error.message,
        })
      }
    } else {
      inserted += batch.length
      onProgress?.(inserted)
    }
  }

  return {
    total: allRows.length,
    inserted,
    errors,
  }
}

/**
 * Build a preview of transformed rows (without inserting).
 * Returns an array of objects keyed by field label for display.
 */
export function buildPreviewRows(
  sampleRows: string[][],
  mapping: ColumnMapping[],
  entity: ImportEntity,
): Record<string, string>[] {
  const fields = getFieldsForEntity(entity)
  const fieldMap = new Map<string, FieldDescriptor>()
  for (const f of fields) fieldMap.set(f.key, f)

  const activeMaps = mapping.filter((m) => m.targetKey !== null)

  return sampleRows.map((row) => {
    const preview: Record<string, string> = {}
    for (const m of activeMaps) {
      const fd = fieldMap.get(m.targetKey!)
      if (!fd) continue
      const raw = row[m.sourceIndex] ?? ''
      preview[fd.label] = raw
    }
    return preview
  })
}

// ─── Payload builder ───────────────────────────────────────────────────────────

function buildPayload(
  row: string[],
  activeMaps: ColumnMapping[],
  fieldMap: Map<string, FieldDescriptor>,
  entity: ImportEntity,
  userId: string,
): Record<string, unknown> {
  const directFields: Record<string, unknown> = {}
  const additionalFields: Record<string, unknown> = {}

  for (const m of activeMaps) {
    const fd = fieldMap.get(m.targetKey!)
    if (!fd) continue

    const raw = (row[m.sourceIndex] ?? '').trim()
    if (!raw) continue

    const coerced = coerceValue(raw, fd)

    if (fd.isAdditionalField) {
      additionalFields[fd.key] = coerced
    } else {
      directFields[fd.key] = coerced
    }
  }

  // Validate required fields
  const requiredFields = [...fieldMap.values()].filter((f) => f.required)
  for (const rf of requiredFields) {
    if (!directFields[rf.key] && !additionalFields[rf.key]) {
      throw new Error(`Campo requerido "${rf.label}" está vacío.`)
    }
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    ...directFields,
    updated_at: new Date().toISOString(),
  }

  // Leads: set defaults for status/stage if not provided
  if (entity === 'leads') {
    if (!payload.status) payload.status = 'En seguimiento'
    if (!payload.stage)  payload.stage  = 'Nuevo - Sin contactar'

    if (Object.keys(additionalFields).length > 0) {
      payload.additional_fields = additionalFields
    }
  }

  // Customers: set default status
  if (entity === 'customers') {
    if (!payload.status) payload.status = 'nuevo'
  }

  return payload
}

// ─── Type coercion ─────────────────────────────────────────────────────────────

function coerceValue(raw: string, field: FieldDescriptor): unknown {
  switch (field.type) {
    case 'number': {
      const cleaned = raw.replace(/[$,\s]/g, '')
      const n = parseFloat(cleaned)
      return Number.isFinite(n) ? n : null
    }

    case 'boolean': {
      const lower = raw.toLowerCase().trim()
      const truthy  = ['si', 'sí', 'yes', 'true', '1', 'verdadero']
      const falsy   = ['no', 'false', '0', 'falso']
      if (truthy.includes(lower)) return true
      if (falsy.includes(lower))  return false
      return null
    }

    case 'date': {
      // Try parsing common date formats
      const d = new Date(raw)
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
      // Try DD/MM/YYYY or DD-MM-YYYY
      const parts = raw.split(/[/\-.]/)
      if (parts.length === 3) {
        const [a, b, c] = parts.map(Number)
        if (c > 1000) {
          // DD/MM/YYYY
          const attempt = new Date(c, b - 1, a)
          if (!isNaN(attempt.getTime())) return attempt.toISOString().split('T')[0]
        }
      }
      return raw
    }

    case 'string':
    default:
      return raw
  }
}
