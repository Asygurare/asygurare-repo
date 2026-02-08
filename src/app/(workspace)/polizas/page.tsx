"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { DATABASE } from '@/src/config'
import {
  Shield, Search, Filter, Plus, Loader2, ChevronRight, ShieldCheck,
  Calendar, Trash2, Clock
} from 'lucide-react'
import { supabaseClient } from '@/src/lib/supabase/client'
import { getFullName } from '@/src/lib/utils/utils'
import { toast, Toaster } from 'sonner'
import { PolicyCaptureModal } from '@/src/components/workspace/polizas/PolicyCaptureModal'

export default function PolizasPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null)
  const [fetching, setFetching] = useState(true)
  const [policies, setPolicies] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // 1. CARGA DE DATOS RELACIONALES
  const fetchData = useCallback(async () => {
    setFetching(true)
    try {
      const { data: pols, error: polError } = await supabaseClient
        .from(DATABASE.TABLES.WS_POLICIES)
        .select('*, WS_CUSTOMERS_2(name, last_name, email)')
        .order('expiry_date', { ascending: true })
      
      const { data: custs } = await supabaseClient.from(DATABASE.TABLES.WS_CUSTOMERS_2).select('id, name, last_name')
      
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
      getFullName(p.WS_CUSTOMERS_2 || {}).toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedPolicy(null)
  }

  const deletePolicy = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("¿Eliminar esta póliza? Esto borrará todos sus pagos asociados automáticamente.")) return
    const { error } = await supabaseClient.from(DATABASE.TABLES.WS_POLICIES).delete().eq('id', id)
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
          onClick={() => { setSelectedPolicy(null); setIsModalOpen(true); }}
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
                        onClick={() => { setSelectedPolicy(p); setIsModalOpen(true); }}
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
                            <p className="font-black text-black text-base uppercase leading-tight">{getFullName(p.WS_CUSTOMERS_2 || {})}</p>
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

      <PolicyCaptureModal
        isOpen={isModalOpen}
        onClose={closeModal}
        customers={customers}
        selectedPolicy={selectedPolicy}
        onSuccess={fetchData}
      />
    </div>
  )
}