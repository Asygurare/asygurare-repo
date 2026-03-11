/**
 * File parsers for Excel (.xlsx/.xls), CSV and JSON.
 *
 * Each parser reads a browser File object and returns a standardised
 * IntrospectResult (headers + sample rows + total count).
 *
 * Excel files use SheetJS (xlsx) which also exposes column metadata such as
 * cell types, widths, etc.  CSV/JSON are parsed with lightweight heuristics
 * (no extra deps required).
 */

import * as XLSX from 'xlsx'
import type { ImportFileFormat, IntrospectResult } from '@/src/types/import'

/** Max sample rows kept in memory for preview / auto-mapping heuristics. */
const MAX_SAMPLE_ROWS = 50

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Detect the format from the file extension and delegate to the right parser.
 * Throws if the format is unsupported.
 */
export async function parseFile(file: File): Promise<IntrospectResult> {
  const format = detectFormat(file.name)
  if (!format) {
    throw new Error(
      `Formato no soportado: "${file.name.split('.').pop()}". ` +
      'Sube un archivo .xlsx, .xls, .csv o .json.'
    )
  }

  switch (format) {
    case 'xlsx':
    case 'xls':
      return parseExcel(file, format)
    case 'csv':
      return parseCsv(file)
    case 'json':
      return parseJson(file)
  }
}

// ─── Format detection ──────────────────────────────────────────────────────────

function detectFormat(filename: string): ImportFileFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'xlsx') return 'xlsx'
  if (ext === 'xls')  return 'xls'
  if (ext === 'csv')  return 'csv'
  if (ext === 'json') return 'json'
  return null
}

// ─── Excel parser ──────────────────────────────────────────────────────────────

async function parseExcel(file: File, format: ImportFileFormat): Promise<IntrospectResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('El archivo Excel no contiene hojas.')

  const sheet = workbook.Sheets[sheetName]

  // sheet_to_json with header:1 gives us an array of arrays (raw values)
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  })

  if (rawRows.length === 0) throw new Error('La hoja de cálculo está vacía.')

  const headers = rawRows[0].map((v) => String(v ?? '').trim())
  const dataRows = rawRows.slice(1)

  const sampleRows = dataRows
    .slice(0, MAX_SAMPLE_ROWS)
    .map((row) => row.map((cell) => formatCellValue(cell)))

  return {
    headers,
    sampleRows,
    totalRows: dataRows.length,
    format,
  }
}

/**
 * Convert a cell value from SheetJS to a display-friendly string.
 * Handles Dates, numbers, booleans, etc.
 */
function formatCellValue(cell: unknown): string {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date) {
    if (isNaN(cell.getTime())) return ''
    return cell.toISOString().split('T')[0]
  }
  return String(cell).trim()
}

// ─── CSV parser ────────────────────────────────────────────────────────────────

async function parseCsv(file: File): Promise<IntrospectResult> {
  const text = await file.text()
  if (!text.trim()) throw new Error('El archivo CSV está vacío.')

  const delimiter = detectCsvDelimiter(text)
  const rows = parseCsvText(text, delimiter)

  if (rows.length === 0) throw new Error('El archivo CSV está vacío.')

  const headers = rows[0].map((h) => h.trim())
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ''))

  const sampleRows = dataRows
    .slice(0, MAX_SAMPLE_ROWS)
    .map((row) => row.map((c) => c.trim()))

  return {
    headers,
    sampleRows,
    totalRows: dataRows.length,
    format: 'csv',
  }
}

/** Detect delimiter heuristically: comma vs semicolon vs tab. */
function detectCsvDelimiter(text: string): string {
  const firstLine = text.split('\n')[0] || ''
  const commas = (firstLine.match(/,/g) || []).length
  const semis  = (firstLine.match(/;/g) || []).length
  const tabs   = (firstLine.match(/\t/g) || []).length

  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t'
  if (semis > commas) return ';'
  return ','
}

/** Simple RFC-4180-ish CSV parser supporting quoted fields. */
function parseCsvText(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let current: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      current.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      current.push(cell)
      cell = ''
      if (current.length > 0) rows.push(current)
      current = []
    } else {
      cell += ch
    }
  }

  // Flush last row
  if (cell || current.length > 0) {
    current.push(cell)
    rows.push(current)
  }

  return rows
}

// ─── JSON parser ───────────────────────────────────────────────────────────────

async function parseJson(file: File): Promise<IntrospectResult> {
  const text = await file.text()
  if (!text.trim()) throw new Error('El archivo JSON está vacío.')

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('El archivo JSON no tiene un formato válido.')
  }

  // Accept an array of objects, or a single object wrapping an array
  let records: Record<string, unknown>[]

  if (Array.isArray(parsed)) {
    records = parsed.filter((r) => r && typeof r === 'object' && !Array.isArray(r))
  } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const values = Object.values(parsed as Record<string, unknown>)
    const arrValue = values.find(Array.isArray)
    if (arrValue) {
      records = (arrValue as unknown[]).filter(
        (r) => r && typeof r === 'object' && !Array.isArray(r)
      ) as Record<string, unknown>[]
    } else {
      records = [parsed as Record<string, unknown>]
    }
  } else {
    throw new Error('El JSON no contiene un arreglo de registros.')
  }

  if (records.length === 0) throw new Error('El archivo JSON no tiene registros.')

  // Derive headers from the union of all keys across records
  const keySet = new Set<string>()
  for (const rec of records) {
    for (const k of Object.keys(rec)) keySet.add(k)
  }
  const headers = Array.from(keySet)

  const sampleRows = records.slice(0, MAX_SAMPLE_ROWS).map((rec) =>
    headers.map((h) => {
      const v = rec[h]
      if (v === null || v === undefined) return ''
      if (v instanceof Date) return v.toISOString().split('T')[0]
      if (typeof v === 'object') return JSON.stringify(v)
      return String(v).trim()
    })
  )

  return {
    headers,
    sampleRows,
    totalRows: records.length,
    format: 'json',
  }
}
