"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { DATABASE } from '@/src/config'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CreditCard, Search, X, Plus, Loader2, 
  CheckCircle2, Clock, Banknote, Calendar, 
  ArrowUpRight, Wallet, Trash2, 
  Receipt, TrendingUp, ArrowDownCircle, 
  Fingerprint, FileText, AlertTriangle, ChevronRight
} from 'lucide-react'
import { supabaseClient } from '@/src/lib/supabase/client'
import { toast, Toaster } from 'sonner'

export default function PagosPage() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [payments, setPayments] = useState<any[]>([])
  const [policies, setPolicies] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendiente' | 'pagado' | 'vencido'>('todos')

  // --- CARGA DE DATOS ---
  const fetchData = useCallback(async () => {
    setFetching(true)
    try {
      const { data: pays, error } = await supabaseClient
        .from(DATABASE.TABLES.WS_PAYMENTS)
        .select('*, WS_POLICIES(policy_number, WS_CUSTOMERS(full_name))')
        .order('due_date', { ascending: true })
      
      const { data: pols } = await supabaseClient.from(DATABASE.TABLES.WS_POLICIES).select('id, policy_number')
      
      if (error) throw error
      setPayments(pays || [])
      setPolicies(pols || [])
    } catch (err: any) {
      toast.error("Error de conexión financiera")
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // --- PROCESADOR DE RECAUDO ---
  const handleProcessPayment = async (id: string, currentStatus: string) => {
    const isPaying = currentStatus === 'pendiente' || currentStatus === 'vencido'
    const nextStatus = isPaying ? 'pagado' : 'pendiente'
    const timestamp = isPaying ? new Date().toISOString() : null

    try {
      const { error } = await supabaseClient
        .from(DATABASE.TABLES.WS_PAYMENTS)
        .update({ status: nextStatus, payment_date: timestamp })
        .eq('id', id)

      if (error) throw error

      setPayments(prev => prev.map(p => 
        p.id === id ? { ...p, status: nextStatus, payment_date: timestamp } : p
      ))
      
      toast.success(isPaying ? "Recaudo ingresado con éxito" : "Pago revertido")
    } catch (err: any) {
      toast.error("Error al procesar")
    }
  }

  // --- ELIMINAR REGISTRO ---
  const handleDeletePayment = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este registro de pago?")) return
    
    try {
      const { error } = await supabaseClient.from(DATABASE.TABLES.WS_PAYMENTS).delete().eq('id', id)
      if (error) throw error
      setPayments(prev => prev.filter(p => p.id !== id))
      toast.success("Registro eliminado")
    } catch (err: any) {
      toast.error("No se pudo eliminar")
    }
  }

  const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    
    try {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user) return

      const { error } = await supabaseClient.from(DATABASE.TABLES.WS_PAYMENTS).insert([{
        user_id: user.id,
        policy_id: formData.get('policyId'),
        amount: parseFloat(formData.get('amount') as string),
        due_date: formData.get('dueDate'),
        payment_method: formData.get('method'),
        status: 'pendiente'
      }])

      if (error) throw error
      toast.success("Cobro programado")
      await fetchData()
      setIsPanelOpen(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  // --- MÉTRICAS ---
  const stats = useMemo(() => {
    const recaudado = payments.filter(p => p.status === 'pagado').reduce((acc, p) => acc + (p.amount || 0), 0)
    const pendiente = payments.filter(p => p.status === 'pendiente').reduce((acc, p) => acc + (p.amount || 0), 0)
    const mora = payments.filter(p => p.status !== 'pagado' && new Date(p.due_date) < new Date()).length
    return { recaudado, pendiente, mora }
  }, [payments])

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const matchesSearch = p.WS_POLICIES?.WS_CUSTOMERS?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            p.WS_POLICIES?.policy_number?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const isExpired = p.status !== 'pagado' && new Date(p.due_date) < new Date()
      const matchesStatus = filterStatus === 'todos' || 
                           (filterStatus === 'vencido' ? isExpired : p.status === filterStatus)
      
      return matchesSearch && matchesStatus
    })
  }, [payments, searchTerm, filterStatus])

  return (
    <div className="space-y-10 p-2 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <Toaster richColors position="top-right" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-5xl font-black text-black tracking-tighter italic uppercase flex items-center gap-4">
            Tesorería<span className="text-(--accents) not-italic">.</span>
          </h2>
          <p className="text-black/40 font-bold text-xs uppercase tracking-[0.4em] mt-2 italic">Administración de Flujo de Efectivo</p>
        </div>
        <button 
          onClick={() => setIsPanelOpen(true)}
          className="bg-black text-white px-10 py-6 rounded-[2rem] font-black text-sm flex items-center gap-4 hover:bg-(--accents) transition-all shadow-2xl active:scale-95 group"
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform" /> AGENDAR COBRO
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-10 rounded-[3rem] border border-black/5 shadow-sm relative overflow-hidden">
          <TrendingUp className="absolute -right-6 -bottom-6 text-green-600/5" size={140} />
          <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-4 italic">Total Recaudado</p>
          <h4 className="text-4xl font-black text-black tracking-tighter">${stats.recaudado.toLocaleString()}</h4>
        </div>
        <div className="bg-black p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <ArrowDownCircle className="absolute -right-6 -bottom-6 text-(--accents)/10" size={140} />
          <p className="text-[10px] font-black text-(--accents) uppercase tracking-widest mb-4 italic">Cuentas por Cobrar</p>
          <h4 className="text-4xl font-black text-white tracking-tighter">${stats.pendiente.toLocaleString()}</h4>
        </div>
        <div className="bg-white p-10 rounded-[3rem] border border-black/5 shadow-sm relative overflow-hidden">
          <AlertTriangle className="absolute -right-6 -bottom-6 text-red-600/5" size={140} />
          <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-4 italic">Recibos en Mora</p>
          <h4 className="text-4xl font-black text-black tracking-tighter">{stats.mora}</h4>
        </div>
      </div>

      {/* FILTROS */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-black/20" size={24} />
          <input 
            type="text" placeholder="BUSCAR POR CLIENTE O PÓLIZA..."
            className="w-full bg-white p-6 pl-16 rounded-[2rem] border border-black/5 font-black text-black outline-none focus:ring-2 focus:ring-(--accents)/20 transition-all uppercase text-xs"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-white p-2 rounded-[2rem] border border-black/5">
          {['todos', 'pendiente', 'pagado', 'vencido'].map((s) => (
            <button 
              key={s} onClick={() => setFilterStatus(s as any)}
              className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${filterStatus === s ? 'bg-black text-white' : 'text-black/40 hover:text-black'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-[3.5rem] border border-black/5 shadow-sm overflow-hidden min-h-[500px]">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-black/5">
              <th className="p-10 text-[10px] font-black text-black/30 uppercase tracking-widest italic">Detalle de Póliza</th>
              <th className="p-10 text-[10px] font-black text-black/30 uppercase tracking-widest italic">Cronología</th>
              <th className="p-10 text-[10px] font-black text-black/30 uppercase tracking-widest italic">Importe</th>
              <th className="p-10 text-[10px] font-black text-black/30 uppercase tracking-widest text-center italic">Acción / Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fetching ? (
              <tr><td colSpan={4} className="p-20 text-center font-black text-black/20 animate-pulse">SINCRONIZANDO DATOS...</td></tr>
            ) : filteredPayments.map((p) => {
              const isExpired = p.status !== 'pagado' && new Date(p.due_date) < new Date()
              return (
                <tr key={p.id} className="hover:bg-gray-50 transition-all group">
                  <td className="p-10">
                    <div className="flex items-center gap-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${p.status === 'pagado' ? 'bg-(--accents)/10 text-(--accents)' : 'bg-gray-100 text-black/20'}`}>
                        <Fingerprint size={28} />
                      </div>
                      <div>
                        <p className="font-black text-black text-lg uppercase tracking-tighter leading-none">{p.WS_POLICIES?.WS_CUSTOMERS?.full_name}</p>
                        <p className="text-[10px] font-bold text-black/40 uppercase mt-1 tracking-widest flex items-center gap-1">
                          <FileText size={12} /> {p.WS_POLICIES?.policy_number}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-10">
                    <div className={`font-black text-sm uppercase flex items-center gap-2 ${isExpired ? 'text-red-500' : 'text-black'}`}>
                      <Calendar size={14} /> {new Date(p.due_date).toLocaleDateString()}
                    </div>
                    {p.status === 'pagado' && p.payment_date && (
                      <div className="text-[9px] font-black text-(--accents) uppercase mt-1 bg-green-50 px-2 py-0.5 rounded w-fit italic">
                        Liquidado: {new Date(p.payment_date).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="p-10 text-2xl font-black text-black tracking-tighter">
                    ${(p.amount || 0).toLocaleString()}
                  </td>
                  <td className="p-10">
                    <div className="flex items-center justify-center gap-4">
                       <button 
                        onClick={() => handleProcessPayment(p.id, p.status)}
                        className={`flex-1 max-w-[140px] py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          p.status === 'pagado' ? 'bg-(--accents) text-white shadow-lg shadow-(--accents)/20' : 'bg-black text-white hover:bg-green-700'
                        }`}
                      >
                        {p.status === 'pagado' ? 'Cobrado' : isExpired ? 'Vencido' : 'Pendiente'}
                      </button>
                      <button 
                        onClick={() => handleDeletePayment(p.id)}
                        className="p-4 text-black/10 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* PANEL LATERAL DE REGISTRO MANUAL */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPanelOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-md z-40" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed right-0 top-0 h-screen w-full max-w-xl bg-[#ece7e2] z-50 flex flex-col shadow-2xl">
              <div className="p-10 bg-white border-b-4 border-black/5 flex justify-between items-center text-black font-black italic text-2xl uppercase italic tracking-tighter">
                Programar Cobro Manual
                <button onClick={() => setIsPanelOpen(false)} className="hover:rotate-90 transition-transform"><X size={32}/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-8">
                <form id="pay-form" onSubmit={handleAddPayment} className="space-y-8">
                  <div className="bg-white p-8 rounded-[2rem] border border-black/5 space-y-4">
                    <label className="text-[10px] font-black text-black/30 uppercase tracking-widest italic">01. Selección de Entidad</label>
                    <select required name="policyId" className="w-full bg-[#ece7e2] text-black font-black py-5 px-6 rounded-2xl outline-none appearance-none cursor-pointer">
                      <option value="">Seleccionar Póliza...</option>
                      {policies.map(p => <option key={p.id} value={p.id}>{p.policy_number}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black p-8 rounded-[2rem] shadow-xl">
                      <label className="text-[10px] font-black text-(--accents) uppercase block mb-2 tracking-widest">Monto</label>
                      <input required name="amount" type="number" step="0.01" placeholder="0.00" className="w-full bg-transparent text-white text-3xl font-black outline-none placeholder:text-white/10" />
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] border border-black/5">
                      <label className="text-[10px] font-black text-black/30 uppercase block mb-2 tracking-widest">Vencimiento</label>
                      <input required name="dueDate" type="date" className="w-full bg-transparent text-black font-black text-xl outline-none" />
                    </div>
                  </div>
                  

                  <div className="bg-white p-8 rounded-[2rem] border border-black/5 space-y-6">
                    <label className="text-[10px] font-black text-black/30 uppercase tracking-widest">02. Método de Liquidación</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Transferencia', 'Tarjeta', 'Efectivo', 'Domiciliado'].map(m => (
                        <label key={m} className="flex items-center gap-3 p-4 border border-gray-100 rounded-2xl cursor-pointer hover:bg-black group transition-all">
                          <input type="radio" name="method" value={m} defaultChecked={m === 'Transferencia'} className="accent-(--accents)" />
                          <span className="font-black text-[10px] uppercase text-black group-hover:text-white">{m}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-10 bg-white border-t-4 border-black/5">
                <button form="pay-form" type="submit" disabled={loading} className="w-full py-7 rounded-[2rem] bg-black text-white font-black text-2xl flex items-center justify-center gap-4 hover:bg-(--accents) transition-all">
                  {loading ? <Loader2 className="animate-spin" size={32} /> : "CREAR RECIBO"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}