/**
 * Types for the file-import feature (prospectos & clientes).
 *
 * The import flow has four sequential steps:
 *   1. Upload  – user picks or drops a file
 *   2. Inspect – headers/preview rows are extracted
 *   3. Map     – user maps file columns → system fields
 *   4. Confirm – preview transformed rows, then bulk-insert
 */

// ─── Supported file formats ────────────────────────────────────────────────────

export type ImportFileFormat = 'xlsx' | 'xls' | 'csv' | 'json'

// ─── Entity the import targets ─────────────────────────────────────────────────

export type ImportEntity = 'leads' | 'customers'

// ─── Step tracker ──────────────────────────────────────────────────────────────

export type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'done'

// ─── Introspection result (after file is parsed) ───────────────────────────────

export interface IntrospectResult {
  headers: string[]
  /** First N rows as raw string arrays (for preview & heuristics). */
  sampleRows: string[][]
  totalRows: number
  format: ImportFileFormat
}

// ─── Field schema descriptor (system-side) ─────────────────────────────────────

export interface FieldDescriptor {
  /** DB column name (e.g. "last_name", "estimated_value"). */
  key: string
  /** Human-friendly label shown in the mapper UI. */
  label: string
  /** Data type expected by Supabase. */
  type: 'string' | 'number' | 'boolean' | 'date'
  /** Is this field required for insert? */
  required?: boolean
  /**
   * Aliases used for auto-mapping heuristics.
   * Normalised to lowercase for comparison (e.g. "apellido", "surname").
   */
  aliases: string[]
  /** If the field lives inside additional_fields JSONB (leads only). */
  isAdditionalField?: boolean
}

// ─── Column mapping (user decision) ────────────────────────────────────────────

export interface ColumnMapping {
  /** Index of the source column in the file. */
  sourceIndex: number
  /** Header text from the file. */
  sourceHeader: string
  /** Target system field key, or null if skipped. */
  targetKey: string | null
}

// ─── Import result summary ─────────────────────────────────────────────────────

export interface ImportResult {
  total: number
  inserted: number
  errors: ImportRowError[]
}

export interface ImportRowError {
  /** 1-based row number in the source file. */
  row: number
  message: string
}
