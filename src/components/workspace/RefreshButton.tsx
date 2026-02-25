"use client"

import React from 'react'
import { RefreshCw } from 'lucide-react'

export type RefreshButtonProps = {
  onRefresh: () => void
  /** true mientras se está actualizando (muestra ícono girando) */
  refreshing?: boolean
  label?: string
  className?: string
  ariaLabel?: string
}

/**
 * Botón reutilizable para actualizar/refrescar datos en listas (Prospectos, Clientes, Pólizas).
 */
export function RefreshButton({
  onRefresh,
  refreshing = false,
  label = 'Actualizar',
  className = '',
  ariaLabel = 'Actualizar datos',
}: RefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing}
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest border-2 border-black/10 text-black/70 hover:border-black/20 hover:text-black transition-all disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      <RefreshCw
        size={18}
        className={refreshing ? 'animate-spin' : ''}
        aria-hidden
      />
      {label}
    </button>
  )
}
