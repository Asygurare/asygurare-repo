"use client"

import React, { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'

const OTHER_VALUE = 'Otro'

type SelectWithOtherProps = {
  options: string[]
  name: string
  defaultValue?: string
  /** Para uso controlado (ej. sync con state del padre) */
  value?: string
  onChange?: (value: string) => void
  /** Valor que dispara el cuadro "Otro" (ej. "Otro" o "otro") */
  otherOptionValue?: string
  /** Texto para la opción vacía (ej. "Sin especificar"). Si no se pasa, no se muestra opción vacía */
  emptyOption?: string
  placeholder?: string
  className?: string
  required?: boolean
  id?: string
}

export function SelectWithOther({
  options,
  name,
  defaultValue = '',
  value: controlledValue,
  onChange,
  otherOptionValue = OTHER_VALUE,
  emptyOption,
  placeholder = 'Escribe el valor...',
  className = '',
  required = false,
  id,
}: SelectWithOtherProps) {
  const isControlled = controlledValue !== undefined
  const firstOption = emptyOption != null ? '' : (options[0] ?? '')
  const initialSelect =
    defaultValue && options.includes(defaultValue)
      ? defaultValue
      : defaultValue && !options.includes(defaultValue)
        ? otherOptionValue
        : firstOption
  const initialCustom = defaultValue && !options.includes(defaultValue) ? defaultValue : ''

  const [selectValue, setSelectValue] = useState(initialSelect)
  const [customOther, setCustomOther] = useState(initialCustom)
  const [showOtherModal, setShowOtherModal] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const effectiveValue = isControlled
    ? controlledValue
    : selectValue === otherOptionValue
      ? customOther
      : selectValue

  const updateEffective = (next: string) => {
    onChange?.(next)
  }

  useEffect(() => {
    if (showOtherModal) inputRef.current?.focus()
  }, [showOtherModal])

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value
    setSelectValue(v)
    if (v === otherOptionValue) {
      if (isControlled && controlledValue && !options.includes(controlledValue))
        setCustomOther(controlledValue)
      setShowOtherModal(true)
    } else {
      updateEffective(v)
    }
  }

  const handleConfirmOther = () => {
    updateEffective(customOther.trim() || otherOptionValue)
    setShowOtherModal(false)
  }

  const handleCloseOther = () => {
    if (!customOther.trim()) {
      setSelectValue(emptyOption != null ? '' : options[0] ?? '')
      const fallback = emptyOption != null ? '' : options[0] ?? ''
      if (isControlled) updateEffective(fallback)
      else updateEffective(fallback)
    }
    setShowOtherModal(false)
  }

  const displaySelectValue = isControlled
    ? (controlledValue === '' || controlledValue == null
        ? (emptyOption != null ? '' : (options[0] ?? ''))
        : options.includes(controlledValue)
          ? controlledValue
          : otherOptionValue)
    : selectValue
  const displayCustomOther = isControlled && !options.includes(controlledValue) ? controlledValue : customOther

  return (
    <div className="w-full">
      {!isControlled && <input type="hidden" name={name} value={effectiveValue} readOnly />}
      <select
        id={id}
        value={displaySelectValue}
        onChange={handleSelectChange}
        className={className}
        required={required && !effectiveValue}
        aria-label={name}
      >
        {emptyOption != null && <option value="">{emptyOption}</option>}
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>

      {showOtherModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[100]"
            onClick={handleCloseOther}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="other-modal-title"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-sm bg-white rounded-2xl shadow-xl border border-black/10 p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h4 id="other-modal-title" className="text-sm font-black uppercase text-black tracking-tighter">
                Especificar otro
              </h4>
              <button
                type="button"
                onClick={handleCloseOther}
                className="p-1.5 hover:bg-gray-100 rounded-full text-black"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={customOther}
              onChange={(e) => setCustomOther(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmOther()}
              placeholder={placeholder}
              className="w-full bg-[#ece7e2] text-black font-bold py-3 px-4 rounded-xl outline-none border-2 border-transparent focus:border-black/20 mb-4"
            />
            <button
              type="button"
              onClick={handleConfirmOther}
              className="w-full py-3 bg-black text-white rounded-xl font-black text-sm uppercase tracking-tighter hover:bg-black/90"
            >
              Listo
            </button>
          </div>
        </>
      )}
    </div>
  )
}
