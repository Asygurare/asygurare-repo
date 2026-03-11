/**
 * Auto-mapping engine.
 *
 * Given the file headers and the target field schema, produces an initial
 * ColumnMapping[] where each source column is matched to the best-fit system
 * field (or left unmapped).
 *
 * Strategy:
 *   1. Exact match   – normalised header === field key or any alias.
 *   2. Contains match – one string contains the other.
 *   3. Token overlap  – Jaccard-like score on word tokens.
 *
 * Once a target field is claimed, no other column can map to it (first match
 * wins by score descending).
 */

import type { ColumnMapping, FieldDescriptor } from '@/src/types/import'

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Build an initial mapping suggestion.  The user can override any entry later
 * via the mapping UI.
 */
export function buildAutoMapping(
  headers: string[],
  fields: FieldDescriptor[]
): ColumnMapping[] {
  // Pre-compute all (column, field, score) candidates
  const candidates: { colIdx: number; fieldKey: string; score: number }[] = []

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const norm = normalise(headers[colIdx])
    if (!norm) continue

    for (const field of fields) {
      const score = scoreMatch(norm, field)
      if (score > 0) {
        candidates.push({ colIdx, fieldKey: field.key, score })
      }
    }
  }

  // Sort by score desc so the best matches are claimed first
  candidates.sort((a, b) => b.score - a.score)

  const claimedFields = new Set<string>()
  const claimedCols   = new Set<number>()
  const result: ColumnMapping[] = headers.map((h, i) => ({
    sourceIndex: i,
    sourceHeader: h,
    targetKey: null,
  }))

  for (const c of candidates) {
    if (claimedFields.has(c.fieldKey) || claimedCols.has(c.colIdx)) continue
    result[c.colIdx].targetKey = c.fieldKey
    claimedFields.add(c.fieldKey)
    claimedCols.add(c.colIdx)
  }

  return result
}

// ─── Scoring helpers ───────────────────────────────────────────────────────────

/** Score how well a normalised header matches a field descriptor. 0 = no match. */
function scoreMatch(normHeader: string, field: FieldDescriptor): number {
  const targets = [field.key, ...field.aliases].map(normalise)

  // Exact match → highest score
  if (targets.includes(normHeader)) return 100

  // Header contained in a target or vice-versa (partial match)
  for (const t of targets) {
    if (normHeader.includes(t) || t.includes(normHeader)) return 70
  }

  // Token overlap (Jaccard-like)
  const headerTokens = tokenise(normHeader)
  let bestTokenScore = 0
  for (const t of targets) {
    const fieldTokens = tokenise(t)
    const intersection = headerTokens.filter((tk) => fieldTokens.includes(tk)).length
    if (intersection === 0) continue
    const union = new Set([...headerTokens, ...fieldTokens]).size
    const jaccard = intersection / union
    if (jaccard > bestTokenScore) bestTokenScore = jaccard
  }

  // Only accept if there's meaningful overlap
  return bestTokenScore >= 0.4 ? Math.round(bestTokenScore * 60) : 0
}

// ─── String normalisers ────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[_\-/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenise(s: string): string[] {
  return normalise(s).split(' ').filter(Boolean)
}
