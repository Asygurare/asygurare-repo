"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Zap, Target, X, Mail, Phone, Loader2, CheckCircle2, 
  TrendingUp, DollarSign, UserCheck, Trash2, Edit3, 
  Search, Clock, Info, Share2, MessageSquare, ChevronRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase/supabase'
import { toast, Toaster } from 'sonner'

export default function ProspectosFinalUltraPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [fetching, setFetching] = useState(true)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [monthlyGoal, setMonthlyGoal] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)

  const STAGES = ['Primer contacto', 'Cita agendada', 'Propuesta enviada', 'En negociación']
  const SOURCES = ['Referido', 'Redes Sociales', 'Llamada en Frío', 'Campaña Web', 'Cartera Antigua']

  const fetchData = useCallback(async () => {
    setFetching(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const currentMonth = new Date().toISOString().slice(0, 7)
    const [leadsRes, goalRes] = await Promise.all([
      supabase.from('leads').select('*').order('updated_at', { ascending: false }),
      supabase.from('user_goals').select('amount').eq('month_year', currentMonth).maybeSingle()
    ])

    if (leadsRes.data) setLeads(leadsRes.data)
    if (goalRes.data) setMonthlyGoal(goalRes.data.amount)
    setFetching(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // --- ACCIONES REALES ---

  const updateStage = async (id: string, newStage: string) => {
    const { error } = await supabase.from('leads').update({ 
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
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (!error) {
      toast.success("Lead eliminado")
      setLeads(leads.filter(l => l.id !== id))
    }
  }

  const handleConvertToCustomer = async (lead: any) => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Insertar en clientes
    const { error: insertError } = await supabase.from('customers').insert({
      user_id: user?.id,
      full_name: lead.full_name,
      email: lead.email,
      phone: lead.phone
    })

    if (insertError) {
      toast.error("Error al convertir: " + insertError.message)
    } else {
      // 2. Eliminar de leads
      await supabase.from('leads').delete().eq('id', lead.id)
      toast.success("¡FELICIDADES! Venta cerrada y movida a Clientes.")
      setIsPanelOpen(false)
      fetchData()
    }
    setLoading(false)
  }

  const handleSaveLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      user_id: user?.id,
      full_name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      source: formData.get('source'),
      estimated_value: parseFloat(formData.get('value') as string) || 0,
      interest_category: formData.get('category'),
      notes: formData.get('notes'),
      updated_at: new Date().toISOString()
    }

    const res = selectedLead 
      ? await supabase.from('leads').update(payload).eq('id', selectedLead.id)
      : await supabase.from('leads').insert([{ ...payload, stage: 'Primer contacto' }])
    
    if (res.error) toast.error("Error al guardar")
    else {
      toast.success(selectedLead ? "Expediente actualizado" : "Prospecto registrado")
      setIsPanelOpen(false)
      fetchData()
    }
    setLoading(false)
  }

  const totalValue = useMemo(() => leads.reduce((acc, l) => acc + (Number(l.estimated_value) || 0), 0), [leads])
  const leadsFiltrados = leads.filter(l => l.full_name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="space-y-10 pb-20 p-6 max-w-[1400px] mx-auto bg- min-h-screen">
      <Toaster richColors position="bottom-right" />

      {/* DASHBOARD */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5">
          <h2 className="text-4xl font-black italic text-black uppercase tracking-tighter">VENTAS.</h2>
          <p className="text-black font-bold text-[10px] uppercase tracking-widest mt-1">Techguros Intelligence</p>
        </div>
        <div className="bg-black p-8 rounded-[2.5rem] text-white flex flex-col justify-center">
          <p className="text-[10px] font-black text-(--accents) uppercase mb-1 tracking-widest">Pipeline Activo</p>
          <h3 className="text-4xl font-black">${totalValue.toLocaleString()}</h3>
        </div>
        <div className="bg-(--accents) p-8 rounded-[2.5rem] text-white flex flex-col justify-center">
          <p className="text-[10px] font-black text-white/60 uppercase mb-1 tracking-widest">Avance vs Meta</p>
          <h3 className="text-4xl font-black">{monthlyGoal > 0 ? ((totalValue/monthlyGoal)*100).toFixed(0) : 0}%</h3>
        </div>
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
        <button onClick={() => {setSelectedLead(null); setIsPanelOpen(true)}} className="bg-black text-white px-10 py-6 rounded-[2rem] font-black flex items-center gap-3 hover:bg-(--accents) transition-all shadow-xl active:scale-95">
          <Zap size={22} className="text-yellow-400" fill="currentColor"/> NUEVA OPORTUNIDAD
        </button>
      </div>

      {/* LISTA */}
      <div className="grid grid-cols-1 gap-5">
        {fetching ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-(--accents)" size={40}/></div> : 
        leadsFiltrados.map((lead) => (
          <div key={lead.id} className="bg-white p-8 rounded-[3rem] border-2 border-transparent hover:border-(--accents)/30 flex flex-wrap items-center gap-8 group transition-all shadow-md">
            <div className="flex-1 min-w-[300px] cursor-pointer" onClick={() => {setSelectedLead(lead); setIsPanelOpen(true)}}>
              <h4 className="font-black text-black text-2xl uppercase italic group-hover:text-(--accents) transition-colors tracking-tighter">{lead.full_name}</h4>
              <div className="flex flex-wrap gap-4 mt-2">
                <span className="flex items-center gap-1 text-[11px] font-black text-black/40 uppercase italic tracking-wider"><Share2 size={12}/> {lead.source || 'Sin Fuente'}</span>
                <span className="flex items-center gap-1 text-[11px] font-black text-black/40 uppercase italic tracking-wider"><Mail size={12}/> {lead.email || 'Sin Email'}</span>
                <span className="flex items-center gap-1 text-[11px] font-black text-(--accents) uppercase italic tracking-wider"><Phone size={12}/> {lead.phone}</span>
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

      {/* PANEL LATERAL */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPanelOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }} className="fixed right-0 top-0 h-screen w-full max-w-xl bg-[#ece7e2] z-[70] flex flex-col shadow-2xl">
              
              <div className="p-10 bg-white flex justify-between items-center border-b-2 border-black/5 shadow-sm">
                <h3 className="text-3xl font-black italic text-black uppercase tracking-tighter">{selectedLead ? 'Expediente' : 'Nueva Captura'}</h3>
                <button onClick={() => setIsPanelOpen(false)} className="p-3 hover:bg-gray-100 rounded-full text-black transition-all"><X size={32}/></button>
              </div>

              <form onSubmit={handleSaveLead} className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                
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

                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[12px] font-black uppercase text-black italic">Nombre del Prospecto</label>
                    <input name="name" defaultValue={selectedLead?.full_name} required className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none border-2 border-transparent focus:border-(--accents)" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">WhatsApp</label>
                        <input name="phone" defaultValue={selectedLead?.phone} placeholder="+52..." className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Email Principal</label>
                        <input name="email" type="email" defaultValue={selectedLead?.email} required className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Origen del Prospecto (Source)</label>
                        <select name="source" defaultValue={selectedLead?.source} required className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer">
                            <option value="">Selecciona una opción...</option>
                            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                  </div>
                </div>

                <div className="bg-black p-8 rounded-[2.5rem] shadow-xl space-y-6">
                    <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-(--accents) italic">Prima Estimada ($)</label>
                        <input name="value" type="number" step="0.01" defaultValue={selectedLead?.estimated_value} required className="w-full bg-white p-6 rounded-2xl font-black text-black text-3xl outline-none" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-(--accents) italic">Tipo de Seguro</label>
                        <select name="category" defaultValue={selectedLead?.interest_category} className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer">
                            <option>Autos</option>
                            <option>Vida</option>
                            <option>Salud</option>
                            <option>Hogar / Empresa</option>
                        </select>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5 space-y-4">
                    <label className="text-[12px] font-black uppercase text-black italic">Bitácora de Seguimiento</label>
                    <textarea name="notes" defaultValue={selectedLead?.notes} rows={5} className="w-full bg-[#ece7e2] p-6 rounded-2xl font-black text-black text-base outline-none resize-none placeholder:text-black/20" placeholder="Escribe aquí los acuerdos de hoy..." />
                </div>

                <button type="submit" disabled={loading} className="w-full py-7 bg-black text-white rounded-[2rem] font-black text-2xl hover:bg-(--accents) transition-all shadow-2xl active:scale-95 mb-10">
                  {loading ? <Loader2 className="animate-spin mx-auto"/> : selectedLead ? "ACTUALIZAR PIPELINE" : "REGISTRAR EN PIPELINE"}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}