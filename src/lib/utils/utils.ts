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

/**
 * Calcula la edad en años a partir de una fecha de nacimiento.
 * @param birthDate - Fecha de nacimiento (Date, string ISO o timestamp)
 * @returns Edad en años, o null si la fecha no es válida
 */
export function calculateAge(birthDate: Date | string | number): number | null {
  const date =
    typeof birthDate === 'object' && birthDate instanceof Date
      ? birthDate
      : new Date(birthDate)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - date.getFullYear()
  const monthDiff = today.getMonth() - date.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--
  }
  return age < 0 ? 0 : age
}
