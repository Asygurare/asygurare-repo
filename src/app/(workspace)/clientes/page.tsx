"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { DATABASE } from '@/src/config'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Search, X, UserPlus, Mail, Phone, Loader2, CheckCircle2,
  Building2, User, Trash2, Save, Calendar, MoreVertical, FileText, StickyNote
} from 'lucide-react'
import { supabaseClient } from '@/src/lib/supabase/client'
import { toast, Toaster } from 'sonner'
import { getFullName } from '@/src/lib/utils/utils'
import { SelectWithOther } from '@/src/components/ui/SelectWithOther'
import { InsuranceType } from '@/src/config/constants'

const INSURANCE_TYPES = Object.values(InsuranceType)
const STATUSES = ['nuevo', 'en seguimiento', 'activo', 'otro']
const SOURCES = ['Referido', 'Redes Sociales', 'Llamada en Frío', 'Campaña Web', 'Cartera Antigua', 'Otro']
const MARITAL_STATUSES = ['Soltero/a', 'Casado/a', 'Unión libre', 'Divorciado/a', 'Viudo/a', 'Otro']
const GENDERS = ['Masculino', 'Femenino', 'Otro']

function parseTriBool(v: FormDataEntryValue | null): boolean | null {
  const s = String(v || '').trim()
  if (!s) return null
  if (s === 'yes') return true
  if (s === 'no') return false
  return null
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

export default function ClientesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [detailCustomer, setDetailCustomer] = useState<any>(null)
  const [notesCustomer, setNotesCustomer] = useState<any>(null)
  const [optionsRowId, setOptionsRowId] = useState<string | null>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [success, setSuccess] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // 1. CARGA DE DATOS
  const fetchCustomers = useCallback(async () => {
    setFetching(true)
    try {
      const { data, error } = await supabaseClient
        .from(DATABASE.TABLES.WS_CUSTOMERS_2)
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCustomers(data || [])
    } catch (error: any) {
      toast.error('Error al cargar clientes: ' + error.message)
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    if (!optionsRowId) return
    const handleClick = (e: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) setOptionsRowId(null)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [optionsRowId])

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return customers.filter(
      (c) =>
        getFullName(c).toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term)
    )
  }, [customers, searchTerm])

  // 3. GUARDAR O ACTUALIZAR
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)

    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) throw new Error('Sesión expirada')

      const name = String(formData.get('name') || '').trim()
      if (!name) {
        toast.error('El nombre es obligatorio.')
        setLoading(false)
        return
      }

      const birthdayStr = String(formData.get('birthday') || '').trim()
      const birthday = birthdayStr || null
      const ageRaw = String(formData.get('age') || '').trim()
      const age = ageRaw ? (Number.isFinite(parseInt(ageRaw, 10)) ? parseInt(ageRaw, 10) : null) : null
      const valueStr = String(formData.get('estimated_value') || '').trim()
      const estimatedValue = valueStr ? (Number.isFinite(parseFloat(valueStr)) ? parseFloat(valueStr) : null) : null

      const payload = {
        user_id: user.id,
        name,
        last_name: String(formData.get('last_name') || '').trim() || null,
        status: String(formData.get('status') || '').trim() || 'nuevo',
        source: String(formData.get('source') || '').trim() || null,
        insurance_type: String(formData.get('insurance_type') || '').trim() || null,
        estimated_value: estimatedValue,
        email: String(formData.get('email') || '').trim() || null,
        phone: String(formData.get('phone') || '').trim() || null,
        birthday,
        age,
        smoking: parseTriBool(formData.get('smoking')),
        drinking: parseTriBool(formData.get('drinking')),
        marital_status: String(formData.get('marital_status') || '').trim() || null,
        ocupation: String(formData.get('ocupation') || '').trim() || null,
        gender: String(formData.get('gender') || '').trim() || null,
        client_interests: String(formData.get('client_interests') || '').trim() || null,
        notes: String(formData.get('notes') || '').trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (selectedCustomer) {
        const { error } = await supabaseClient
          .from(DATABASE.TABLES.WS_CUSTOMERS_2)
          .update(payload)
          .eq('id', selectedCustomer.id)
        if (error) throw error
        toast.success('Expediente actualizado')
      } else {
        const { error } = await supabaseClient
          .from(DATABASE.TABLES.WS_CUSTOMERS_2)
          .insert([payload])
        if (error) throw error
        toast.success('Cliente registrado')
      }

      setSuccess(true)
      await fetchCustomers()
      setTimeout(() => {
        setSuccess(false)
        setIsModalOpen(false)
        setSelectedCustomer(null)
      }, 1000)
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteCustomer = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('¿Seguro que deseas eliminar este cliente de la cartera permanente?')) return
    const { error } = await supabaseClient.from(DATABASE.TABLES.WS_CUSTOMERS_2).delete().eq('id', id)
    if (!error) {
      setCustomers((prev) => prev.filter((c) => c.id !== id))
      setDetailCustomer((prev: any) => (prev?.id === id ? null : prev))
      setNotesCustomer((prev: any) => (prev?.id === id ? null : prev))
      setOptionsRowId(null)
      toast.success('Registro eliminado')
    } else {
      toast.error(error.message)
    }
  }

  const openEdit = (customer: any) => {
    setSelectedCustomer(customer)
    setIsModalOpen(true)
    setOptionsRowId(null)
  }

  return (
    <div className="space-y-8 p-4">
      <Toaster richColors position="top-center" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-4xl font-black text-black tracking-tighter italic uppercase">Cartera.</h2>
          <p className="text-black font-bold text-[10px] uppercase tracking-[0.3em] mt-1 opacity-50">Base de Datos Maestra</p>
        </div>
        <button
          onClick={() => {
            setSelectedCustomer(null)
            setIsModalOpen(true)
          }}
          className="bg-black text-white px-10 py-5 rounded-[2rem] font-black text-sm flex items-center gap-3 hover:bg-black/80 transition-all shadow-2xl active:scale-95"
        >
          <UserPlus size={20} /> NUEVO REGISTRO
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cuentas Activas</p>
          <h4 className="text-4xl font-black text-black mt-2">{customers.length}</h4>
        </div>
        {/* <div className="bg-black p-8 rounded-[2.5rem] shadow-sm text-white">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Retención</p>
          <h4 className="text-4xl font-black mt-2">99.2%</h4>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm text-black">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Crecimiento</p>
          <h4 className="text-4xl font-black mt-2">+15%</h4>
        </div> */}
      </div>

      <div className="bg-white p-4 rounded-[2rem] border border-black/5 flex gap-4 items-center shadow-sm">
        <div className="flex-1 relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-black/40 group-focus-within:text-black" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono..."
            className="w-full bg-[#ece7e2]/50 text-black font-black py-4 pl-14 pr-6 rounded-2xl outline-none focus:bg-white border-2 border-transparent focus:border-black/10 transition-all placeholder:text-gray-400"
          />
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-black/5 shadow-sm overflow-hidden min-h-[400px]">
        {fetching ? (
          <div className="flex flex-col items-center justify-center h-[400px] gap-4">
            <Loader2 className="animate-spin text-black" size={40} />
          </div>
        ) : filteredCustomers.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-black/5">
                <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-widest">Nombre completo</th>
                <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-widest">Contacto</th>
                <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-widest">Fecha de nacimiento</th>
                <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-widest">Ocupación</th>
                <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-widest">Tipo de seguro</th>
                <th className="p-8 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCustomers.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => openEdit(c)}
                  className="hover:bg-[#ece7e2]/30 transition-all group cursor-pointer"
                >
                  <td className="p-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg">
                        {c.gender === 'Moral' ? <Building2 size={20} /> : <User size={20} />}
                      </div>
                      <p className="font-black text-black text-base uppercase tracking-tighter">{getFullName(c)}</p>
                    </div>
                  </td>
                  <td className="p-8">
                    <div className="space-y-1">
                      <p className="text-sm font-black text-black flex items-center gap-2 text-xs uppercase">
                        <Mail size={12} className="opacity-30" /> {c.email || '—'}
                      </p>
                      <p className="text-sm font-black text-black flex items-center gap-2 text-xs uppercase">
                        <Phone size={12} className="opacity-30" /> {c.phone || '—'}
                      </p>
                    </div>
                  </td>
                  <td className="p-8 text-sm font-black text-black uppercase">{formatDate(c.birthday)}</td>
                  <td className="p-8 text-sm font-black text-black uppercase">{c.ocupation || '—'}</td>
                  <td className="p-8 text-sm font-black text-black uppercase">{c.insurance_type || '—'}</td>
                  <td className="p-8 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-block">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOptionsRowId((id) => (id === c.id ? null : c.id))
                        }}
                        className="p-2 rounded-xl hover:bg-black/5 transition-all opacity-0 group-hover:opacity-100"
                        aria-label="Opciones"
                      >
                        <MoreVertical size={20} className="text-black/50" />
                      </button>
                      {optionsRowId === c.id && (
                        <div
                          ref={optionsRef}
                          className="absolute right-0 top-full mt-1 py-2 min-w-[200px] bg-white border border-black/10 rounded-2xl shadow-xl z-10"
                        >
                          <button
                            onClick={() => {
                              setDetailCustomer(c)
                              setOptionsRowId(null)
                            }}
                            className="w-full px-4 py-3 text-left text-sm font-black uppercase tracking-tighter flex items-center gap-2 hover:bg-[#ece7e2]/50 transition-colors"
                          >
                            <FileText size={18} /> Ver toda la información
                          </button>
                          <button
                            onClick={() => {
                              setNotesCustomer(c)
                              setOptionsRowId(null)
                            }}
                            className="w-full px-4 py-3 text-left text-sm font-black uppercase tracking-tighter flex items-center gap-2 hover:bg-[#ece7e2]/50 transition-colors"
                          >
                            <StickyNote size={18} /> Notas
                          </button>
                          <button
                            onClick={(e) => {
                              deleteCustomer(c.id, e)
                              setOptionsRowId(null)
                            }}
                            className="w-full px-4 py-3 text-left text-sm font-black uppercase tracking-tighter flex items-center gap-2 hover:bg-red-50 text-red-600 transition-colors"
                          >
                            <Trash2 size={18} /> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center h-[400px]">
            <Users size={60} className="text-gray-100 mb-4" />
            <p className="text-black font-black uppercase tracking-widest text-xs italic">No se encontraron clientes</p>
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
            />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <motion.div
                role="dialog"
                aria-modal="true"
                initial={{ opacity: 0, scale: 0.97, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 10 }}
                transition={{ type: 'spring', damping: 25 }}
                className="w-full max-w-4xl bg-[#ece7e2] shadow-2xl rounded-[2.5rem] overflow-hidden border border-white/20"
              >
                <div className="p-8 bg-white flex justify-between items-center border-b-2 border-black/5 shadow-sm">
                  <div>
                    <h3 className="text-3xl font-black italic text-black uppercase tracking-tighter">
                      {selectedCustomer ? 'Expediente Cliente' : 'Alta de Cuenta'}
                    </h3>
                    <p className="text-[11px] font-bold text-black/50 uppercase tracking-widest mt-1">Asygurare</p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-full text-black transition-all">
                    <X size={32} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">Nombre</label>
                      <input
                        name="name"
                        required
                        defaultValue={selectedCustomer?.name ?? selectedCustomer?.full_name ?? ''}
                        placeholder="Ej. Alejandro"
                        className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none border-2 border-transparent focus:border-black/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">Apellido</label>
                      <input
                        name="last_name"
                        defaultValue={selectedCustomer?.last_name ?? ''}
                        placeholder="Ej. Smith"
                        className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none border-2 border-transparent focus:border-black/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">Email</label>
                      <input
                        name="email"
                        type="email"
                        defaultValue={selectedCustomer?.email ?? ''}
                        placeholder="correo@ejemplo.com"
                        className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">Teléfono</label>
                      <input
                        name="phone"
                        defaultValue={selectedCustomer?.phone ?? ''}
                        placeholder="+52..."
                        className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">Fecha de nacimiento</label>
                      <input
                        name="birthday"
                        type="date"
                        defaultValue={selectedCustomer?.birthday ?? ''}
                        className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">Edad</label>
                      <input
                        name="age"
                        type="number"
                        min={0}
                        max={120}
                        defaultValue={selectedCustomer?.age ?? ''}
                        placeholder="Ej. 32"
                        className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">Género</label>
                      <SelectWithOther
                        name="gender"
                        options={GENDERS}
                        defaultValue={selectedCustomer?.gender ?? ''}
                        emptyOption="Sin especificar"
                        className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">Estado civil</label>
                      <SelectWithOther
                        name="marital_status"
                        options={MARITAL_STATUSES}
                        defaultValue={selectedCustomer?.marital_status ?? ''}
                        emptyOption="Sin especificar"
                        className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">Tipo de seguro</label>
                      <SelectWithOther
                        name="insurance_type"
                        options={INSURANCE_TYPES}
                        defaultValue={selectedCustomer?.insurance_type ?? ''}
                        emptyOption="Selecciona..."
                        className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">Estatus</label>
                      <SelectWithOther
                        name="status"
                        options={STATUSES}
                        defaultValue={selectedCustomer?.status ?? 'nuevo'}
                        otherOptionValue="otro"
                        className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">Origen</label>
                      <SelectWithOther
                        name="source"
                        options={SOURCES}
                        defaultValue={selectedCustomer?.source ?? ''}
                        emptyOption="Selecciona..."
                        className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">Ocupación</label>
                      <input
                        name="ocupation"
                        defaultValue={selectedCustomer?.ocupation ?? ''}
                        placeholder="Ej. Contador/a"
                        className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">Prima estimada</label>
                      <input
                        name="estimated_value"
                        type="number"
                        step="0.01"
                        defaultValue={selectedCustomer?.estimated_value ?? ''}
                        placeholder="Ej. 12000"
                        className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">Fuma / Toma</label>
                      <div className="flex gap-4">
                        <select
                          name="smoking"
                          defaultValue={selectedCustomer?.smoking === true ? 'yes' : selectedCustomer?.smoking === false ? 'no' : ''}
                          className="flex-1 bg-white p-4 rounded-2xl font-black text-black text-sm outline-none cursor-pointer"
                        >
                          <option value="">Fuma —</option>
                          <option value="no">No</option>
                          <option value="yes">Sí</option>
                        </select>
                        <select
                          name="drinking"
                          defaultValue={selectedCustomer?.drinking === true ? 'yes' : selectedCustomer?.drinking === false ? 'no' : ''}
                          className="flex-1 bg-white p-4 rounded-2xl font-black text-black text-sm outline-none cursor-pointer"
                        >
                          <option value="">Toma —</option>
                          <option value="no">No</option>
                          <option value="yes">Sí</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12px] font-black uppercase text-black italic">Intereses del cliente</label>
                    <textarea
                      name="client_interests"
                      defaultValue={selectedCustomer?.client_interests ?? ''}
                      rows={2}
                      placeholder="Hobbies, preferencias..."
                      className="w-full bg-white p-5 rounded-2xl font-black text-black text-base outline-none resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12px] font-black uppercase text-black italic">Notas / Bitácora</label>
                    <textarea
                      name="notes"
                      defaultValue={selectedCustomer?.notes ?? ''}
                      rows={4}
                      placeholder="Acuerdos, próximos pasos..."
                      className="w-full bg-white p-5 rounded-2xl font-black text-black text-base outline-none resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || success}
                    className={`w-full py-6 rounded-3xl font-black text-xl transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95 ${
                      success ? 'bg-green-600 text-white' : 'bg-black text-white hover:bg-black/90'
                    }`}
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={28} />
                    ) : success ? (
                      <>
                        <CheckCircle2 size={28} /> EXPEDIENTE GUARDADO
                      </>
                    ) : selectedCustomer ? (
                      <>
                        <Save size={24} /> ACTUALIZAR REGISTRO
                      </>
                    ) : (
                      'CREAR NUEVO CLIENTE'
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Modal Ver toda la información */}
      <AnimatePresence>
        {detailCustomer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailCustomer(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[80]"
            />
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-black/10"
              >
                <div className="p-8 border-b border-black/5 flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black text-black uppercase tracking-tighter">{getFullName(detailCustomer)}</h3>
                    <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mt-1">Expediente completo</p>
                  </div>
                  <button onClick={() => setDetailCustomer(null)} className="p-2 hover:bg-gray-100 rounded-full">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto text-sm">
                  <Row label="Email" value={detailCustomer.email} />
                  <Row label="Teléfono" value={detailCustomer.phone} />
                  <Row label="Fecha de nacimiento" value={formatDate(detailCustomer.birthday)} />
                  <Row label="Edad" value={detailCustomer.age != null ? String(detailCustomer.age) : null} />
                  <Row label="Género" value={detailCustomer.gender} />
                  <Row label="Estado civil" value={detailCustomer.marital_status} />
                  <Row label="Tipo de seguro" value={detailCustomer.insurance_type} />
                  <Row label="Estatus" value={detailCustomer.status} />
                  <Row label="Origen" value={detailCustomer.source} />
                  <Row label="Ocupación" value={detailCustomer.ocupation} />
                  <Row label="Prima estimada" value={detailCustomer.estimated_value != null ? `$${Number(detailCustomer.estimated_value).toLocaleString()}` : null} />
                  <Row label="Fuma" value={detailCustomer.smoking === true ? 'Sí' : detailCustomer.smoking === false ? 'No' : null} />
                  <Row label="Toma" value={detailCustomer.drinking === true ? 'Sí' : detailCustomer.drinking === false ? 'No' : null} />
                  {detailCustomer.client_interests && (
                    <div>
                      <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-1">Intereses</p>
                      <p className="font-bold text-black">{detailCustomer.client_interests}</p>
                    </div>
                  )}
                  {detailCustomer.notes && (
                    <div>
                      <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-1">Notas</p>
                      <p className="font-bold text-black whitespace-pre-wrap">{detailCustomer.notes}</p>
                    </div>
                  )}
                </div>
                <div className="p-8 border-t border-black/5">
                  <button
                    onClick={() => {
                      setSelectedCustomer(detailCustomer)
                      setDetailCustomer(null)
                      setIsModalOpen(true)
                    }}
                    className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-tighter hover:bg-black/90"
                  >
                    Editar expediente
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Modal Notas */}
      <AnimatePresence>
        {notesCustomer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotesCustomer(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[80]"
            />
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-black/10"
              >
                <div className="p-8 border-b border-black/5 flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-black text-black uppercase tracking-tighter">{getFullName(notesCustomer)}</h3>
                    <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mt-1">Notas</p>
                  </div>
                  <button onClick={() => setNotesCustomer(null)} className="p-2 hover:bg-gray-100 rounded-full">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-8">
                  <p className="text-black font-bold whitespace-pre-wrap min-h-[120px]">
                    {notesCustomer.notes || 'Sin notas.'}
                  </p>
                </div>
                <div className="p-8 border-t border-black/5">
                  <button
                    onClick={() => {
                      setSelectedCustomer(notesCustomer)
                      setNotesCustomer(null)
                      setIsModalOpen(true)
                    }}
                    className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-tighter hover:bg-black/90"
                  >
                    Editar expediente
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (value == null || value === '') return null
  return (
    <div>
      <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="font-bold text-black">{value}</p>
    </div>
  )
}
