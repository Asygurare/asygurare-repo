"use client"

import React, { Suspense, useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { Search, Plus, Loader2, Filter, X, Settings2, ChevronUp, ChevronDown, Settings } from 'lucide-react'
import { toast, Toaster } from 'sonner'

import { DATABASE, VIP_PREMIUM_MIN_DEFAULT } from '@/src/config'
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

function PolizasPageContent() {
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

  // --- FILTROS Y ORDEN ---
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'urgent' | 'high_value' | 'expired'>('all')
  const [sortBy, setSortBy] = useState<'expiry_date' | 'premium_desc' | 'premium_asc' | 'insurance_company' | 'customer_name'>('expiry_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // VIP configurable: prima mínima (PROFILES.vip_premium_min por usuario)
  const [vipPremiumMin, setVipPremiumMin] = useState<number>(VIP_PREMIUM_MIN_DEFAULT)
  const [showVipConfig, setShowVipConfig] = useState(false)
  const [vipConfigInput, setVipConfigInput] = useState('')

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

  // Cargar umbral VIP desde PROFILES (por usuario)
  useEffect(() => {
    let cancelled = false
    const loadVipThreshold = async () => {
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (!user?.id || cancelled) return
      const { data: profile } = await supabaseClient
        .from(DATABASE.TABLES.PROFILES)
        .select('vip_premium_min')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      const n = profile?.vip_premium_min != null ? Number(profile.vip_premium_min) : NaN
      setVipPremiumMin(Number.isFinite(n) && n >= 0 ? n : VIP_PREMIUM_MIN_DEFAULT)
    }
    loadVipThreshold()
    return () => { cancelled = true }
  }, [])

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

    // B. Filtros por tipo
    const now = new Date().getTime()
    const startOfToday = new Date().setHours(0, 0, 0, 0)
    if (filterType === 'urgent') {
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      data = data.filter(p => {
        if (!p.expiry_date) return false
        const diff = new Date(p.expiry_date).getTime() - now
        return diff > 0 && diff < thirtyDays
      })
    } else if (filterType === 'high_value') {
      data = data.filter(p => (Number(p.total_premium) || 0) >= vipPremiumMin)
    } else if (filterType === 'expired') {
      data = data.filter(p => {
        if (!p.expiry_date) return false
        return new Date(p.expiry_date).getTime() < startOfToday
      })
    }

    return data
  }, [policies, searchTerm, filterType, vipPremiumMin])

  // --- 3. ORDENAR ---
  const visiblePolicies = useMemo(() => {
    const list = [...filteredPolicies]
    const mult = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      switch (sortBy) {
        case 'expiry_date': {
          const ta = new Date(a.expiry_date || 0).getTime()
          const tb = new Date(b.expiry_date || 0).getTime()
          return mult * (ta - tb)
        }
        case 'premium_desc':
          return (Number(b.total_premium) || 0) - (Number(a.total_premium) || 0)
        case 'premium_asc':
          return (Number(a.total_premium) || 0) - (Number(b.total_premium) || 0)
        case 'insurance_company':
          return mult * (a.insurance_company ?? '').localeCompare(b.insurance_company ?? '')
        case 'customer_name':
          return mult * getFullName(a.WS_CUSTOMERS_2 || {}).localeCompare(getFullName(b.WS_CUSTOMERS_2 || {}))
        default:
          return 0
      }
    })
    return list
  }, [filteredPolicies, sortBy, sortDir])

  const toggleSort = (key: typeof sortBy) => {
    setSortBy(key)
    setSortDir((d) => (sortBy === key && d === 'desc' ? 'asc' : 'desc'))
  }

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
      payment_method: String(formData.get('payment_method') || '').trim() || null,
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

      {/* Búsqueda (entre KPIs y filtros, estilo Clientes) */}
      <div className="bg-white p-4 rounded-[2rem] border border-black/5 flex gap-4 items-center shadow-sm">
        <div className="flex-1 relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-black/40 group-focus-within:text-black" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, póliza o aseguradora..."
            className="w-full bg-[#ece7e2]/50 text-black font-black py-4 pl-14 pr-6 rounded-2xl outline-none focus:bg-white border-2 border-transparent focus:border-black/10 transition-all placeholder:text-gray-400"
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black" aria-label="Limpiar">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Filtros + Ordenar por */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all' as const, label: 'Toda la Cartera' },
            { id: 'urgent' as const, label: '⏳ Por Vencer (30d)' },
            { id: 'high_value' as const, label: '💎 Clientes VIP' },
            { id: 'expired' as const, label: '🚨 Pólizas vencidas' },
          ].map((tab) => (
            <div key={tab.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`whitespace-nowrap px-6 py-3 rounded-[1rem] text-sm font-black uppercase tracking-widest transition-all ${
                  filterType === tab.id ? 'bg-black text-white' : 'bg-white border border-black/10 text-black/60 hover:bg-black/5'
                }`}
              >
                {tab.label}
              </button>
              {tab.id === 'high_value' && (
                <button
                  type="button"
                  onClick={() => { setShowVipConfig(true); setVipConfigInput(String(vipPremiumMin)); }}
                  className="py-2 rounded-xl hover:bg-black/5 text-black/50 hover:text-black transition-colors mr-5"
                  aria-label="Configurar umbral VIP"
                  title={`VIP: prima ≥ $${vipPremiumMin.toLocaleString()} MXN`}
                >
                  <Settings size={24} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-black uppercase tracking-widest text-black/70 whitespace-nowrap">Ordenar por</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-white border-2 border-black/10 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wide text-black outline-none focus:border-black/30 min-w-[200px] cursor-pointer"
          >
            <option value="expiry_date">Fecha de vencimiento</option>
            <option value="premium_desc">Prima (mayor primero)</option>
            <option value="premium_asc">Prima (menor primero)</option>
            <option value="insurance_company">Aseguradora</option>
            <option value="customer_name">Titular</option>
          </select>
          {sortBy !== 'premium_desc' && sortBy !== 'premium_asc' && (
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              className="p-2 rounded-xl border-2 border-black/20 text-black hover:bg-black/5 transition-colors"
              aria-label={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
              title={sortDir === 'asc' ? 'Ascendente (clic para descendente)' : 'Descendente (clic para ascendente)'}
            >
              {sortDir === 'asc' ? <ChevronUp size={20} className="text-black" /> : <ChevronDown size={20} className="text-black" />}
            </button>
          )}
        </div>
      </div>

      {/* Modal: Configurar umbral VIP */}
      <AnimatePresence>
        {showVipConfig && (
          <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => setShowVipConfig(false)} aria-hidden />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="vip-config-title"
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl border border-black/5 overflow-hidden p-6"
              >
                <h3 id="vip-config-title" className="text-lg font-black text-black uppercase tracking-tight mb-2">
                  Configurar Clientes VIP
                </h3>
                <p className="text-sm text-black/60 mb-4">
                  Las pólizas cuya prima total sea mayor o igual a este monto (MXN) se consideran &quot;Clientes VIP&quot;.
                </p>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={vipConfigInput}
                  onChange={(e) => setVipConfigInput(e.target.value)}
                  className="w-full bg-[#ece7e2] text-black font-black py-4 px-4 rounded-2xl outline-none border-2 border-transparent focus:border-black/20 mb-4"
                  placeholder="Ej. 50000"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowVipConfig(false)}
                    className="flex-1 py-3 rounded-xl font-black text-sm uppercase border-2 border-black/20 text-black hover:bg-black/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const n = parseFloat(vipConfigInput)
                      if (!Number.isFinite(n) || n < 0) {
                        toast.error('Ingresa un número válido mayor o igual a 0.')
                        return
                      }
                      const { data: { user } } = await supabaseClient.auth.getUser()
                      if (!user?.id) {
                        toast.error('Sesión no válida')
                        return
                      }
                      const { error } = await supabaseClient
                        .from(DATABASE.TABLES.PROFILES)
                        .update({ vip_premium_min: n })
                        .eq('id', user.id)
                      if (error) {
                        toast.error('No se pudo guardar: ' + error.message)
                        return
                      }
                      setVipPremiumMin(n)
                      setShowVipConfig(false)
                      toast.success(`Umbral VIP actualizado: $${n.toLocaleString()} MXN`)
                    }}
                    className="flex-1 py-3 rounded-xl font-black text-sm uppercase bg-black text-white hover:bg-black/90"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* GRID RESULTADOS */}
      {loading ? (
        <div className="h-96 flex flex-col justify-center items-center gap-4 text-gray-300 animate-pulse">
            <Loader2 className="animate-spin text-black" size={40} />
            <p className="text-xs font-bold uppercase tracking-widest">Sincronizando Pólizas...</p>
        </div>
      ) : visiblePolicies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-20">
          <AnimatePresence mode="popLayout">
            {visiblePolicies.map((policy) => (
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
          <p className="font-black uppercase tracking-widest text-sm text-gray-400">
            {filteredPolicies.length === 0 && policies.length > 0 ? 'No hay pólizas con este filtro' : 'No se encontraron pólizas'}
          </p>
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

export default function PolizasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-black/40" />
        </div>
      }
    >
      <PolizasPageContent />
    </Suspense>
  )
}