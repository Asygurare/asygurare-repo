/**
 * Devuelve el nombre completo a partir de name + last_name, con fallback a full_name (legacy).
 */
export function getFullName(person: {
  name?: string | null
  last_name?: string | null
  full_name?: string | null
}): string {
  const legacy = String(person?.full_name ?? '').trim()
  if (legacy) return legacy
  const n = String(person?.name ?? '').trim()
  const l = String(person?.last_name ?? '').trim()
  return `${n} ${l}`.trim() || 'Sin nombre'
}
