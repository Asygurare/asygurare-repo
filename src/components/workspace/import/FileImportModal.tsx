'use client'

/**
 * FileImportModal – multi-step wizard for importing prospectos or clientes
 * from Excel (.xlsx/.xls), CSV, or JSON files.
 *
 * Steps:
 *   1. Upload   – drag & drop or file picker.
 *   2. Mapping  – map file columns → system fields (auto-suggested).
 *   3. Preview  – review transformed sample rows before confirming.
 *   4. Import   – bulk insert with progress bar.
 *   5. Done     – summary with success/error counts.
 *
 * The component is entity-agnostic: pass entity="leads" or entity="customers"
 * and it will use the correct field schema and Supabase table.
 */

import React, { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Upload, FileSpreadsheet, ArrowRight, ArrowLeft,
  Loader2, CheckCircle2, AlertTriangle, ChevronDown,
  File,
} from 'lucide-react'
import type {
  ImportStep,
  ImportEntity,
  IntrospectResult,
  ColumnMapping,
  ImportResult,
} from '@/src/types/import'
import {
  parseFile,
  buildAutoMapping,
  getFieldsForEntity,
  transformAndInsert,
  buildPreviewRows,
} from '@/src/services/import'

// ─── Props ─────────────────────────────────────────────────────────────────────

