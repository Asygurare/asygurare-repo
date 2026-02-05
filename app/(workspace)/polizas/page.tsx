"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield, Search, Filter, X, Plus, Loader2, 
  CheckCircle2, ChevronRight, ShieldCheck, AlertCircle,
  Calendar, Building, Hash, DollarSign, Trash2, Edit3, 
  ArrowUpRight, Clock, FileText, Download, Repeat
} from 'lucide-react'
import { supabase } from '@/lib/supabase/supabase'
import { toast, Toaster } from 'sonner'

export default function PolizasPage() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [success, setSuccess] = useState(false)
  const [policies, setPolicies] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // 1. CARGA DE DATOS RELACIONALES
  const fetchData = useCallback(async () => {
    setFetching(true)
    try {
      const { data: pols, error: polError } = await supabase
        .from('policies')
        .select('*, customers(full_name, email)')
        .order('expiry_date', { ascending: true })
      
      const { data: custs } = await supabase.from('customers').select('id, full_name')
      
      if (polError) throw polError
      setPolicies(pols || [])
      setCustomers(custs || [])
    } catch (error: any) {
      toast.error("Error al sincronizar: " + error.message)
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // 2. BUSCADOR INTELIGENTE
  const filteredPolicies = useMemo(() => {
    return policies.filter(p => 
      p.policy_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.insurance_company?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [policies, searchTerm])

  // 3. MÉTRICAS DE CARTERA
  const stats = useMemo(() => {
    const total = policies.reduce((acc, p) => acc + (p.total_premium || 0), 0)
    const active = policies.filter(p => new Date(p.expiry_date) >= new Date()).length
    const expiringSoon = policies.filter(p => {
      const diff = new Date(p.expiry_date).getTime() - new Date().getTime()
      return diff > 0 && diff < (30 * 24 * 60 * 60 * 1000)
    }).length
    return { total, active, expiringSoon }
  }, [policies])

  // 4. GUARDAR / EDITAR (CON LÓGICA DE FRECUENCIA)
  const handleSavePolicy = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    // Payload actualizado con frecuencia_pago y total_premium
    const payload = {
      user_id: user.id,
      customer_id: formData.get('customerId'),
      policy_number: formData.get('policyNumber'),
      insurance_company: formData.get('company'),
      category: formData.get('category'),
      effective_date: formData.get('effectiveDate'),
      expiry_date: formData.get('expiryDate'),
      total_premium: parseFloat(formData.get('premium') as string),
      frecuencia_pago: formData.get('frecuencia_pago'), // <-- NUEVO
      start_date: formData.get('effectiveDate'), // Para el Trigger de pagos
    }

    const res = selectedPolicy 
      ? await supabase.from('policies').update(payload).eq('id', selectedPolicy.id)
      : await supabase.from('policies').insert([{ ...payload, status: 'activa' }])

    if (!res.error) {
      setSuccess(true)
      toast.success(selectedPolicy ? "Contrato actualizado" : "Póliza emitida y pagos generados")
      await fetchData()
      setTimeout(() => { 
        setSuccess(false)
        setIsPanelOpen(false)
        setSelectedPolicy(null)
      }, 1000)
    } else {
      toast.error("Error técnico: " + res.error.message)
    }
    setLoading(false)
  }

  const deletePolicy = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("¿Eliminar esta póliza? Esto borrará todos sus pagos asociados automáticamente.")) return
    const { error } = await supabase.from('policies').delete().eq('id', id)
    if (!error) {
      setPolicies(policies.filter(p => p.id !== id))
      toast.success("Expediente eliminado")
    }
  }

  return (
    <div className="space-y-10 p-2 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <Toaster richColors position="top-right" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-black rounded-2xl shadow-xl shadow-black/20">
                <Shield className="text-(--accents)" size={28} />
            </div>
            <h2 className="text-4xl font-black text-black tracking-tighter italic uppercase">Gestión de Riesgos.</h2>
          </div>
          <p className="text-black/50 font-bold text-[10px] uppercase tracking-[0.4em] ml-1 italic">Master Policy Administrator v2.0</p>
        </div>
        <button 
          onClick={() => { setSelectedPolicy(null); setIsPanelOpen(true); }}
          className="bg-black text-white px-10 py-6 rounded-[2.5rem] font-black text-sm flex items-center gap-4 hover:bg-(--accents) transition-all shadow-2xl active:scale-95 group"
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform" /> EMITIR NUEVO CONTRATO
        </button>
      </div>

      {/* TABLERO DE CONTROL */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
          <p className="text-[10px] font-black text-black/40 uppercase tracking-widest italic">Primas en Cartera</p>
          <h4 className="text-3xl font-black text-black mt-2">${stats.total.toLocaleString()}</h4>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
          <p className="text-[10px] font-black text-(--accents) uppercase tracking-widest italic">Contratos Activos</p>
          <h4 className="text-3xl font-black text-black mt-2">{stats.active}</h4>
        </div>
        <div className="bg-orange-500 p-8 rounded-[2.5rem] text-white shadow-xl shadow-orange-200">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80 italic">Por Vencer (30d)</p>
          <h4 className="text-3xl font-black mt-2 flex items-center gap-2">
            <Clock size={24} /> {stats.expiringSoon}
          </h4>
        </div>
        <div className="bg-black p-8 rounded-[2.5rem] text-white overflow-hidden relative">
          <div className="absolute -right-2 -bottom-2 opacity-10">
            <Shield size={80} className="text-(--accents)" />
          </div>
          <p className="text-[10px] font-black text-(--accents) uppercase tracking-widest italic relative z-10">Siniestralidad</p>
          <h4 className="text-3xl font-black mt-2 relative z-10">2.4%</h4>
        </div>
      </div>

      {/* FILTROS */}
      <div className="flex gap-4 items-center bg-white p-4 rounded-[2rem] border border-black/5 shadow-sm">
        <div className="flex-1 relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-black/20" size={22} />
            <input 
                type="text"
                placeholder="BUSCAR POR CLIENTE, PÓLIZA O COMPAÑÍA..."
                className="w-full bg-[#ece7e2]/50 p-5 pl-16 rounded-2xl font-black text-black outline-none border-2 border-transparent focus:border-(--accents)/20 transition-all uppercase text-xs"
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <button className="bg-[#ece7e2] p-5 rounded-2xl text-black font-black flex items-center gap-2 hover:bg-black hover:text-white transition-all uppercase text-[10px] tracking-widest">
            <Filter size={18} /> <span className="hidden md:block">FILTROS AVANZADOS</span>
        </button>
      </div>

      {/* LISTADO TÉCNICO */}
      <div className="bg-white rounded-[3rem] border border-black/5 shadow-sm overflow-hidden min-h-[500px]">
        {fetching ? (
          <div className="flex justify-center items-center h-[500px]"><Loader2 className="animate-spin text-(--accents)" size={40} /></div>
        ) : filteredPolicies.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                <tr className="bg-gray-50 border-b border-black/5">
                    <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-[0.2em] italic">Referencia / Ramo</th>
                    <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-[0.2em] italic">Titular del Riesgo</th>
                    <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-[0.2em] italic">Vigencia</th>
                    <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-[0.2em] italic">Estado / Prima</th>
                    <th className="p-8"></th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                {filteredPolicies.map((p) => {
                    const expiry = new Date(p.expiry_date);
                    const isExpired = expiry < new Date();
                    const isExpiringSoon = !isExpired && (expiry.getTime() - new Date().getTime() < (30 * 24 * 60 * 60 * 1000));

                    return (
                    <tr 
                        key={p.id} 
                        onClick={() => { setSelectedPolicy(p); setIsPanelOpen(true); }}
                        className="hover:bg-[#ece7e2]/40 transition-all group cursor-pointer"
                    >
                        <td className="p-8">
                            <div className="flex items-center gap-5">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${isExpired ? 'bg-red-50 text-red-500' : isExpiringSoon ? 'bg-orange-50 text-orange-500' : 'bg-black text-(--accents)'}`}>
                                    <ShieldCheck size={28} />
                                </div>
                                <div>
                                    <p className="font-black text-black text-lg uppercase tracking-tighter leading-none mb-1">{p.policy_number}</p>
                                    <div className="flex gap-2">
                                      <span className="bg-(--accents)/10 text-(--accents) px-2 py-0.5 rounded text-[8px] font-black uppercase">{p.category}</span>
                                      <span className="bg-black text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">{p.frecuencia_pago}</span>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td className="p-8">
                            <p className="font-black text-black text-base uppercase leading-tight">{p.customers?.full_name}</p>
                            <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest mt-1 italic">{p.insurance_company}</p>
                        </td>
                        <td className="p-8">
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs ${isExpired ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-black'}`}>
                                <Calendar size={14} /> {expiry.toLocaleDateString()}
                            </div>
                        </td>
                        <td className="p-8">
                            <p className="text-xl font-black text-black tracking-tighter">${p.total_premium.toLocaleString()}</p>
                            <div className="flex items-center gap-1 mt-1">
                                <div className={`w-2 h-2 rounded-full ${isExpired ? 'bg-red-500' : 'bg-(--accents)'}`} />
                                <span className="text-[10px] font-black uppercase text-black/40 italic">{isExpired ? 'Vencida' : 'Vigente'}</span>
                            </div>
                        </td>
                        <td className="p-8 text-right">
                            <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => deletePolicy(p.id, e)} className="p-3 text-black/20 hover:text-red-500 transition-all"><Trash2 size={18}/></button>
                                <div className="p-3 bg-black text-(--accents) rounded-xl"><ChevronRight size={18}/></div>
                            </div>
                        </td>
                    </tr>
                    )
                })}
                </tbody>
            </table>
          </div>
        ) : (
          <div className="p-32 flex flex-col items-center text-center">
            <Shield size={80} className="text-gray-100 mb-8" />
            <h3 className="text-3xl font-black text-black italic uppercase italic">Cartera Vacía</h3>
            <p className="text-gray-400 max-w-sm mt-3 font-bold uppercase tracking-widest text-[10px] leading-relaxed">No hay pólizas registradas. Comienza a emitir contratos para activar el panel de riesgos.</p>
          </div>
        )}
      </div>

      {/* PANEL LATERAL */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPanelOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-md z-40" />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className="fixed right-0 top-0 h-screen w-full max-w-xl bg-[#ece7e2] z-50 flex flex-col shadow-2xl"
            >
              <div className="p-10 bg-white border-b-4 border-black/5 flex justify-between items-center">
                <div>
                  <h3 className="text-3xl font-black text-black italic uppercase tracking-tighter italic">
                    {selectedPolicy ? 'Expediente Póliza' : 'Emisión Técnica'}
                  </h3>
                  <p className="text-[10px] font-black text-(--accents) uppercase tracking-widest mt-1 italic">Sincronización Supabase Cloud</p>
                </div>
                <button onClick={() => setIsPanelOpen(false)} className="p-4 hover:rotate-90 transition-transform text-black"><X size={32}/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                <form id="policy-form" onSubmit={handleSavePolicy} className="space-y-10">
                  
                  {/* CLIENTE */}
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-black uppercase tracking-widest italic">01. Responsable del Riesgo</label>
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                        <select required name="customerId" defaultValue={selectedPolicy?.customer_id} className="w-full bg-[#ece7e2] text-black font-black py-5 px-6 rounded-2xl outline-none appearance-none cursor-pointer text-lg">
                            <option value="">Seleccionar Titular...</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                        </select>
                    </div>
                  </div>

                  {/* DATOS */}
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-black uppercase tracking-widest italic">02. Especificaciones</label>
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-black/30 uppercase ml-2">Referencia de Póliza</label>
                            <input required name="policyNumber" defaultValue={selectedPolicy?.policy_number} placeholder="POL-X" className="w-full bg-[#ece7e2] text-black font-black py-5 px-6 rounded-2xl outline-none text-xl uppercase" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-black/30 uppercase ml-2">Aseguradora</label>
                                <input required name="company" defaultValue={selectedPolicy?.insurance_company} placeholder="GNP / AXA" className="w-full bg-[#ece7e2] text-black font-black py-4 px-6 rounded-2xl outline-none text-sm uppercase" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-black/30 uppercase ml-2">Ramo</label>
                                <select name="category" defaultValue={selectedPolicy?.category || "Autos"} className="w-full bg-[#ece7e2] text-black font-black py-4 px-6 rounded-2xl outline-none text-sm cursor-pointer uppercase">
                                    <option value="Autos">Autos</option>
                                    <option value="Vida">Vida</option>
                                    <option value="GMM">Gastos Médicos</option>
                                    <option value="Hogar">Hogar</option>
                                </select>
                            </div>
                        </div>
                    </div>
                  </div>

                  {/* VIGENCIAS */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5">
                      <label className="text-[10px] font-black text-black/40 uppercase block mb-3 tracking-widest italic">Inicio Cobertura</label>
                      <input required name="effectiveDate" type="date" defaultValue={selectedPolicy?.effective_date} className="w-full bg-transparent text-black font-black text-xl outline-none" />
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-lg shadow-orange-100">
                      <label className="text-[10px] font-black text-orange-500 uppercase block mb-3 tracking-widest italic">Fin Vigencia</label>
                      <input required name="expiryDate" type="date" defaultValue={selectedPolicy?.expiry_date} className="w-full bg-transparent text-black font-black text-xl outline-none" />
                    </div>
                  </div>

                  {/* FINANZAS Y REPETICIÓN (LO NUEVO) */}
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-black uppercase tracking-widest italic">03. Estructura Financiera</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* MONTO */}
                      <div className="bg-black p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                        <DollarSign className="absolute -right-4 -top-4 text-(--accents)/20 group-hover:scale-110 transition-transform" size={100} />
                        <label className="text-[10px] font-black text-(--accents) uppercase block mb-2 tracking-widest italic relative z-10">Prima Total</label>
                        <input required name="premium" type="number" step="0.01" defaultValue={selectedPolicy?.total_premium} placeholder="0.00" className="w-full bg-transparent text-white text-4xl font-black outline-none relative z-10" />
                      </div>

                      {/* FRECUENCIA */}
                      <div className="bg-white p-8 rounded-[2.5rem] border-2 border-black flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-2 text-black/30">
                          <Repeat size={14} />
                          <label className="text-[10px] font-black uppercase tracking-widest italic">Esquema de Cobro</label>
                        </div>
                        <select 
                          required 
                          name="frecuencia_pago" 
                          defaultValue={selectedPolicy?.frecuencia_pago || "Mensual"}
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
                          Al emitir este contrato, el sistema generará automáticamente los recibos de cobro basados en la frecuencia seleccionada.
                        </p>
                      </div>
                    )}
                  </div>

                </form>
              </div>

              <div className="p-10 bg-white border-t-4 border-black/5">
                <button 
                  form="policy-form" type="submit" disabled={loading || success}
                  className={`w-full py-7 rounded-[2.5rem] font-black text-2xl transition-all flex items-center justify-center gap-4 shadow-2xl active:scale-95 ${
                    success ? 'bg-green-600 text-white' : 'bg-black text-white hover:bg-(--accents)'
                  }`}
                >
                  {loading ? <Loader2 className="animate-spin" size={32} /> : success ? <><CheckCircle2 size={32}/> OPERACIÓN EXITOSA</> : selectedPolicy ? "ACTUALIZAR CONTRATO" : "EMITIR PÓLIZA"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}