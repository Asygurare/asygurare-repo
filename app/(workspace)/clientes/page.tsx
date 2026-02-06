"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { DATABASE } from '@/config'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, Search, X, UserPlus, Mail, Phone, 
  Loader2, CheckCircle2, ChevronRight, Building2, 
  User, Trash2, Save, Calendar
} from 'lucide-react'
import { supabase } from '@/lib/supabase/supabase'
import { toast, Toaster } from 'sonner'

export default function ClientesPage() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [success, setSuccess] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // 1. CARGA DE DATOS
  const fetchCustomers = useCallback(async () => {
    setFetching(true)
    try {
      const { data, error } = await supabase
        .from(DATABASE.TABLES.WS_CUSTOMERS)
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setCustomers(data || [])
    } catch (error: any) {
      toast.error("Error al cargar clientes: " + error.message)
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  // 2. FILTRADO
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.document_id?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [customers, searchTerm])

  // 3. GUARDAR O ACTUALIZAR
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Sesión expirada")

      const payload = {
        user_id: user.id,
        full_name: formData.get('fullName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        document_id: formData.get('documentId'),
        address: formData.get('address'),
        age: parseInt(formData.get('age') as string) || null,
        city: formData.get('city'),
        state: formData.get('state'),
        gender: formData.get('gender'),
        birthday: formData.get('birthday') || null, // Campo agregado
      }

      let res;
      if (selectedCustomer) {
        res = await supabase.from(DATABASE.TABLES.WS_CUSTOMERS).update(payload).eq('id', selectedCustomer.id)
      } else {
        res = await supabase.from(DATABASE.TABLES.WS_CUSTOMERS).insert([payload])
      }

      if (res.error) throw res.error

      setSuccess(true)
      toast.success(selectedCustomer ? "Expediente actualizado" : "Cliente registrado")
      await fetchCustomers()
      setTimeout(() => { 
        setSuccess(false)
        setIsPanelOpen(false) 
        setSelectedCustomer(null)
      }, 1000)
    } catch (error: any) {
      toast.error("Error: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  // 4. ELIMINAR
  const deleteCustomer = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("¿Seguro que deseas eliminar este cliente de la cartera permanente?")) return
    const { error } = await supabase.from(DATABASE.TABLES.WS_CUSTOMERS).delete().eq('id', id)
    if (!error) {
      setCustomers(customers.filter(c => c.id !== id))
      toast.success("Registro eliminado")
    }
  }

  const openEditPanel = (customer: any) => {
    setSelectedCustomer(customer)
    setIsPanelOpen(true)
  }

  return (
    <div className="space-y-8 p-4">
      <Toaster richColors position="top-center" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-4xl font-black text-black tracking-tighter italic uppercase">Cartera.</h2>
          <p className="text-black font-bold text-[10px] uppercase tracking-[0.3em] mt-1 opacity-50">Base de Datos Maestra</p>
        </div>
        <button 
          onClick={() => { setSelectedCustomer(null); setIsPanelOpen(true); }}
          className="bg-black text-white px-10 py-5 rounded-[2rem] font-black text-sm flex items-center gap-3 hover:bg-black/80 transition-all shadow-2xl active:scale-95"
        >
          <UserPlus size={20} /> NUEVO REGISTRO
        </button>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cuentas Activas</p>
          <h4 className="text-4xl font-black text-black mt-2">{customers.length}</h4>
        </div>
        <div className="bg-black p-8 rounded-[2.5rem] shadow-sm text-white">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Retención</p>
          <h4 className="text-4xl font-black mt-2">99.2%</h4>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm text-black">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Crecimiento</p>
          <h4 className="text-4xl font-black mt-2">+15%</h4>
        </div>
      </div>

      {/* BUSCADOR */}
      <div className="bg-white p-4 rounded-[2rem] border border-black/5 flex gap-4 items-center shadow-sm">
        <div className="flex-1 relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-black/40 group-focus-within:text-black" size={20} />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, email o ID fiscal..." 
            className="w-full bg-[#ece7e2]/50 text-black font-black py-4 pl-14 pr-6 rounded-2xl outline-none focus:bg-white border-2 border-transparent focus:border-black/10 transition-all placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-[3rem] border border-black/5 shadow-sm overflow-hidden min-h-[400px]">
        {fetching ? (
          <div className="flex flex-col items-center justify-center h-[400px] gap-4">
            <Loader2 className="animate-spin text-black" size={40} />
          </div>
        ) : filteredCustomers.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-black/5">
                <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-widest">Titular</th>
                <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-widest">Contacto</th>
                <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-widest">Estado/Ubicación</th>
                <th className="p-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCustomers.map((c) => (
                <tr key={c.id} onClick={() => openEditPanel(c)} className="hover:bg-[#ece7e2]/30 transition-all group cursor-pointer">
                  <td className="p-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg">
                        {c.gender === 'Moral' ? <Building2 size={20} /> : <User size={20} />}
                      </div>
                      <div>
                        <p className="font-black text-black text-base uppercase tracking-tighter">{c.full_name}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-1 tracking-widest italic">{c.document_id || 'SIN ID'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-8">
                    <div className="space-y-1">
                      <p className="text-sm font-black text-black flex items-center gap-2 text-xs uppercase"><Mail size={12} className="opacity-30" /> {c.email}</p>
                      <p className="text-sm font-black text-black flex items-center gap-2 text-xs uppercase"><Phone size={12} className="opacity-30" /> {c.phone}</p>
                    </div>
                  </td>
                  <td className="p-8 text-sm font-black text-black uppercase">{c.state || '---'}</td>
                  <td className="p-8 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => deleteCustomer(c.id, e)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                        <Trash2 size={18} />
                      </button>
                      <ChevronRight size={20} className="text-black/20" />
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

      {/* PANEL LATERAL */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPanelOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }}
              className="fixed right-0 top-0 h-screen w-full max-w-xl bg-[#ece7e2] z-50 flex flex-col shadow-2xl"
            >
              <div className="p-10 bg-white flex justify-between items-center border-b-4 border-black/5">
                <div>
                  <h3 className="text-3xl font-black text-black italic uppercase tracking-tighter">
                    {selectedCustomer ? 'Expediente Cliente' : 'Alta de Cuenta'}
                  </h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Asygurare Master CRM</p>
                </div>
                <button onClick={() => setIsPanelOpen(false)} className="p-4 hover:bg-gray-100 rounded-full text-black transition-all"><X size={32} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10">
                <form id="crm-form" onSubmit={handleSubmit} className="space-y-10">
                  
                  {/* SECCIÓN 01: PERSONAL */}
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-black uppercase tracking-widest italic">01. Datos del Titular</label>
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5 space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] text-black font-black uppercase opacity-30 text-xs">Nombre Completo o Razón Social</label>
                        <input required name="fullName" defaultValue={selectedCustomer?.full_name} className="w-full bg-[#ece7e2] text-black font-black py-5 px-6 rounded-2xl outline-none focus:ring-2 focus:ring-black text-lg uppercase" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] text-black font-black uppercase opacity-30 text-xs">Email</label>
                          <input name="email" type="email" defaultValue={selectedCustomer?.email} className="w-full bg-[#ece7e2] text-black font-black py-4 px-6 rounded-2xl outline-none text-sm uppercase" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase opacity-30 text-black text-xs">Teléfono</label>
                          <input name="phone" defaultValue={selectedCustomer?.phone} className="w-full bg-[#ece7e2] text-black font-black py-4 px-6 rounded-2xl outline-none text-sm uppercase" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN 02: DEMOGRÁFICOS Y FECHA */}
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-black uppercase tracking-widest italic">02. Perfil de Riesgo</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 space-y-2">
                        <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block text-xs">Fecha de Nacimiento</label>
                        <div className="relative">
                          <input name="birthday" type="date" defaultValue={selectedCustomer?.birthday} className="w-full bg-transparent text-xl font-black text-black outline-none uppercase" />
                        </div>
                      </div>
                      <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 space-y-2">
                        <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block text-xs">Tipo / Género</label>
                        <select name="gender" defaultValue={selectedCustomer?.gender || "Masculino"} className="w-full bg-transparent text-sm font-black text-black outline-none cursor-pointer uppercase">
                          <option value="Masculino">Física - Masculino</option>
                          <option value="Femenino">Física - Femenino</option>
                          <option value="Moral">Persona Moral</option>
                        </select>
                      </div>
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5">
                        <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block mb-2 text-xs">Edad Declarada</label>
                        <input name="age" type="number" defaultValue={selectedCustomer?.age} className="w-full bg-transparent text-4xl font-black text-black outline-none" placeholder="00" />
                    </div>
                  </div>

                  {/* SECCIÓN 03: UBICACIÓN */}
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-black uppercase tracking-widest italic">03. Localización Operativa</label>
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-black/40 uppercase text-xs">Ciudad</label>
                          <input name="city" defaultValue={selectedCustomer?.city} className="w-full bg-[#ece7e2] text-black font-black py-4 px-6 rounded-2xl outline-none text-sm uppercase" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-black/40 uppercase text-xs">Estado</label>
                          <input name="state" defaultValue={selectedCustomer?.state} className="w-full bg-[#ece7e2] text-black font-black py-4 px-6 rounded-2xl outline-none text-sm uppercase" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-black/40 uppercase text-xs">Dirección Particular / Fiscal</label>
                        <input name="address" defaultValue={selectedCustomer?.address} className="w-full bg-[#ece7e2] text-black font-black py-5 px-6 rounded-2xl outline-none text-sm uppercase" />
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN 04: FISCAL */}
                  <div className="bg-black p-10 rounded-[2.5rem] shadow-2xl">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-4 italic">Identificación Fiscal (RFC/DNI/TAX ID)</label>
                    <input name="documentId" defaultValue={selectedCustomer?.document_id} placeholder="ID-000000000" className="w-full bg-white/10 text-white font-mono text-2xl py-5 px-6 rounded-2xl outline-none border-2 border-white/10 focus:border-white/40 transition-all uppercase" />
                  </div>
                </form>
              </div>

              {/* BOTÓN ACCIÓN */}
              <div className="p-10 bg-white border-t-4 border-black/5">
                <button 
                  form="crm-form" type="submit" disabled={loading || success}
                  className={`w-full py-6 rounded-3xl font-black text-xl transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95 ${
                    success ? 'bg-green-600 text-white' : 'bg-black text-white hover:bg-black/90'
                  }`}
                >
                  {loading ? <Loader2 className="animate-spin" size={28} /> : 
                   success ? <><CheckCircle2 size={28} /> EXPEDIENTE GUARDADO</> : 
                   selectedCustomer ? <><Save size={24} /> ACTUALIZAR REGISTRO</> : "CREAR NUEVO CLIENTE"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}