interface FileImportModalProps {
  open: boolean
  onClose: () => void
  entity: ImportEntity
  /** Called after a successful import so the parent can refetch data. */
  onImportComplete?: () => void
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS = '.xlsx,.xls,.csv,.json'
const STEP_LABELS: Record<ImportStep, string> = {
  upload:    'Subir archivo',
  mapping:   'Mapear columnas',
  preview:   'Vista previa',
  importing: 'Importando…',
  done:      'Resultado',
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function FileImportModal({
  open,
  onClose,
  entity,
  onImportComplete,
}: FileImportModalProps) {
  // State
  const [step, setStep] = useState<ImportStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [introspect, setIntrospect] = useState<IntrospectResult | null>(null)
  const [allRows, setAllRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ColumnMapping[]>([])
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  const fields = getFieldsForEntity(entity)
  const entityLabel = entity === 'leads' ? 'prospectos' : 'clientes'

  // ── Reset all state ────────────────────────────────────────────────────────

  const resetState = useCallback(() => {
    setStep('upload')
    setFile(null)
    setIntrospect(null)
    setAllRows([])
    setMapping([])
    setPreviewData([])
    setResult(null)
    setProgress(0)
    setError(null)
    setLoading(false)
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [resetState, onClose])

  // ── Step 1: File upload ────────────────────────────────────────────────────

  const handleFile = useCallback(async (f: File) => {
    setFile(f)
    setError(null)
    setLoading(true)

    try {
      const result = await parseFile(f)
      setIntrospect(result)

      // Store all rows (sample rows from parser are already capped at 50, but
      // we need ALL rows for the actual insert). Re-read from the full result.
      // The parser already returns sampleRows, but for import we need to store
      // a reference to full data. We'll re-parse only at import time for huge files.
      // For now we keep sampleRows for preview & the parser's totalRows count.
      setAllRows(result.sampleRows) // Will be replaced with full data at import

      const autoMap = buildAutoMapping(result.headers, fields)
      setMapping(autoMap)
      setStep('mapping')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al leer el archivo.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [fields])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }, [handleFile])

  // ── Step 2 → 3: Confirm mapping and build preview ─────────────────────────

  const handleConfirmMapping = useCallback(() => {
    if (!introspect) return
    const mapped = mapping.filter((m) => m.targetKey !== null)
    if (mapped.length === 0) {
      setError('Mapea al menos una columna antes de continuar.')
      return
    }

    const hasRequired = fields
      .filter((f) => f.required)
      .every((f) => mapped.some((m) => m.targetKey === f.key))

    if (!hasRequired) {
      const missing = fields
        .filter((f) => f.required && !mapped.some((m) => m.targetKey === f.key))
        .map((f) => f.label)
      setError(`Faltan campos requeridos: ${missing.join(', ')}`)
      return
    }

    setError(null)
    const preview = buildPreviewRows(introspect.sampleRows.slice(0, 10), mapping, entity)
    setPreviewData(preview)
    setStep('preview')
  }, [introspect, mapping, fields, entity])

  // ── Step 3 → 4: Execute import ─────────────────────────────────────────────

  const handleStartImport = useCallback(async () => {
    if (!file || !introspect) return
    setStep('importing')
    setProgress(0)
    setError(null)

    try {
      // Re-parse to get ALL rows (not just the 50-row sample)
      const fullResult = await parseFile(file)
      const allDataRows = fullResult.sampleRows.length < fullResult.totalRows
        ? await getAllRows(file)
        : fullResult.sampleRows

      const importResult = await transformAndInsert(
        allDataRows,
        mapping,
        entity,
        (inserted) => setProgress(inserted),
      )

      setResult(importResult)
      setStep('done')
      if (importResult.inserted > 0) {
        onImportComplete?.()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al importar.'
      setError(msg)
      setStep('preview')
    }
  }, [file, introspect, mapping, entity, onImportComplete])

  // ── Mapping change handler ─────────────────────────────────────────────────

  const handleMappingChange = useCallback((colIdx: number, targetKey: string | null) => {
    setMapping((prev) => {
      const next = [...prev]

      // If another column already maps to this target, unmap it
      if (targetKey) {
        for (let i = 0; i < next.length; i++) {
          if (i !== colIdx && next[i].targetKey === targetKey) {
            next[i] = { ...next[i], targetKey: null }
          }
        }
      }

      next[colIdx] = { ...next[colIdx], targetKey }
      return next
    })
    setError(null)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ type: 'spring', damping: 25 }}
              className="w-full max-w-4xl bg-[#ece7e2] shadow-2xl rounded-[2.5rem] overflow-hidden border border-white/20 max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-8 bg-white flex items-center justify-between border-b-2 border-black/5 shadow-sm shrink-0">
                <div>
                  <h3 className="text-2xl font-black italic text-black uppercase tracking-tighter">
                    Importar {entityLabel}
                  </h3>
                  <p className="text-[10px] font-bold text-black/50 uppercase tracking-widest mt-1">
                    {STEP_LABELS[step]}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-3 hover:bg-gray-100 rounded-full text-black transition-all"
                  aria-label="Cerrar"
                >
                  <X size={28} />
                </button>
              </div>

              {/* Stepper */}
              <div className="px-8 pt-6 shrink-0">
                <div className="flex items-center gap-2">
                  {(['upload', 'mapping', 'preview', 'done'] as ImportStep[]).map((s, i, arr) => (
                    <React.Fragment key={s}>
                      <div
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                          step === s || (s === 'done' && step === 'importing')
                            ? 'bg-black text-white'
                            : getStepIndex(step) > i
                              ? 'bg-black/10 text-black'
                              : 'bg-black/5 text-black/30'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[9px]">
                          {getStepIndex(step) > i ? '✓' : i + 1}
                        </span>
                        <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
                      </div>
                      {i < arr.length - 1 && (
                        <div className={`flex-1 h-0.5 rounded ${getStepIndex(step) > i ? 'bg-black/20' : 'bg-black/5'}`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                {/* Error banner */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm font-bold text-red-700">{error}</p>
                  </div>
                )}

                {/* ── STEP 1: Upload ─────────────────────────────────── */}
                {step === 'upload' && (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`border-2 border-dashed rounded-[2rem] p-16 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${
                      loading
                        ? 'border-black/20 bg-white/50'
                        : 'border-black/20 bg-white hover:border-black/40 hover:bg-white/80'
                    }`}
                  >
                    <input
                      ref={inputRef}
                      type="file"
                      accept={ACCEPTED_EXTENSIONS}
                      onChange={handleInputChange}
                      className="hidden"
                    />
                    {loading ? (
                      <>
                        <Loader2 size={48} className="animate-spin text-black/40" />
                        <p className="text-sm font-black uppercase tracking-widest text-black/50">
                          Leyendo archivo…
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload size={48} className="text-black/30" />
                        <p className="text-sm font-black uppercase tracking-widest text-black/70">
                          Arrastra un archivo aquí
                        </p>
                        <p className="text-xs font-bold text-black/40">
                          o haz clic para seleccionar
                        </p>
                        <div className="flex gap-2 mt-2">
                          {['XLSX', 'XLS', 'CSV', 'JSON'].map((ext) => (
                            <span key={ext} className="px-3 py-1 bg-black/5 rounded-full text-[10px] font-black uppercase tracking-widest text-black/50">
                              {ext}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── STEP 2: Column mapping ─────────────────────────── */}
                {step === 'mapping' && introspect && (
                  <>
                    {/* File info */}
                    <div className="bg-white rounded-2xl p-4 flex items-center gap-4 border border-black/5">
                      <FileSpreadsheet size={24} className="text-black/40" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-black truncate">{file?.name}</p>
                        <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest">
                          {introspect.totalRows} registros · {introspect.headers.length} columnas · {introspect.format.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs font-bold text-black/50 uppercase tracking-widest">
                      Asigna cada columna del archivo a un campo del sistema. Las sugerencias automáticas se muestran preseleccionadas.
                    </p>

                    {/* Mapping table */}
                    <div className="space-y-3">
                      {mapping.map((col, idx) => (
                        <div
                          key={idx}
                          className="bg-white rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 border border-black/5"
                        >
                          {/* Source column */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <File size={16} className="text-black/30 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-black text-black truncate">{col.sourceHeader}</p>
                              {introspect.sampleRows[0]?.[idx] && (
                                <p className="text-[10px] text-black/40 truncate">
                                  Ej: {introspect.sampleRows[0][idx]}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Arrow */}
                          <ArrowRight size={16} className="text-black/20 shrink-0 hidden sm:block" />

                          {/* Target field selector */}
                          <div className="relative flex-1">
                            <select
                              value={col.targetKey || ''}
                              onChange={(e) =>
                                handleMappingChange(idx, e.target.value || null)
                              }
                              className={`w-full appearance-none bg-[#ece7e2] p-3 pr-10 rounded-xl text-sm font-black outline-none cursor-pointer border-2 transition-all ${
                                col.targetKey
                                  ? 'border-black/10 text-black'
                                  : 'border-transparent text-black/40'
                              }`}
                            >
                              <option value="">— No importar —</option>
                              {fields.map((f) => {
                                const taken = mapping.some(
                                  (m, mi) => mi !== idx && m.targetKey === f.key
                                )
                                return (
                                  <option key={f.key} value={f.key} disabled={taken}>
                                    {f.label}{f.required ? ' *' : ''}{taken ? ' (asignado)' : ''}
                                  </option>
                                )
                              })}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 pointer-events-none" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ── STEP 3: Preview ────────────────────────────────── */}
                {step === 'preview' && (
                  <>
                    <p className="text-xs font-bold text-black/50 uppercase tracking-widest">
                      Vista previa de los primeros {previewData.length} registros.
                      Revisa que los datos se vean correctos antes de importar.
                    </p>

                    {previewData.length > 0 && (
                      <div className="bg-white rounded-2xl border border-black/5 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-black/5 bg-gray-50">
                              <th className="p-4 text-[10px] font-black text-black/40 uppercase tracking-widest">#</th>
                              {Object.keys(previewData[0]).map((key) => (
                                <th key={key} className="p-4 text-[10px] font-black text-black/40 uppercase tracking-widest whitespace-nowrap">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/5">
                            {previewData.map((row, i) => (
                              <tr key={i} className="hover:bg-[#ece7e2]/30">
                                <td className="p-4 text-xs text-black/30 font-bold">{i + 1}</td>
                                {Object.values(row).map((val, j) => (
                                  <td key={j} className="p-4 font-bold text-black max-w-[200px] truncate">
                                    {val || <span className="text-black/20">—</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="bg-black/5 rounded-2xl p-4 flex items-center gap-3">
                      <FileSpreadsheet size={20} className="text-black/40" />
                      <p className="text-sm font-bold text-black/60">
                        Se importarán <span className="font-black text-black">{introspect?.totalRows ?? 0}</span> {entityLabel} en total.
                      </p>
                    </div>
                  </>
                )}

                {/* ── STEP 4: Importing ──────────────────────────────── */}
                {step === 'importing' && (
                  <div className="flex flex-col items-center justify-center gap-6 py-12">
                    <Loader2 size={48} className="animate-spin text-black/40" />
                    <div className="text-center">
                      <p className="text-sm font-black uppercase tracking-widest text-black/70">
                        Importando {entityLabel}…
                      </p>
                      <p className="text-3xl font-black text-black mt-2">
                        {progress} <span className="text-lg text-black/40">/ {introspect?.totalRows ?? '?'}</span>
                      </p>
                    </div>
                    {introspect && introspect.totalRows > 0 && (
                      <div className="w-full max-w-md bg-black/10 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-black h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (progress / introspect.totalRows) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* ── STEP 5: Done ───────────────────────────────────── */}
                {step === 'done' && result && (
                  <div className="flex flex-col items-center gap-6 py-8">
                    {result.errors.length === 0 ? (
                      <CheckCircle2 size={56} className="text-green-500" />
                    ) : result.inserted > 0 ? (
                      <AlertTriangle size={56} className="text-amber-500" />
                    ) : (
                      <AlertTriangle size={56} className="text-red-500" />
                    )}

                    <div className="text-center">
                      <p className="text-2xl font-black text-black uppercase tracking-tighter">
                        {result.inserted === result.total
                          ? '¡Importación completa!'
                          : result.inserted > 0
                            ? 'Importación parcial'
                            : 'Error en la importación'}
                      </p>
                      <p className="text-sm font-bold text-black/50 mt-2">
                        {result.inserted} de {result.total} {entityLabel} importados correctamente.
                      </p>
                    </div>

                    {result.errors.length > 0 && (
                      <div className="w-full bg-red-50 border border-red-200 rounded-2xl p-4 max-h-[200px] overflow-y-auto">
                        <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-2">
                          Errores ({result.errors.length})
                        </p>
                        <div className="space-y-1">
                          {result.errors.slice(0, 20).map((err, i) => (
                            <p key={i} className="text-xs text-red-600">
                              <span className="font-black">Fila {err.row}:</span> {err.message}
                            </p>
                          ))}
                          {result.errors.length > 20 && (
                            <p className="text-xs text-red-400 font-bold">
                              … y {result.errors.length - 20} errores más.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer with navigation buttons */}
              <div className="p-6 bg-white border-t-2 border-black/5 flex items-center justify-between shrink-0">
                {/* Left: Back / Cancel */}
                <div>
                  {step === 'mapping' && (
                    <button
                      type="button"
                      onClick={() => { setStep('upload'); setFile(null); setIntrospect(null); setError(null) }}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black uppercase tracking-widest text-black/60 hover:bg-black/5 transition-all"
                    >
                      <ArrowLeft size={16} /> Cambiar archivo
                    </button>
                  )}
                  {step === 'preview' && (
                    <button
                      type="button"
                      onClick={() => { setStep('mapping'); setError(null) }}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black uppercase tracking-widest text-black/60 hover:bg-black/5 transition-all"
                    >
                      <ArrowLeft size={16} /> Editar mapeo
                    </button>
                  )}
                </div>

                {/* Right: Next / Import / Close */}
                <div>
                  {step === 'mapping' && (
                    <button
                      type="button"
                      onClick={handleConfirmMapping}
                      className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black/90 transition-all shadow-xl active:scale-95"
                    >
                      Vista previa <ArrowRight size={16} />
                    </button>
                  )}
                  {step === 'preview' && (
                    <button
                      type="button"
                      onClick={handleStartImport}
                      className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black/90 transition-all shadow-xl active:scale-95"
                    >
                      Importar {introspect?.totalRows ?? 0} {entityLabel}
                    </button>
                  )}
                  {step === 'done' && (
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black/90 transition-all shadow-xl active:scale-95"
                    >
                      Cerrar
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getStepIndex(step: ImportStep): number {
  const order: ImportStep[] = ['upload', 'mapping', 'preview', 'importing', 'done']
  return order.indexOf(step)
}

/**
 * Re-parse the file to retrieve ALL rows (not just the 50-row sample).
 * Used at import time for files with > 50 data rows.
 */
async function getAllRows(file: File): Promise<string[][]> {
  return fullParseRows(file)
}

async function fullParseRows(file: File): Promise<string[][]> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1, defval: '', blankrows: false,
    })
    return raw.slice(1).map((row) =>
      row.map((cell) => {
        if (cell === null || cell === undefined) return ''
        if (cell instanceof Date) return isNaN(cell.getTime()) ? '' : cell.toISOString().split('T')[0]
        return String(cell).trim()
      })
    )
  }

  if (ext === 'json') {
    const text = await file.text()
    let parsed = JSON.parse(text)
    let records: Record<string, unknown>[]

    if (Array.isArray(parsed)) {
      records = parsed.filter((r: unknown) => r && typeof r === 'object' && !Array.isArray(r))
    } else if (parsed && typeof parsed === 'object') {
      const arrValue = Object.values(parsed).find(Array.isArray)
      records = arrValue
        ? (arrValue as unknown[]).filter((r) => r && typeof r === 'object' && !Array.isArray(r)) as Record<string, unknown>[]
        : [parsed]
    } else {
      return []
    }

    const keySet = new Set<string>()
    for (const rec of records) for (const k of Object.keys(rec)) keySet.add(k)
    const headers = Array.from(keySet)

    return records.map((rec) =>
      headers.map((h) => {
        const v = rec[h]
        if (v === null || v === undefined) return ''
        if (typeof v === 'object') return JSON.stringify(v)
        return String(v).trim()
      })
    )
  }

  // CSV: read all text
  const text = await file.text()
  const delimiter = text.split('\n')[0]?.includes(';') ? ';' : text.split('\n')[0]?.includes('\t') ? '\t' : ','
  const lines = text.split('\n')
  const rows: string[][] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    rows.push(line.split(delimiter).map((c) => c.replace(/^"|"$/g, '').trim()))
  }

  return rows
}
