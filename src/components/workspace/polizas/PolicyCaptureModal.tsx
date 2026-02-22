"use client"

import React, { useState, Fragment, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Loader2, CheckCircle2, DollarSign, Repeat, AlertCircle, User, FileText,
} from 'lucide-react'
import { getFullName } from '@/src/lib/utils/utils'
import { toast } from 'sonner'
import { type Customer, type PolicyFormData } from '@/src/types/policy'
import { SelectWithOther } from '@/src/components/ui/SelectWithOther'
import { InsuranceType } from '@/src/config/constants'
const INSURANCE_TYPES = Object.values(InsuranceType)

type PolicyCaptureModalProps = {
  isOpen: boolean
  onClose: () => void
  customers: Customer[]
  selectedPolicy?: PolicyFormData | null
  /** Si viene desde Clientes/Prospectos, el titular ya está elegido y se muestra en solo lectura */
  preselectedCustomer?: Customer | null
  onSubmit: (formData: FormData) => Promise<void>
  onSuccess: () => void
}

export function PolicyCaptureModal({
  isOpen,
  onClose,
  customers,
  selectedPolicy = null,
  preselectedCustomer = null,
  onSubmit,
  onSuccess,
}: PolicyCaptureModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showPostCreateChoice, setShowPostCreateChoice] = useState(false)

  useEffect(() => {
    if (!isOpen) setShowPostCreateChoice(false)
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      await onSubmit(formData)
      setSuccess(true)
      if (selectedPolicy) {
        onSuccess()
        setTimeout(() => { setSuccess(false); onClose() }, 1000)
      } else {
        setShowPostCreateChoice(true)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const handleVerPolizas = () => {
    setSuccess(false)
    setShowPostCreateChoice(false)
    onSuccess()
  }

  const handleVolverAClientes = () => {
    setSuccess(false)
    setShowPostCreateChoice(false)
    onSuccess()
    router.push('/clientes')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <Fragment key="policy-capture-modal">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
      />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-modal-title"
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ type: 'spring', damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl bg-[#ece7e2] shadow-2xl rounded-[2.5rem] overflow-hidden border border-white/20"
        >
          <div className="p-8 bg-white flex justify-between items-center border-b-2 border-black/5 shadow-sm">
            <div>
              <h3 id="policy-modal-title" className="text-3xl font-black italic text-black uppercase tracking-tighter">
                {selectedPolicy ? 'Expediente Póliza' : 'Emisión Técnica'}
              </h3>
              <p className="text-[11px] font-bold text-black/50 uppercase tracking-widest mt-1">
                Asygurare
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-3 hover:bg-gray-100 rounded-full text-black transition-all"
              aria-label="Cerrar"
            >
              <X size={32} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto p-8 space-y-8">
            {/* 01. Responsable del Riesgo */}
            <div className="space-y-4">
              <label className="text-[11px] font-black text-black uppercase tracking-widest italic">
                01. Responsable del Riesgo
              </label>
              <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                {preselectedCustomer ? (
                  <>
                    <input type="hidden" name="customerId" value={preselectedCustomer.id} />
                    <div className="flex items-center gap-3 text-black">
                      <div className="w-12 h-12 rounded-full bg-[#ece7e2] flex items-center justify-center">
                        <User size={24} className="text-black/60" />
                      </div>
                      <div>
                        <p className="font-black text-lg uppercase tracking-tight">{getFullName(preselectedCustomer)}</p>
                        {preselectedCustomer.email && (
                          <p className="text-[10px] font-bold text-black/50 uppercase">{preselectedCustomer.email}</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <select
                    required
                    name="customerId"
                    defaultValue={selectedPolicy?.customer_id ?? ''}
                    className="w-full bg-[#ece7e2] text-black font-black py-5 px-6 rounded-2xl outline-none appearance-none cursor-pointer text-lg border-2 border-transparent focus:border-black/20"
                  >
                    <option value="">Seleccionar Titular...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{getFullName(c)}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* 02. Especificaciones */}
            <div className="space-y-4">
              <label className="text-[11px] font-black text-black uppercase tracking-widest italic">
                02. Especificaciones
              </label>
              <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-black/30 uppercase ml-2">Referencia de Póliza</label>
                  <input
                    required
                    name="policyNumber"
                    defaultValue={selectedPolicy?.policy_number ?? ''}
                    placeholder="POL-X"
                    className="w-full bg-[#ece7e2] text-black font-black py-5 px-6 rounded-2xl outline-none text-xl uppercase border-2 border-transparent focus:border-black/20"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-black/30 uppercase ml-2">Aseguradora</label>
                    <input
                      required
                      name="company"
                      defaultValue={selectedPolicy?.insurance_company ?? ''}
                      placeholder="GNP / AXA"
                      className="w-full bg-[#ece7e2] text-black font-black py-4 px-6 rounded-2xl outline-none text-sm uppercase border-2 border-transparent focus:border-black/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-black/30 uppercase ml-2">Ramo</label>
                    <SelectWithOther
                      name="category"
                      options={INSURANCE_TYPES}
                      defaultValue={selectedPolicy?.category ?? 'Autos'}
                      placeholder="Ej. Retiro, Agrícola..."
                      className="w-full bg-[#ece7e2] text-black font-black py-4 px-6 rounded-2xl outline-none text-sm cursor-pointer uppercase border-2 border-transparent focus:border-black/20"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Vigencia */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-black/5">
                <label className="text-[10px] font-black text-black/40 uppercase block mb-3 tracking-widest italic">
                  Inicio Cobertura
                </label>
                <input
                  required
                  name="effectiveDate"
                  type="date"
                  defaultValue={selectedPolicy?.effective_date ?? ''}
                  className="w-full bg-transparent text-black font-black text-xl outline-none"
                />
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-lg shadow-orange-100">
                <label className="text-[10px] font-black text-orange-500 uppercase block mb-3 tracking-widest italic">
                  Fin Vigencia
                </label>
                <input
                  required
                  name="expiryDate"
                  type="date"
                  defaultValue={selectedPolicy?.expiry_date ?? ''}
                  className="w-full bg-transparent text-black font-black text-xl outline-none"
                />
              </div>
            </div>

            {/* 03. Estructura Financiera */}
            <div className="space-y-4">
              <label className="text-[11px] font-black text-black uppercase tracking-widest italic">
                03. Estructura Financiera
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                  <DollarSign
                    className="absolute -right-4 -top-4 text-(--accents)/20 group-hover:scale-110 transition-transform"
                    size={100}
                  />
                  <label className="text-[10px] font-black text-(--accents) uppercase block mb-2 tracking-widest italic relative z-10">
                    Prima Total
                  </label>
                  <input
                    required
                    name="premium"
                    type="number"
                    step="0.01"
                    defaultValue={selectedPolicy?.total_premium ?? ''}
                    placeholder="0.00"
                    className="w-full bg-transparent text-white text-4xl font-black outline-none relative z-10 placeholder:text-white/40"
                  />
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-black flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2 text-black/30">
                    <Repeat size={14} />
                    <label className="text-[10px] font-black uppercase tracking-widest italic">
                      Esquema de Cobro
                    </label>
                  </div>
                  <select
                    required
                    name="frecuencia_pago"
                    defaultValue={selectedPolicy?.frecuencia_pago ?? 'Mensual'}
                    className="w-full bg-transparent text-black font-black text-xl outline-none cursor-pointer appearance-none uppercase"
                  >
                    <option value="Mensual">Mensual (12)</option>
                    <option value="Trimestral">Trimestral (4)</option>
                    <option value="Semestral">Semestral (2)</option>
                    <option value="Contado">Contado (1)</option>
                  </select>
                </div>
              </div>
              {!selectedPolicy && (
                <div className="bg-blue-50 p-6 rounded-2xl flex items-start gap-4 border border-blue-100">
                  <AlertCircle className="text-blue-500 shrink-0" size={20} />
                  <p className="text-[10px] font-bold text-blue-900 leading-relaxed uppercase tracking-tight">
                    Al emitir este contrato, el sistema generará automáticamente los recibos de cobro basados en la
                    frecuencia seleccionada.
                  </p>
                </div>
              )}
            </div>

            {showPostCreateChoice ? (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-center gap-4">
                <CheckCircle2 className="text-green-600 shrink-0" size={40} />
                <div>
                  <p className="font-black text-black uppercase tracking-tight">Póliza emitida</p>
                  <p className="text-sm text-black/60">¿Qué deseas hacer ahora?</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleVerPolizas}
                  className="flex-1 flex items-center justify-center gap-2 py-5 rounded-[2.5rem] font-black text-lg bg-black text-white hover:bg-black/90 transition-all"
                >
                  <FileText size={22} /> Ver pólizas
                </button>
                <button
                  type="button"
                  onClick={handleVolverAClientes}
                  className="flex-1 py-5 rounded-[2.5rem] font-black text-lg border-2 border-black/20 text-black hover:bg-black/5 transition-all"
                >
                  Volver a clientes
                </button>
              </div>
            </div>
          ) : (
            <button
              type="submit"
              disabled={loading || success}
              className={`w-full py-7 rounded-[2.5rem] font-black text-2xl transition-all flex items-center justify-center gap-4 shadow-2xl active:scale-95 ${
                success ? 'bg-green-600 text-white' : 'bg-black text-white hover:bg-(--accents)'
              }`}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={32} />
              ) : success ? (
                <>
                  <CheckCircle2 size={32} /> OPERACIÓN EXITOSA
                </>
              ) : selectedPolicy ? (
                'ACTUALIZAR CONTRATO'
              ) : (
                'EMITIR PÓLIZA'
              )}
            </button>
          )}
          </form>
        </motion.div>
      </div>
        </Fragment>
      )}
    </AnimatePresence>
  )
}
