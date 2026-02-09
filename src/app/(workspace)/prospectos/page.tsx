"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DATABASE, Gender, InsuranceType, MaritalStatus } from '@/src/config'
import { 
  Zap, Target, X, Mail, Phone, Loader2, CheckCircle2, 
  TrendingUp, DollarSign, UserCheck, Trash2, Edit3, 
  Search, Clock, Info, Share2, MessageSquare, ChevronRight
} from 'lucide-react'
import { supabaseClient } from '@/src/lib/supabase/client'
import { toast, Toaster } from 'sonner'
import { SelectWithOther } from '@/src/components/ui/SelectWithOther'

export default function ProspectosFinalUltraPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [fetching, setFetching] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [monthlyGoal, setMonthlyGoal] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasChildren, setHasChildren] = useState<'yes' | 'no' | ''>('')
  const [children, setChildren] = useState<Array<{ name: string; age: string; contact: string }>>([])
  const [additionalForm, setAdditionalForm] = useState<{
    contact_date: string
    economic_dependents: string
    education_level: string
    sector: string
    monthly_income_estimated: string
    currency: string
    financial_goals: string
  }>({
    contact_date: '',
    economic_dependents: '',
    education_level: '',
    sector: '',
    monthly_income_estimated: '',
    currency: '',
    financial_goals: '',
  })
  const [additionalLoading, setAdditionalLoading] = useState(false)

  const STAGES = ['Primer contacto', 'Cita agendada', 'Propuesta enviada', 'En negociación', 'Otro']
  const SOURCES = ['Referido', 'Redes Sociales', 'Llamada en Frío', 'Campaña Web', 'Cartera Antigua', 'Otro']
  const STATUSES = ['Nuevo', 'En seguimiento', 'Descartado', 'Ganado', 'Otro']
  const MARITAL_STATUSES = Object.values(MaritalStatus)
  const GENDERS = Object.values(Gender)
  const INSURANCE_TYPES = Object.values(InsuranceType)
  const EDUCATION_LEVELS = ['Primaria', 'Secundaria', 'Preparatoria', 'Licenciatura', 'Posgrado', 'Otro']
  const CURRENCIES = ['MXN', 'USD', 'EUR']
  // Los campos adicionales se guardan en `WS_LEADS.additional_fields` (JSONB)

  const leadDisplayName = useCallback((lead: any) => {
    const legacy = String(lead?.full_name || '').trim()
    if (legacy) return legacy
    const name = String(lead?.name || '').trim()
    const last = String(lead?.last_name || '').trim()
    const merged = `${name} ${last}`.trim()
    return merged || 'Sin nombre'
  }, [])

  const computeAgeFromBirthday = useCallback((birthdayISO: string) => {
    // birthdayISO: YYYY-MM-DD
    const b = new Date(`${birthdayISO}T00:00:00`)
    if (Number.isNaN(b.getTime())) return null
    const now = new Date()
    let age = now.getFullYear() - b.getFullYear()
    const m = now.getMonth() - b.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1
    if (age < 0 || age > 120) return null
    return age
  }, [])

  const parseTriBool = useCallback((v: FormDataEntryValue | null): boolean | null => {
    const s = String(v || '').trim()
    if (!s) return null
    if (s === 'yes') return true
    if (s === 'no') return false
    return null
  }, [])

  useEffect(() => {
    if (!isModalOpen) return

    setAdditionalLoading(true)
    try {
      const extra = selectedLead?.additional_fields && typeof selectedLead.additional_fields === 'object'
        ? selectedLead.additional_fields
        : null

      const normalizedHasChildren: 'yes' | 'no' | '' =
        extra?.has_children === 'yes' ? 'yes' : extra?.has_children === 'no' ? 'no' : ''
      setHasChildren(normalizedHasChildren)

      const rawChildren = Array.isArray(extra?.children) ? extra.children : []
      setChildren(
        rawChildren.map((c: any) => ({
          name: String(c?.name || ''),
          age: String(c?.age ?? ''),
          contact: String(c?.contact || ''),
        }))
      )

      setAdditionalForm({
        contact_date: extra?.contact_date != null ? String(extra.contact_date) : '',
        economic_dependents: extra?.economic_dependents != null ? String(extra.economic_dependents) : '',
        education_level: String(extra?.education_level || ''),
        sector: String(extra?.sector || ''),
        monthly_income_estimated: extra?.monthly_income_estimated != null ? String(extra.monthly_income_estimated) : '',
        currency: String(extra?.currency || ''),
        financial_goals: String(extra?.financial_goals || ''),
      })
    } finally {
      setAdditionalLoading(false)
    }
  }, [isModalOpen, selectedLead?.additional_fields])

  useEffect(() => {
    if (hasChildren !== 'yes') {
      setChildren([])
    }
  }, [hasChildren])

  const fetchData = useCallback(async () => {
    setFetching(true)
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) return

    const currentMonth = new Date().toISOString().slice(0, 7)
    const [leadsRes, goalRes] = await Promise.all([
      supabaseClient.from(DATABASE.TABLES.WS_LEADS).select('*').order('updated_at', { ascending: false }),
      supabaseClient.from(DATABASE.TABLES.WS_USER_GOALS).select('amount').eq('month_year', currentMonth).maybeSingle()
    ])

    if (leadsRes.data) setLeads(leadsRes.data)
    if (goalRes.data) setMonthlyGoal(goalRes.data.amount)
    setFetching(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // --- ACCIONES REALES ---

  const updateStage = async (id: string, newStage: string) => {
    const { error } = await supabaseClient.from(DATABASE.TABLES.WS_LEADS).update({ 
      stage: newStage, 
      updated_at: new Date().toISOString() 
    }).eq('id', id)

    if (error) toast.error("Error al mover etapa")
    else {
      toast.info(`Estatus: ${newStage}`)
      setLeads(leads.map(l => l.id === id ? { ...l, stage: newStage } : l))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este prospecto?")) return
    const { error } = await supabaseClient.from(DATABASE.TABLES.WS_LEADS).delete().eq('id', id)
    if (!error) {
      toast.success("Lead eliminado")
      setLeads(leads.filter(l => l.id !== id))
    }
  }

  const handleConvertToCustomer = async (lead: any) => {
    setLoading(true)
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user?.id) {
      toast.error('Sesión no válida')
      setLoading(false)
      return
    }

    const name = String(lead?.name || lead?.full_name || '').trim()
    if (!name) {
      toast.error('El prospecto no tiene nombre.')
      setLoading(false)
      return
    }

    // 1. Insertar en clientes (WS_CUSTOMERS_2, schema alineado con Prospectos)
    const { error: insertError } = await supabaseClient.from(DATABASE.TABLES.WS_CUSTOMERS_2).insert({
      user_id: user.id,
      name,
      last_name: lead?.last_name || null,
      status: lead?.status || 'nuevo',
      source: lead?.source || null,
      insurance_type: lead?.insurance_type || null,
      estimated_value: lead?.estimated_value ?? null,
      email: lead?.email || null,
      phone: lead?.phone || null,
      birthday: lead?.birthday || null,
      age: lead?.age ?? null,
      smoking: lead?.smoking ?? null,
      drinking: lead?.drinking ?? null,
      marital_status: lead?.marital_status || null,
      ocupation: lead?.ocupation || null,
      gender: lead?.gender || null,
      client_interests: lead?.client_interests || null,
      notes: lead?.notes || null,
      additional_fields: lead?.additional_fields ?? null,
    })

    if (insertError) {
      toast.error("Error al convertir: " + insertError.message)
    } else {
      // 2. Eliminar de leads
      await supabaseClient.from(DATABASE.TABLES.WS_LEADS).delete().eq('id', lead.id)
      toast.success("¡FELICIDADES! Venta cerrada y movida a Clientes.")
      setIsModalOpen(false)
      fetchData()
    }
    setLoading(false)
  }

  const handleSaveLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const { data: { user } } = await supabaseClient.auth.getUser()

    const name = String(formData.get('name') || '').trim()
    const lastName = String(formData.get('last_name') || '').trim()
    const status = String(formData.get('status') || '').trim() || 'nuevo'
    const stage = String(formData.get('stage') || '').trim() || 'Primer contacto'
    const source = String(formData.get('source') || '').trim() || null
    const insuranceType = String(formData.get('insurance_type') || '').trim() || null
    const clientInterests = String(formData.get('client_interests') || '').trim() || null
    const email = String(formData.get('email') || '').trim() || null
    const phone = String(formData.get('phone') || '').trim() || null
    const ocupation = String(formData.get('ocupation') || '').trim() || null
    const gender = String(formData.get('gender') || '').trim() || null
    const maritalStatus = String(formData.get('marital_status') || '').trim() || null
    const country = String(formData.get('country') || '').trim() || null
    const city = String(formData.get('city') || '').trim() || null
    const state = String(formData.get('state') || '').trim() || null
    const address = String(formData.get('address') || '').trim() || null
    const postalCode = String(formData.get('postal_code') || '').trim() || null
    const cleanNotes = String(formData.get('notes') || '').trim()

    const birthdayStr = String(formData.get('birthday') || '').trim()
    const birthday = birthdayStr ? birthdayStr : null
    const ageRaw = String(formData.get('age') || '').trim()
    const age = ageRaw
      ? (Number.isFinite(parseInt(ageRaw, 10)) ? parseInt(ageRaw, 10) : null)
      : (birthday ? computeAgeFromBirthday(birthday) : null)

    const valueStr = String(formData.get('estimated_value') || '').trim()
    const estimatedValue = valueStr ? (Number.isFinite(parseFloat(valueStr)) ? parseFloat(valueStr) : null) : null

    const smoking = parseTriBool(formData.get('smoking'))
    const drinking = parseTriBool(formData.get('drinking'))

    // Campos adicionales (no están en WS_LEADS) -> se guardan en `WS_LEADS.additional_fields` (JSONB)
    const toIntOrNull = (s: string) => {
      const t = String(s || '').trim()
      if (!t) return null
      const n = parseInt(t, 10)
      return Number.isFinite(n) ? n : null
    }
    const toFloatOrNull = (s: string) => {
      const t = String(s || '').trim()
      if (!t) return null
      const n = parseFloat(t)
      return Number.isFinite(n) ? n : null
    }

    const additionalPayload = (() => {
      const childrenList = (hasChildren === 'yes' ? children : []).filter((c) => c.name || c.age || c.contact)
      const payloadObj: any = {
        contact_date: additionalForm.contact_date.trim() || null, // YYYY-MM-DD
        has_children: hasChildren || null,
        economic_dependents: toIntOrNull(additionalForm.economic_dependents),
        education_level: additionalForm.education_level.trim() || null,
        sector: additionalForm.sector.trim() || null,
        monthly_income_estimated: toFloatOrNull(additionalForm.monthly_income_estimated),
        currency: additionalForm.currency.trim() || null,
        financial_goals: additionalForm.financial_goals.trim() || null,
        children: childrenList.length ? childrenList : null,
      }

      // Compactar: remover null/empty/[] para guardar limpio
      Object.keys(payloadObj).forEach((k) => {
        const v = payloadObj[k]
        const empty =
          v === null ||
          v === undefined ||
          (typeof v === 'string' && v.trim().length === 0) ||
          (Array.isArray(v) && v.length === 0)
        if (empty) delete payloadObj[k]
      })

      return Object.keys(payloadObj).length ? payloadObj : null
    })()

    if (!user?.id) {
      toast.error("Sesión no válida. Vuelve a iniciar sesión.")
      setLoading(false)
      return
    }
    if (!name) {
      toast.error("Escribe el nombre del prospecto.")
      setLoading(false)
      return
    }

    const payload = {
      user_id: user.id,
      name,
      last_name: lastName || null,
      status,
      stage,
      source,
      insurance_type: insuranceType,
      estimated_value: estimatedValue,
      email,
      phone,
      birthday,
      age,
      smoking,
      drinking,
      gender,
      marital_status: maritalStatus,
      ocupation,
      country,
      city,
      state,
      address,
      postal_code: postalCode,
      client_interests: clientInterests,
      notes: cleanNotes || null,
      additional_fields: additionalPayload,
      updated_at: new Date().toISOString()
    }

    const leadRes = selectedLead
      ? await supabaseClient
        .from(DATABASE.TABLES.WS_LEADS)
        .update(payload)
        .eq('id', selectedLead.id)
        .select('id')
        .maybeSingle()
      : await supabaseClient
        .from(DATABASE.TABLES.WS_LEADS)
        .insert([{ ...payload, status: status || 'nuevo', stage: stage || 'Primer contacto' }])
        .select('id')
        .single()
    
    if (leadRes.error) {
      toast.error("Error al guardar")
      setLoading(false)
      return
    } else {
      toast.success(selectedLead ? "Expediente actualizado" : "Prospecto registrado")
      setIsModalOpen(false)
      fetchData()
    }
    setLoading(false)
  }

  const totalValue = useMemo(() => leads.reduce((acc, l) => acc + (Number(l.estimated_value) || 0), 0), [leads])
  const totalProspectos = useMemo(() => leads.length, [leads])
  const leadsFiltrados = leads.filter(l => leadDisplayName(l).toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="space-y-10 pb-20 p-6 max-w-[1400px] mx-auto bg- min-h-screen">
      <Toaster richColors position="bottom-right" />

      {/* DASHBOARD */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5">
          <h2 className="text-4xl font-black italic text-black uppercase tracking-tighter">Mis prospectos.</h2>
          <p className="text-black font-bold text-[10px] uppercase tracking-widest mt-1">Asygurare Intelligence</p>
        </div>
        <div className="bg-black p-8 rounded-[2.5rem] text-white flex flex-col justify-center">
          <p className="text-[10px] font-black text-(--accents) uppercase mb-1 tracking-widest">Pipeline Activo</p>
          <h3 className="text-4xl font-black">${totalValue.toLocaleString()}</h3>
        </div>
        <div className="bg-black p-8 rounded-[2.5rem] text-white flex flex-col justify-center">
          <p className="text-[10px] font-black text-(--accents) uppercase mb-1 tracking-widest">Total de prospectos</p>
          <h3 className="text-4xl font-black">{totalProspectos.toLocaleString()}</h3>
        </div>
        {/* <div className="bg-(--accents) p-8 rounded-[2.5rem] text-white flex flex-col justify-center">
          <p className="text-[10px] font-black text-white/60 uppercase mb-1 tracking-widest">Avance vs Meta</p>
          <h3 className="text-4xl font-black">{monthlyGoal > 0 ? ((totalValue/monthlyGoal)*100).toFixed(0) : 0}%</h3>
        </div> */}
      </section>

      {/* GUIA DE ETAPAS */}
      <div className="bg-white/70 backdrop-blur-sm p-6 rounded-[2rem] flex flex-wrap gap-8 items-center border border-black/5">
        <div className="flex items-center gap-2 border-r border-black/10 pr-6">
            <Info size={18} className="text-black" />
            <span className="text-[12px] font-black text-black uppercase italic">Significado Bolitas:</span>
        </div>
        {STAGES.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full border-2 ${i === 3 ? 'bg-(--accents) border-[#3a5f52]' : 'bg-white border-black/10'}`} />
                <span className="text-[11px] font-black text-black uppercase tracking-tighter">{i + 1}. {s}</span>
            </div>
        ))}
      </div>

      {/* SEARCH Y NEW */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-black/40 group-focus-within:text-(--accents)" size={22}/>
          <input 
            type="text" placeholder="Nombre del prospecto..." 
            className="w-full bg-white border-2 border-transparent p-6 pl-16 rounded-[2rem] font-black text-black placeholder:text-gray-400 outline-none focus:border-(--accents) shadow-sm transition-all"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button onClick={() => {setSelectedLead(null); setIsModalOpen(true)}} className="bg-black text-white px-10 py-6 rounded-[2rem] font-black flex items-center gap-3 hover:bg-(--accents) transition-all shadow-xl active:scale-95">
          <Zap size={22} className="text-yellow-400" fill="currentColor"/> NUEVA OPORTUNIDAD
        </button>
      </div>

      {/* LISTA */}
      <div className="grid grid-cols-1 gap-5">
        {fetching ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-(--accents)" size={40}/></div> : 
        leadsFiltrados.map((lead) => (
          <div key={lead.id} className="bg-white p-8 rounded-[3rem] border-2 border-transparent hover:border-(--accents)/30 flex flex-wrap items-center gap-8 group transition-all shadow-md">
            <div className="flex-1 min-w-[300px] cursor-pointer" onClick={() => {setSelectedLead(lead); setIsModalOpen(true)}}>
              <h4 className="font-black text-black text-2xl uppercase italic group-hover:text-(--accents) transition-colors tracking-tighter">{leadDisplayName(lead)}</h4>
              <div className="flex flex-wrap gap-4 mt-2">
                <span className="flex items-center gap-1 text-[11px] font-black text-black/40 uppercase italic tracking-wider"><Share2 size={12}/> {lead.source || 'Sin Fuente'}</span>
                <span className="flex items-center gap-1 text-[11px] font-black text-black/40 uppercase italic tracking-wider"><Mail size={12}/> {lead.email || 'Sin Email'}</span>
                <span className="flex items-center gap-1 text-[11px] font-black text-(--accents) uppercase italic tracking-wider"><Phone size={12}/> {lead.phone || 'Sin Tel.'}</span>
              </div>
            </div>

            <div className="bg-[#ece7e2] p-5 rounded-[2rem] border border-black/5 min-w-[260px]">
              <div className="flex gap-4 items-center">
                {STAGES.map((s) => (
                  <button
                    key={s} onClick={() => updateStage(lead.id, s)}
                    className={`w-7 h-7 rounded-full transition-all border-2 ${lead.stage === s ? 'bg-(--accents) border-(--accents) shadow-lg scale-125' : 'bg-white border-black/10'}`}
                  />
                ))}
              </div>
              <p className="text-[11px] font-black text-black uppercase mt-3 tracking-widest">{lead.stage}</p>
            </div>

            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-[10px] font-black text-black/40 uppercase italic">Monto Estimado</p>
                <p className="font-black text-black text-3xl tracking-tighter">${Number(lead.estimated_value).toLocaleString()}</p>
              </div>
              <button onClick={() => handleDelete(lead.id)} className="p-4 text-black/20 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={24}/></button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL (antes panel lateral) */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]" />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <motion.div
                role="dialog"
                aria-modal="true"
                initial={{ opacity: 0, scale: 0.97, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 10 }}
                transition={{ type: 'spring', damping: 25 }}
                className="w-full max-w-7xl bg-[#ece7e2] shadow-2xl rounded-[2.5rem] overflow-hidden border border-white/20"
              >
                <div className="p-8 md:p-10 bg-white flex justify-between items-center border-b-2 border-black/5 shadow-sm">
                  <div>
                    <h3 className="text-3xl font-black italic text-black uppercase tracking-tighter">{selectedLead ? 'Expediente' : 'Nuevo prospecto'}</h3>
                    <p className="text-[11px] font-bold text-black/50 uppercase tracking-widest mt-1">
                      Captura rápida, clara y completa.
                    </p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-full text-black transition-all"><X size={32}/></button>
                </div>

                <form onSubmit={handleSaveLead} className="max-h-[80vh] overflow-y-auto p-8 md:p-10 space-y-8 custom-scrollbar">
                
                {/* BOTÓN CONVERTIR - RESTABLECIDO */}
                {selectedLead && (
                  <motion.button 
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    type="button" 
                    onClick={() => handleConvertToCustomer(selectedLead)}
                    className="w-full p-8 bg-gradient-to-br from-(--accents) to-[#3a5f52] text-white rounded-[2.5rem] font-black flex items-center justify-between group shadow-2xl"
                  >
                    <div className="text-left">
                        <p className="text-xl italic uppercase tracking-tighter">¡Venta Ganada!</p>
                        <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Convertir prospecto en cliente oficial</p>
                    </div>
                    {loading ? <Loader2 className="animate-spin"/> : <UserCheck size={40}/>}
                  </motion.button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Nombre</label>
                        <input
                          name="name"
                          defaultValue={selectedLead?.name || selectedLead?.full_name || ''}
                          required
                          placeholder="Ej. Alejandro"
                          className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none border-2 border-transparent focus:border-(--accents)"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Apellido</label>
                        <input
                          name="last_name"
                          defaultValue={selectedLead?.last_name || ''}
                          placeholder="Ej. Smith"
                          className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none border-2 border-transparent focus:border-(--accents)"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">Email (opcional)</label>
                      <input
                        name="email"
                        type="email"
                        defaultValue={selectedLead?.email || ''}
                        placeholder="correo@ejemplo.com"
                        className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] font-black uppercase text-black italic">WhatsApp / Tel (opcional)</label>
                      <input
                        name="phone"
                        defaultValue={selectedLead?.phone || ''}
                        placeholder="+52..."
                        className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none"
                      />
                    </div>

                    <div className="bg-[#ece7e2] p-6 rounded-[2rem] border border-black/5 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[12px] font-black uppercase text-black italic">Ubicación</p>
                        <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest">Opcional</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase text-black/60 italic">País</label>
                          <input
                            name="country"
                            defaultValue={selectedLead?.country || ''}
                            placeholder="Ej. México"
                            className="w-full bg-white p-4 rounded-2xl font-black text-black text-base outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase text-black/60 italic">Ciudad</label>
                          <input
                            name="city"
                            defaultValue={selectedLead?.city || ''}
                            placeholder="Ej. Guadalajara"
                            className="w-full bg-white p-4 rounded-2xl font-black text-black text-base outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase text-black/60 italic">Estado</label>
                          <input
                            name="state"
                            defaultValue={selectedLead?.state || ''}
                            placeholder="Ej. Jalisco"
                            className="w-full bg-white p-4 rounded-2xl font-black text-black text-base outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase text-black/60 italic">Código postal</label>
                          <input
                            name="postal_code"
                            defaultValue={selectedLead?.postal_code || ''}
                            placeholder="Ej. 44100"
                            className="w-full bg-white p-4 rounded-2xl font-black text-black text-base outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase text-black/60 italic">Dirección</label>
                        <input
                          name="address"
                          defaultValue={selectedLead?.address || ''}
                          placeholder="Calle, número, colonia…"
                          className="w-full bg-white p-4 rounded-2xl font-black text-black text-base outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Origen</label>
                        <SelectWithOther
                          name="source"
                          options={SOURCES}
                          defaultValue={selectedLead?.source || ''}
                          emptyOption="Selecciona una opción..."
                          className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Estatus</label>
                        <SelectWithOther
                          name="status"
                          options={STATUSES}
                          defaultValue={selectedLead?.status || 'nuevo'}
                          otherOptionValue="otro"
                          className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-black p-8 rounded-[2.5rem] shadow-xl space-y-6">
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-(--accents) italic">Prima estimada (opcional)</label>
                        <input
                          name="estimated_value"
                          type="number"
                          step="0.01"
                          defaultValue={selectedLead?.estimated_value ?? ''}
                          placeholder="Ej. 12000"
                          className="w-full bg-white p-6 rounded-2xl font-black text-black text-3xl outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-(--accents) italic">Tipo de seguro</label>
                        <SelectWithOther
                          name="insurance_type"
                          options={INSURANCE_TYPES}
                          defaultValue={selectedLead?.insurance_type || ''}
                          emptyOption="Selecciona una opción..."
                          className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-(--accents) italic">Etapa</label>
                        <SelectWithOther
                          name="stage"
                          options={STAGES}
                          defaultValue={selectedLead?.stage || 'Primer contacto'}
                          className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Cumpleaños (opcional)</label>
                          <input
                            name="birthday"
                            type="date"
                            defaultValue={selectedLead?.birthday || ''}
                            className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Edad (opcional)</label>
                          <input
                            name="age"
                            type="number"
                            defaultValue={selectedLead?.age ?? ''}
                            placeholder="Ej. 32"
                            min={0}
                            max={120}
                            className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Género</label>
                          <SelectWithOther
                            name="gender"
                            options={GENDERS}
                            defaultValue={selectedLead?.gender || ''}
                            emptyOption="Sin especificar"
                            className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Estado civil</label>
                          <SelectWithOther
                            name="marital_status"
                            options={MARITAL_STATUSES}
                            defaultValue={selectedLead?.marital_status || ''}
                            emptyOption="Sin especificar"
                            className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Intereses del cliente</label>
                        <textarea
                          name="client_interests"
                          defaultValue={selectedLead?.client_interests || ''}
                          rows={3}
                          className="w-full bg-[#ece7e2] p-6 rounded-2xl font-black text-black text-base outline-none resize-none placeholder:text-black/20"
                          placeholder="Ej. Hobbies, deportes, preferencias..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5 space-y-4">
                  <label className="text-[12px] font-black uppercase text-black italic">Notas / Bitácora</label>
                  <textarea
                    name="notes"
                    defaultValue={selectedLead?.notes || ''}
                    rows={5}
                    className="w-full bg-[#ece7e2] p-6 rounded-2xl font-black text-black text-base outline-none resize-none placeholder:text-black/20"
                    placeholder="Escribe aquí acuerdos, próximos pasos y contexto..."
                  />
                </div>

                <details className="group bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5">
                  <summary className="list-none cursor-pointer select-none flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-black uppercase text-black italic">Campos adicionales</p>
                      <p className="text-[11px] font-bold text-black/40 uppercase tracking-widest mt-1">
                        Información financiera y familiar (opcional).
                      </p>
                      {additionalLoading && (
                        <p className="text-[10px] font-black text-(--accents) uppercase tracking-widest mt-2">
                          Cargando…
                        </p>
                      )}
                    </div>
                    <ChevronRight className="text-black/40 transition-transform group-open:rotate-90" size={22} />
                  </summary>

                  <div className="mt-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Fecha de contacto</label>
                        <input
                          name="contact_date"
                          type="date"
                          value={additionalForm.contact_date}
                          onChange={(e) => setAdditionalForm((p) => ({ ...p, contact_date: e.target.value }))}
                          className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Fuma</label>
                        <select
                          name="smoking"
                          defaultValue={selectedLead?.smoking === true ? 'yes' : selectedLead?.smoking === false ? 'no' : ''}
                          className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                        >
                          <option value="">Sin especificar</option>
                          <option value="no">No</option>
                          <option value="yes">Sí</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Toma</label>
                        <select
                          name="drinking"
                          defaultValue={selectedLead?.drinking === true ? 'yes' : selectedLead?.drinking === false ? 'no' : ''}
                          className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                        >
                          <option value="">Sin especificar</option>
                          <option value="no">No</option>
                          <option value="yes">Sí</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Número de dependientes económicos</label>
                        <input
                          name="economic_dependents"
                          type="number"
                          min={0}
                          value={additionalForm.economic_dependents}
                          onChange={(e) => setAdditionalForm((p) => ({ ...p, economic_dependents: e.target.value }))}
                          placeholder="Ej. 2"
                          className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Nivel de estudios</label>
                        <SelectWithOther
                          name="education_level"
                          options={EDUCATION_LEVELS}
                          value={additionalForm.education_level}
                          onChange={(v) => setAdditionalForm((p) => ({ ...p, education_level: v }))}
                          emptyOption="Sin especificar"
                          className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Ocupación</label>
                        <input
                          name="ocupation"
                          defaultValue={selectedLead?.ocupation || ''}
                          placeholder="Ej. Contador/a"
                          className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Sector</label>
                        <input
                          name="sector"
                          value={additionalForm.sector}
                          onChange={(e) => setAdditionalForm((p) => ({ ...p, sector: e.target.value }))}
                          placeholder="Ej. Salud, Educación, Tecnología..."
                          className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none"
                        />
                      </div>
                    </div>

                    <div className="bg-black p-8 rounded-[2.5rem] shadow-xl space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-(--accents) italic">Ingresos mensuales estimados</label>
                          <input
                            name="monthly_income_estimated"
                            type="number"
                            step="0.01"
                            min={0}
                            value={additionalForm.monthly_income_estimated}
                            onChange={(e) => setAdditionalForm((p) => ({ ...p, monthly_income_estimated: e.target.value }))}
                            placeholder="Ej. 45000"
                            className="w-full bg-white p-6 rounded-2xl font-black text-black text-3xl outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-(--accents) italic">Moneda</label>
                          <select
                            name="currency"
                            value={additionalForm.currency}
                            onChange={(e) => setAdditionalForm((p) => ({ ...p, currency: e.target.value }))}
                            className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                          >
                            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-(--accents) italic">Objetivos financieros</label>
                        <textarea
                          name="financial_goals"
                          value={additionalForm.financial_goals}
                          onChange={(e) => setAdditionalForm((p) => ({ ...p, financial_goals: e.target.value }))}
                          rows={3}
                          className="w-full bg-white p-6 rounded-2xl font-black text-black text-base outline-none resize-none placeholder:text-black/30"
                          placeholder="Ej. Retiro, educación, compra de casa, protección familiar..."
                        />
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">¿Tiene hijos?</label>
                          <select
                            value={hasChildren}
                            onChange={(e) => setHasChildren(e.target.value as any)}
                            className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                          >
                            <option value="">Sin especificar</option>
                            <option value="no">No</option>
                            <option value="yes">Sí</option>
                          </select>
                        </div>
                      </div>
                      {hasChildren === 'yes' && (
                        <details className="group mt-6 bg-[#ece7e2] rounded-[2rem] p-6 border border-black/5">
                          <summary className="list-none cursor-pointer select-none flex items-center justify-between">
                            <div>
                              <p className="text-[12px] font-black uppercase text-black italic">Hijos</p>
                              <p className="text-[11px] font-bold text-black/40 uppercase tracking-widest mt-1">
                                Nombre, edad y contacto.
                              </p>
                            </div>
                            <ChevronRight className="text-black/40 transition-transform group-open:rotate-90" size={20} />
                          </summary>

                          <div className="mt-6 space-y-4">
                            {children.length === 0 && (
                              <div className="text-[12px] font-bold text-black/50 uppercase tracking-widest">
                                Aún no hay hijos registrados.
                              </div>
                            )}

                            {children.map((child, idx) => (
                              <div key={idx} className="bg-white rounded-[1.5rem] p-5 border border-black/5">
                                <div className="flex items-center justify-between gap-4">
                                  <p className="text-[11px] font-black uppercase text-black/50 tracking-widest">
                                    Hijo #{idx + 1}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setChildren((prev) => prev.filter((_, i) => i !== idx))}
                                    className="px-4 py-2 rounded-xl bg-black text-white font-black text-[11px] uppercase tracking-widest hover:bg-red-600 transition-all"
                                  >
                                    Eliminar
                                  </button>
                                </div>

                                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-[12px] font-black uppercase text-black italic">Nombre</label>
                                    <input
                                      value={child.name}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        setChildren((prev) => prev.map((c, i) => (i === idx ? { ...c, name: v } : c)))
                                      }}
                                      placeholder="Ej. Sofía"
                                      className="w-full bg-[#ece7e2] p-4 rounded-2xl font-black text-black text-base outline-none"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[12px] font-black uppercase text-black italic">Edad</label>
                                    <input
                                      value={child.age}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        setChildren((prev) => prev.map((c, i) => (i === idx ? { ...c, age: v } : c)))
                                      }}
                                      type="number"
                                      min={0}
                                      max={120}
                                      placeholder="Ej. 8"
                                      className="w-full bg-[#ece7e2] p-4 rounded-2xl font-black text-black text-base outline-none"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[12px] font-black uppercase text-black italic">Contacto</label>
                                    <input
                                      value={child.contact}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        setChildren((prev) => prev.map((c, i) => (i === idx ? { ...c, contact: v } : c)))
                                      }}
                                      placeholder="Tel/Email (opcional)"
                                      className="w-full bg-[#ece7e2] p-4 rounded-2xl font-black text-black text-base outline-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={() => setChildren((prev) => [...prev, { name: '', age: '', contact: '' }])}
                              className="w-full py-4 bg-black text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:bg-(--accents) transition-all"
                            >
                              Agregar hijo
                            </button>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </details>

                <button type="submit" disabled={loading} className="w-full py-7 bg-black text-white rounded-[2rem] font-black text-2xl hover:bg-(--accents) transition-all shadow-2xl active:scale-95 mb-10">
                  {loading ? <Loader2 className="animate-spin mx-auto"/> : selectedLead ? "ACTUALIZAR PIPELINE" : "REGISTRAR EN PIPELINE"}
                </button>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}