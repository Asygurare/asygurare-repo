"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { Search, Plus, Loader2, RefreshCw, Filter, X } from 'lucide-react'
import { toast, Toaster } from 'sonner'

// Configuración y Cliente
import { DATABASE } from '@/src/config'
import { supabaseClient } from '@/src/lib/supabase/client'
import { getFullName } from '@/src/lib/utils/utils'

// --- TIPOS CENTRALIZADOS (CORRECCIÓN AQUÍ) ---
// Importamos todo desde tu archivo de tipos
import type { 
  PolicyWithCustomer, 
  PolicyFormData, 
  Customer 
} from '@/src/types/policy'

// Componentes
import { PolicyCard } from '@/src/components/workspace/polizas/PolicyCard'
import { PolicyStats } from '@/src/components/workspace/polizas/PolicyStats'
import { PolicyCaptureModal } from '@/src/components/workspace/polizas/PolicyCaptureModal'
import { RefreshButton } from '@/src/components/workspace/RefreshButton' 
// Nota: Ya no importamos CustomerOption de aquí

export default function PolizasPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // --- ESTADOS DE UI ---
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  /** Cliente preseleccionado al llegar desde /clientes o /prospectos (query customerId) */
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<string | null>(null)

  // --- ESTADOS DE DATOS ---
  const [policies, setPolicies] = useState<PolicyWithCustomer[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyFormData | null>(null)

  // --- FILTROS ---
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'urgent' | 'high_value'>('all')

  // --- 1. CARGA DE DATOS (FETCH) ---
  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    else setRefreshing(true)

    try {
      // A. Cargar Pólizas
      const policiesReq = supabaseClient
        .from(DATABASE.TABLES.WS_POLICIES)
        .select('*, WS_CUSTOMERS_2(name, last_name, email)')
        .order('expiry_date', { ascending: true })

      // B. Cargar Clientes
      const customersReq = supabaseClient
        .from(DATABASE.TABLES.WS_CUSTOMERS_2)
        .select('id, name, last_name, email')
        .order('name', { ascending: true })

      const [policiesRes, customersRes] = await Promise.all([policiesReq, customersReq])

      if (policiesRes.error) throw policiesRes.error
      if (customersRes.error) throw customersRes.error

      setPolicies(policiesRes.data as unknown as PolicyWithCustomer[])

      // Customer ya tiene name, last_name; getFullName() se usa en el modal
      const formattedCustomers: Customer[] = (customersRes.data || []).map((c: any) => ({
        id: c.id,
        name: c.name ?? null,
        last_name: c.last_name ?? null,
        email: c.email ?? null,
      }))
      setCustomers(formattedCustomers)

    } catch (error: any) {
      console.error(error)
      toast.error("Error al sincronizar datos: " + error.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Si llegamos con ?customerId=, refrescar datos para tener al cliente recién creado
  useEffect(() => {
    const id = searchParams.get('customerId')
    if (id) fetchData(true)
  }, [searchParams, fetchData])

  // Abrir modal con cliente preseleccionado cuando ya está en la lista
  useEffect(() => {
    const id = searchParams.get('customerId')
    if (!id || loading) return
    const found = customers.some((c) => c.id === id)
    if (found) {
      setPreselectedCustomerId(id)
      setIsModalOpen(true)
      router.replace('/polizas', { scroll: false })
    }
  }, [searchParams, customers, loading, router])

  // --- 2. LÓGICA DE FILTRADO ---
  const filteredPolicies = useMemo(() => {
    let data = policies

    // A. Búsqueda
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      data = data.filter(p =>
        p.policy_number?.toLowerCase().includes(lower) ||
        getFullName(p.WS_CUSTOMERS_2 || {}).toLowerCase().includes(lower) ||
        p.insurance_company?.toLowerCase().includes(lower)
      )
    }

    // B. Filtros Rápidos
    if (filterType === 'urgent') {
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      const now = new Date().getTime()
      data = data.filter(p => {
        if (!p.expiry_date) return false
        const diff = new Date(p.expiry_date).getTime() - now
        return diff > 0 && diff < thirtyDays
      })
    } else if (filterType === 'high_value') {
      data = data.filter(p => (p.total_premium > 50000) || ['GMM', 'Vida'].includes(p.category))
    }

    return data
  }, [policies, searchTerm, filterType])

  // --- 3. HANDLERS ---
  const handleCreate = () => {
    setSelectedPolicy(null)
    setIsModalOpen(true)
  }

  const handleEdit = (policy: PolicyWithCustomer) => {
    const formPolicy: PolicyFormData = {
      id: policy.id,
      customer_id: policy.customer_id,
      policy_number: policy.policy_number,
      insurance_company: policy.insurance_company,
      category: policy.category,
      effective_date: policy.effective_date,
      expiry_date: policy.expiry_date,
      total_premium: policy.total_premium,
      frecuencia_pago: policy.frecuencia_pago,
    }
    setSelectedPolicy(formPolicy)
    setIsModalOpen(true)
  }

  const handleModalSuccess = () => {
    fetchData(true)
    setIsModalOpen(false)
    setSelectedPolicy(null)
    setPreselectedCustomerId(null)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setPreselectedCustomerId(null)
  }

  // Submit en la página (como clientes/prospectos): usamos selectedPolicy del estado para update vs insert
  const handlePolicySubmit = useCallback(async (formData: FormData) => {
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Sesión no válida')

    const premiumRaw = parseFloat(String(formData.get('premium') || 0))
    const total_premium = Math.max(0, Number.isNaN(premiumRaw) ? 0 : premiumRaw)
    const payload = {
      user_id: user.id,
      customer_id: formData.get('customerId'),
      policy_number: formData.get('policyNumber'),
      insurance_company: formData.get('company'),
      category: formData.get('category'),
      effective_date: formData.get('effectiveDate'),
      expiry_date: formData.get('expiryDate'),
      total_premium,
      frecuencia_pago: formData.get('frecuencia_pago'),
      metodo_pago: String(formData.get('metodo_pago') || '').trim() || null,
      start_date: formData.get('effectiveDate'),
    }

    if (selectedPolicy?.id) {
      console.log('selectedPolicy', selectedPolicy)
      const { error } = await supabaseClient
        .from(DATABASE.TABLES.WS_POLICIES)
        .update(payload)
        .eq('id', selectedPolicy.id)
      if (error) throw error
      toast.success('Contrato actualizado')
    } else {
      const { error } = await supabaseClient
        .from(DATABASE.TABLES.WS_POLICIES)
        .insert([{ ...payload, status: 'activa' }])
      if (error) throw error
      toast.success('Póliza emitida y pagos generados')
    }
  }, [selectedPolicy])

  // --- RENDER ---
  return (
    <div className="space-y-8 p-4 md:p-8 max-w-[1800px] mx-auto animate-in fade-in duration-500 min-h-screen">
      <Toaster richColors position="top-right" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-4 border-b border-gray-200/50">
        <div>
           <div className="flex items-center gap-3">
             <h2 className="text-4xl font-black text-black tracking-tighter italic uppercase">Gestión de Cartera.</h2>
           </div>
           <p className="text-gray-400 font-bold text-[10px] uppercase tracking-[0.3em] mt-1 ml-1">
             Risk Intelligence Dashboard
           </p>
        </div>
        <div className="flex items-center gap-4">
          <RefreshButton onRefresh={() => fetchData(true)} refreshing={refreshing} />
          <button 
            onClick={handleCreate}
            className="bg-black text-white px-8 py-4 rounded-full font-bold text-xs flex items-center gap-3 hover:bg-[#333] transition-all shadow-xl hover:shadow-2xl active:scale-95 group"
          >
          <div className="bg-white/20 p-1 rounded-full group-hover:rotate-90 transition-transform">
            <Plus size={14} />
          </div>
          NUEVA OPORTUNIDAD
          </button>
        </div>
      </div>

      {/* KPIs */}
      <PolicyStats policies={policies} />

      {/* TOOLBAR */}
      <div className="sticky top-2 z-30 flex flex-col md:flex-row gap-4 items-center justify-between bg-[#fbfbfb]/80 backdrop-blur-xl p-2 rounded-full border border-white/50 shadow-sm transition-all">
        <div className="flex bg-white p-1 rounded-full border border-gray-200 shadow-sm overflow-x-auto max-w-full no-scrollbar">
          {[
            { id: 'all', label: 'Toda la Cartera' },
            { id: 'urgent', label: '🚨 Por Vencer (30d)' },
            { id: 'high_value', label: '💎 Clientes VIP' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`whitespace-nowrap px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                filterType === tab.id 
                  ? 'bg-black text-white shadow-md' 
                  : 'text-gray-400 hover:text-black hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-96 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors" size={18} />
            <input 
                type="text"
                placeholder="BUSCAR (NOMBRE, POLIZA, RAMO)..."
                value={searchTerm}
                className="w-full bg-white py-4 pl-12 pr-6 rounded-full font-bold text-xs outline-none border border-gray-200 focus:border-black transition-all uppercase placeholder:text-gray-300 shadow-sm focus:shadow-md"
                onChange={(e) => setSearchTerm(e.target.value)}
            />
             {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-black">
                <X size={18} />
              </button>
            )}
        </div>
      </div>

      {/* GRID RESULTADOS */}
      {loading ? (
        <div className="h-96 flex flex-col justify-center items-center gap-4 text-gray-300 animate-pulse">
            <Loader2 className="animate-spin text-black" size={40} />
            <p className="text-xs font-bold uppercase tracking-widest">Sincronizando Pólizas...</p>
        </div>
      ) : filteredPolicies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-20">
          <AnimatePresence mode='popLayout'>
            {filteredPolicies.map((policy) => (
              <PolicyCard 
                key={policy.id} 
                policy={policy} 
                onClick={() => handleEdit(policy)} 
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 opacity-60 border-2 border-dashed border-gray-200 rounded-[3rem] bg-gray-50/50">
          <div className="bg-gray-200 p-4 rounded-full mb-4">
             <Filter className="text-gray-400" size={32} />
          </div>
          <p className="font-black uppercase tracking-widest text-sm text-gray-400">No se encontraron pólizas</p>
          <button onClick={handleCreate} className="mt-6 text-xs font-bold bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors">
            Crear primer registro
          </button>
        </div>
      )}
      
      {/* MODAL: submit lo maneja la página (selectedPolicy del estado) como en clientes/prospectos */}
      <PolicyCaptureModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        customers={customers}
        selectedPolicy={selectedPolicy}
        preselectedCustomer={preselectedCustomerId ? customers.find((c) => c.id === preselectedCustomerId) ?? null : null}
        onSubmit={handlePolicySubmit}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}