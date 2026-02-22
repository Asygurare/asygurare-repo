"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Currency, CustomerStatus, DATABASE, EducationLevel, Gender, InsuranceType, MaritalStatus, OriginSource } from '@/src/config'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Search, X, UserPlus, Mail, Phone, Loader2, CheckCircle2,
  Building2, User, Trash2, Save, Calendar, MoreVertical, FileText, StickyNote,
  Edit3, ChevronRight, ChevronUp, ChevronDown, FileCheck
} from 'lucide-react'
import { supabaseClient } from '@/src/lib/supabase/client'
import { toast, Toaster } from 'sonner'
import { getFullName, calculateAge } from '@/src/lib/utils/utils'
import { SelectWithOther } from '@/src/components/ui/SelectWithOther'

const INSURANCE_TYPES = Object.values(InsuranceType)
const ORIGIN_SOURCES = Object.values(OriginSource)
const MARITAL_STATUSES = Object.values(MaritalStatus)
const GENDERS = Object.values(Gender)
const CUSTOMER_STATUSES = Object.values(CustomerStatus)
const EDUCATION_LEVELS = Object.values(EducationLevel)
const CURRENCIES = Object.values(Currency)

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
  const [formBirthday, setFormBirthday] = useState('')
  const [formAge, setFormAge] = useState('')
  const [formDirty, setFormDirty] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [clientInterestsList, setClientInterestsList] = useState<string[]>([])
  const [clientInterestInput, setClientInterestInput] = useState('')
  const [editingInterestIndex, setEditingInterestIndex] = useState<number | null>(null)
  const [editingInterestDraft, setEditingInterestDraft] = useState('')
  const [additionalLoading, setAdditionalLoading] = useState(false)
  const [additionalForm, setAdditionalForm] = useState({
    contact_date: '',
    economic_dependents: '',
    education_level: '',
    sector: '',
    monthly_income_estimated: '',
    currency: '',
    financial_goals: '',
    country: '',
    state: '',
    city: '',
    postal_code: '',
    address: '',
  })
  const [hasChildren, setHasChildren] = useState<'yes' | 'no' | ''>('')
  const [children, setChildren] = useState<Array<{ name: string; age: string; contact: string }>>([])
  const [activeTab, setActiveTab] = useState<'activos' | 'descartados'>('activos')
  const [includeDiscarded, setIncludeDiscarded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('__all__')
  const [sortKey, setSortKey] = useState<'name' | 'contact' | 'status' | 'insurance_type' | 'added_at'>('added_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [postCreateCustomerId, setPostCreateCustomerId] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

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

  // Al llegar con ?openId= (ej. desde prospectos), refrescar lista para tener el cliente recién convertido
  useEffect(() => {
    const openId = searchParams.get('openId')
    if (openId) fetchCustomers()
  }, [searchParams, fetchCustomers])

  // Abrir expediente cuando se llega con ?openId= y ya está el cliente en la lista
  useEffect(() => {
    const openId = searchParams.get('openId')
    if (!openId || fetching || !customers.length) return
    const customer = customers.find((c) => c.id === openId)
    if (customer) {
      setSelectedCustomer(customer)
      setIsModalOpen(true)
      router.replace('/clientes', { scroll: false })
    }
  }, [searchParams, customers, fetching, router])

  useEffect(() => {
    if (!optionsRowId) return
    const handleClick = (e: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) setOptionsRowId(null)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [optionsRowId])

  // Sincronizar fecha de nacimiento y edad al abrir el modal (edad editable solo si no hay birthday)
  useEffect(() => {
    if (isModalOpen) {
      const b = selectedCustomer?.birthday ?? ''
      setFormBirthday(b)
      const age =
        selectedCustomer?.age != null
          ? String(selectedCustomer.age)
          : b
            ? String(calculateAge(b) ?? '')
            : ''
      setFormAge(age)
    }
  }, [isModalOpen, selectedCustomer?.id, selectedCustomer?.birthday, selectedCustomer?.age])

  useEffect(() => {
    if (isModalOpen) {
      const raw = String(selectedCustomer?.client_interests ?? '').trim()
      setClientInterestsList(raw ? raw.split(/\n/).map((s) => s.trim()).filter(Boolean) : [])
      setClientInterestInput('')
      setEditingInterestIndex(null)
      setEditingInterestDraft('')
    } else {
      setClientInterestsList([])
      setClientInterestInput('')
    }
  }, [isModalOpen, selectedCustomer?.id, selectedCustomer?.client_interests])

  useEffect(() => {
    if (isModalOpen) setFormDirty(false)
  }, [isModalOpen])

  useEffect(() => {
    if (!isModalOpen) return
    setAdditionalLoading(true)
    const extra = selectedCustomer?.additional_fields && typeof selectedCustomer.additional_fields === 'object'
      ? selectedCustomer.additional_fields
      : {}
    setHasChildren(extra?.has_children === 'yes' ? 'yes' : extra?.has_children === 'no' ? 'no' : '')
    const rawChildren = Array.isArray(extra?.children) ? extra.children : []
    setChildren(rawChildren.map((c: any) => ({
      name: String(c?.name ?? ''),
      age: String(c?.age ?? ''),
      contact: String(c?.contact ?? ''),
    })))
    setAdditionalForm({
      contact_date: extra?.contact_date != null ? String(extra.contact_date) : '',
      economic_dependents: extra?.economic_dependents != null ? String(extra.economic_dependents) : '',
      education_level: String(extra?.education_level ?? ''),
      sector: String(extra?.sector ?? ''),
      monthly_income_estimated: extra?.monthly_income_estimated != null ? String(extra.monthly_income_estimated) : '',
      currency: String(extra?.currency ?? ''),
      financial_goals: String(extra?.financial_goals ?? ''),
      country: String(selectedCustomer?.country ?? extra?.country ?? ''),
      state: String(selectedCustomer?.state ?? extra?.state ?? ''),
      city: String(selectedCustomer?.city ?? extra?.city ?? ''),
      postal_code: String(selectedCustomer?.postal_code ?? extra?.postal_code ?? ''),
      address: String(selectedCustomer?.address ?? extra?.address ?? ''),
    })
    setAdditionalLoading(false)
  }, [isModalOpen, selectedCustomer?.id, selectedCustomer?.additional_fields, selectedCustomer?.country, selectedCustomer?.state, selectedCustomer?.city, selectedCustomer?.postal_code, selectedCustomer?.address])

  useEffect(() => {
    if (hasChildren !== 'yes') setChildren([])
  }, [hasChildren])

  const filteredBySearch = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return customers.filter(
      (c) =>
        getFullName(c).toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term)
    )
  }, [customers, searchTerm])

  const normalizedStatus = (c: any) => String(c?.status ?? '').trim()
  const activeCustomers = useMemo(
    () => filteredBySearch.filter((c) => normalizedStatus(c) !== CustomerStatus.Descartado),
    [filteredBySearch]
  )
  const discardedCustomers = useMemo(
    () => filteredBySearch.filter((c) => normalizedStatus(c) === CustomerStatus.Descartado),
    [filteredBySearch]
  )

  const baseListForFilter = useMemo(() => {
    if (activeTab === 'descartados') return discardedCustomers
    if (includeDiscarded) return [...activeCustomers, ...discardedCustomers]
    return activeCustomers
  }, [activeTab, includeDiscarded, activeCustomers, discardedCustomers])

  const filteredCustomers = useMemo(() => {
    if (statusFilter === '__all__') return baseListForFilter
    return baseListForFilter.filter((c) => normalizedStatus(c) === statusFilter)
  }, [baseListForFilter, statusFilter])

  const getCustomerAddedAt = (c: any) => {
    const extra = c?.additional_fields && typeof c.additional_fields === 'object' ? c.additional_fields : {}
    const converted = extra?.converted_at
    if (converted) return converted
    return c?.created_at ?? ''
  }

  const visibleCustomers = useMemo(() => {
    const list = [...filteredCustomers]
    const mult = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      switch (sortKey) {
        case 'name':
          va = getFullName(a).toLowerCase()
          vb = getFullName(b).toLowerCase()
          return mult * (va < vb ? -1 : va > vb ? 1 : 0)
        case 'contact':
          va = (a.email ?? a.phone ?? '').toString().toLowerCase()
          vb = (b.email ?? b.phone ?? '').toString().toLowerCase()
          return mult * (va < vb ? -1 : va > vb ? 1 : 0)
        case 'status':
          va = normalizedStatus(a)
          vb = normalizedStatus(b)
          return mult * va.localeCompare(vb)
        case 'insurance_type':
          va = (a.insurance_type ?? '').toLowerCase()
          vb = (b.insurance_type ?? '').toLowerCase()
          return mult * (va < vb ? -1 : va > vb ? 1 : 0)
        case 'added_at':
        default:
          va = getCustomerAddedAt(a) || ''
          vb = getCustomerAddedAt(b) || ''
          return mult * (String(va).localeCompare(String(vb)))
      }
    })
    return list
  }, [filteredCustomers, sortKey, sortDir])

  const getRowBorderClass = (c: any) => {
    const s = normalizedStatus(c)
    if (s === CustomerStatus.Descartado) return 'border-l-4 border-red-500'
    if (s === CustomerStatus.EnRenovacion) return 'border-l-4 border-orange-500'
    return ''
  }

  const toggleSort = (key: typeof sortKey) => {
    setSortKey(key)
    setSortDir((d) => (sortKey === key && d === 'desc' ? 'asc' : 'desc'))
  }

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
      let age = ageRaw ? (Number.isFinite(parseInt(ageRaw, 10)) ? parseInt(ageRaw, 10) : null) : null
      if (age == null && birthday) age = calculateAge(birthday) ?? null

      const clientInterests =
        clientInterestsList.length > 0
          ? clientInterestsList.map((s) => s.trim()).filter(Boolean).join('\n').trim() || null
          : null

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
      const childrenList = (hasChildren === 'yes' ? children : []).filter((c) => c.name || c.age || c.contact)
      const additionalPayload: Record<string, unknown> = {
        contact_date: additionalForm.contact_date.trim() || null,
        has_children: hasChildren || null,
        economic_dependents: toIntOrNull(additionalForm.economic_dependents),
        education_level: additionalForm.education_level.trim() || null,
        sector: additionalForm.sector.trim() || null,
        monthly_income_estimated: toFloatOrNull(additionalForm.monthly_income_estimated),
        currency: additionalForm.currency.trim() || null,
        financial_goals: additionalForm.financial_goals.trim() || null,
        children: childrenList.length ? childrenList : null,
      }
      Object.keys(additionalPayload).forEach((k) => {
        const v = additionalPayload[k]
        if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0))
          delete additionalPayload[k]
      })
      const additional_fields = Object.keys(additionalPayload).length > 0 ? additionalPayload : null

      const payload = {
        user_id: user.id,
        name,
        last_name: String(formData.get('last_name') || '').trim() || null,
        status: String(formData.get('status') || '').trim() || CustomerStatus.Activo,
        source: String(formData.get('source') || '').trim() || null,
        insurance_type: String(formData.get('insurance_type') || '').trim() || null,
        estimated_value: selectedCustomer?.estimated_value ?? null,
        email: String(formData.get('email') || '').trim() || null,
        phone: String(formData.get('phone') || '').trim() || null,
        birthday,
        age,
        smoking: parseTriBool(formData.get('smoking')),
        drinking: parseTriBool(formData.get('drinking')),
        marital_status: String(formData.get('marital_status') || '').trim() || null,
        ocupation: String(formData.get('ocupation') || '').trim() || null,
        gender: String(formData.get('gender') || '').trim() || null,
        client_interests: clientInterests,
        notes: String(formData.get('notes') || '').trim() || null,
        country: additionalForm.country.trim() || null,
        state: additionalForm.state.trim() || null,
        city: additionalForm.city.trim() || null,
        postal_code: additionalForm.postal_code.trim() || null,
        address: additionalForm.address.trim() || null,
        additional_fields,
        updated_at: new Date().toISOString(),
      }

      if (selectedCustomer) {
        const { error } = await supabaseClient
          .from(DATABASE.TABLES.WS_CUSTOMERS_2)
          .update(payload)
          .eq('id', selectedCustomer.id)
        if (error) throw error
        setFormDirty(false)
        toast.success('Expediente actualizado')
      } else {
        const { data: inserted, error } = await supabaseClient
          .from(DATABASE.TABLES.WS_CUSTOMERS_2)
          .insert([payload])
          .select('id')
          .single()
        if (error) throw error
        toast.success('Cliente registrado')
        await fetchCustomers()
        setIsModalOpen(false)
        setSelectedCustomer(null)
        if (inserted?.id) setPostCreateCustomerId(inserted.id)
        setLoading(false)
        return
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
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Clientes activos</p>
          <h4 className="text-4xl font-black text-black mt-2">{activeCustomers.length}</h4>
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="bg-white p-2 rounded-[1.5rem] inline-flex items-center gap-2 border border-black/5 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('activos')}
            className={`px-6 py-3 rounded-[1rem] text-sm font-black uppercase tracking-widest transition-all ${
              activeTab === 'activos' ? 'bg-black text-white' : 'text-black/60 hover:bg-black/5'
            }`}
          >
            Clientes activos ({activeCustomers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('descartados')}
            className={`px-6 py-3 rounded-[1rem] text-sm font-black uppercase tracking-widest transition-all ${
              activeTab === 'descartados' ? 'bg-red-600 text-white' : 'text-black/60 hover:bg-black/5'
            }`}
          >
            Descartados ({discardedCustomers.length})
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {activeTab === 'activos' && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-black uppercase tracking-widest text-black/70 whitespace-nowrap">Incluir descartados</span>
              <button
                type="button"
                role="switch"
                aria-checked={includeDiscarded}
                onClick={() => setIncludeDiscarded((v) => !v)}
                className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 transition-colors focus:outline-none ${
                  includeDiscarded ? 'bg-black border-black' : 'bg-black/10 border-black/20'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                    includeDiscarded ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                  style={{ marginTop: 2 }}
                />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-sm font-black uppercase tracking-widest text-black/70 whitespace-nowrap">Estatus</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border-2 border-black/10 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wide text-black outline-none focus:border-black/30 min-w-[180px] cursor-pointer"
            >
              <option value="__all__">Todos los estatus</option>
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-black/5 shadow-sm overflow-hidden min-h-[400px] min-w-0">
        {fetching ? (
          <div className="flex flex-col items-center justify-center h-[400px] gap-4">
            <Loader2 className="animate-spin text-black" size={40} />
          </div>
        ) : visibleCustomers.length > 0 ? (
          <>
            <div className="md:hidden divide-y divide-gray-50">
              {visibleCustomers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openEdit(c)}
                  className={`w-full text-left p-4 active:bg-[#ece7e2]/40 transition-all ${getRowBorderClass(c)}`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center shadow-lg shrink-0">
                      {c.gender === 'Moral' ? <Building2 size={18} /> : <User size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-black text-sm uppercase tracking-tight truncate">{getFullName(c)}</p>
                      <p className="mt-1 text-[11px] font-bold text-black/60 truncate">{c.email || '—'}</p>
                      <p className="text-[11px] font-bold text-black/60 truncate">{c.phone || '—'}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/40">{normalizedStatus(c) || '—'}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/40">{c.insurance_type || '—'}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/40">{formatDate(getCustomerAddedAt(c))}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[800px] text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-black/5">
                    <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-widest">
                      <button type="button" onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-black">
                        Nombre completo
                        {sortKey === 'name' ? (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
                      </button>
                    </th>
                    <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-widest">
                      <button type="button" onClick={() => toggleSort('contact')} className="flex items-center gap-1 hover:text-black">
                        Contacto
                        {sortKey === 'contact' ? (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
                      </button>
                    </th>
                    <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-widest">
                      <button type="button" onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-black">
                        Estatus
                        {sortKey === 'status' ? (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
                      </button>
                    </th>
                    <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-widest">
                      <button type="button" onClick={() => toggleSort('insurance_type')} className="flex items-center gap-1 hover:text-black">
                        Tipo de seguro
                        {sortKey === 'insurance_type' ? (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
                      </button>
                    </th>
                    <th className="p-8 text-[10px] font-black text-black/40 uppercase tracking-widest">
                      <button type="button" onClick={() => toggleSort('added_at')} className="flex items-center gap-1 hover:text-black">
                        Se agregó
                        {sortKey === 'added_at' ? (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
                      </button>
                    </th>
                    <th className="p-8 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visibleCustomers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => openEdit(c)}
                      className={`hover:bg-[#ece7e2]/30 transition-all group cursor-pointer ${getRowBorderClass(c)}`}
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
                      <td className="p-8 text-sm font-black text-black uppercase">{normalizedStatus(c) || '—'}</td>
                      <td className="p-8 text-sm font-black text-black uppercase">{c.insurance_type || '—'}</td>
                      <td className="p-8 text-sm font-black text-black uppercase">{formatDate(getCustomerAddedAt(c))}</td>
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
                                className="w-full px-4 py-3 text-left text-sm font-black uppercase tracking-tighter flex items-center gap-2 text-gray-600 hover:bg-[#ece7e2]/50 transition-colors"
                              >
                                <FileText size={18} /> Ver toda la información
                              </button>
                              <button
                                onClick={() => {
                                  setNotesCustomer(c)
                                  setOptionsRowId(null)
                                }}
                                className="w-full px-4 py-3 text-left text-sm font-black uppercase tracking-tighter flex items-center gap-2 text-gray-600 hover:bg-[#ece7e2]/50 transition-colors"
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
            </div>
          </>
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
                className="w-full max-w-7xl bg-[#ece7e2] shadow-2xl rounded-[2.5rem] overflow-hidden border border-white/20"
              >
                <div className="p-8 bg-white flex flex-wrap justify-between items-center gap-4 border-b-2 border-black/5 shadow-sm">
                  <div>
                    <h3 className="text-3xl font-black italic text-black uppercase tracking-tighter">
                      {selectedCustomer ? 'Expediente Cliente' : 'Alta de Cuenta'}
                    </h3>
                    <p className="text-[11px] font-bold text-black/50 uppercase tracking-widest mt-1">Asygurare</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedCustomer && (
                      <button
                        type="button"
                        disabled={!formDirty || loading}
                        onClick={() => formRef.current?.requestSubmit()}
                        className="px-5 py-3 rounded-2xl bg-black text-white font-black text-sm uppercase tracking-wide shadow-md hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Guardar cambios'}
                      </button>
                    )}
                    <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-full text-black transition-all" aria-label="Cerrar">
                      <X size={32} />
                    </button>
                  </div>
                </div>

                <form ref={formRef} onSubmit={handleSubmit} onChange={() => setFormDirty(true)} className="max-h-[80vh] overflow-y-auto p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Nombre</label>
                          <input name="name" required defaultValue={selectedCustomer?.name ?? selectedCustomer?.full_name ?? ''} placeholder="Ej. Alejandro" className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none border-2 border-transparent focus:border-black/20" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Apellido</label>
                          <input name="last_name" defaultValue={selectedCustomer?.last_name ?? ''} placeholder="Ej. Smith" className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none border-2 border-transparent focus:border-black/20" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Email</label>
                        <input name="email" type="email" defaultValue={selectedCustomer?.email ?? ''} placeholder="correo@ejemplo.com" className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Teléfono</label>
                        <input name="phone" defaultValue={selectedCustomer?.phone ?? ''} placeholder="+52..." className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none" />
                      </div>
                      <div className="bg-[#ece7e2] p-6 rounded-[2rem] border border-black/5 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-[12px] font-black uppercase text-black italic">Ubicación</p>
                          <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest">Opcional</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase text-black/60 italic">País</label>
                            <input value={additionalForm.country} onChange={(e) => setAdditionalForm((p) => ({ ...p, country: e.target.value }))} placeholder="Ej. México" className="w-full bg-white p-4 rounded-2xl font-black text-black text-base outline-none" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase text-black/60 italic">Ciudad</label>
                            <input value={additionalForm.city} onChange={(e) => setAdditionalForm((p) => ({ ...p, city: e.target.value }))} placeholder="Ej. Guadalajara" className="w-full bg-white p-4 rounded-2xl font-black text-black text-base outline-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase text-black/60 italic">Estado</label>
                            <input value={additionalForm.state} onChange={(e) => setAdditionalForm((p) => ({ ...p, state: e.target.value }))} placeholder="Ej. Jalisco" className="w-full bg-white p-4 rounded-2xl font-black text-black text-base outline-none" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] font-black uppercase text-black/60 italic">Código postal</label>
                            <input value={additionalForm.postal_code} onChange={(e) => setAdditionalForm((p) => ({ ...p, postal_code: e.target.value }))} placeholder="Ej. 44100" className="w-full bg-white p-4 rounded-2xl font-black text-black text-base outline-none" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-black uppercase text-black/60 italic">Dirección</label>
                          <input value={additionalForm.address} onChange={(e) => setAdditionalForm((p) => ({ ...p, address: e.target.value }))} placeholder="Calle, número, colonia…" className="w-full bg-white p-4 rounded-2xl font-black text-black text-base outline-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Origen</label>
                          <SelectWithOther name="source" options={ORIGIN_SOURCES} defaultValue={selectedCustomer?.source ?? ''} emptyOption="Selecciona..." otherOptionValue="Personalizado" className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Estatus</label>
                          <SelectWithOther name="status" options={CUSTOMER_STATUSES} defaultValue={selectedCustomer?.status ?? CustomerStatus.Activo} className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-black uppercase text-black italic">Ocupación</label>
                        <input name="ocupation" defaultValue={selectedCustomer?.ocupation ?? ''} placeholder="Ej. Contador/a" className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none" />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[12px] font-black uppercase text-black italic">Fecha de nacimiento</label>
                            <input name="birthday" type="date" value={formBirthday} onChange={(e) => { const v = e.target.value; setFormBirthday(v); setFormAge(v ? String(calculateAge(v) ?? '') : ''); }} className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[12px] font-black uppercase text-black italic">Edad</label>
                            <input name="age" type="number" min={0} max={120} value={formAge} onChange={(e) => setFormAge(e.target.value)} readOnly={!!formBirthday} placeholder={formBirthday ? '' : 'Editable si no hay fecha'} className={`w-full p-5 rounded-2xl font-black text-black text-lg outline-none ${formBirthday ? 'bg-gray-100 cursor-not-allowed' : 'bg-[#ece7e2]'}`} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[12px] font-black uppercase text-black italic">Género</label>
                            <SelectWithOther name="gender" options={GENDERS} defaultValue={selectedCustomer?.gender ?? ''} emptyOption="Sin especificar" className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[12px] font-black uppercase text-black italic">Estado civil</label>
                            <SelectWithOther name="marital_status" options={MARITAL_STATUSES} defaultValue={selectedCustomer?.marital_status ?? ''} emptyOption="Sin especificar" className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Tipo de seguro</label>
                          <SelectWithOther name="insurance_type" options={INSURANCE_TYPES} defaultValue={selectedCustomer?.insurance_type ?? ''} emptyOption="Selecciona..." className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[12px] font-black uppercase text-black italic">Fuma</label>
                            <select name="smoking" defaultValue={selectedCustomer?.smoking === true ? 'yes' : selectedCustomer?.smoking === false ? 'no' : ''} className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer">
                              <option value="">Sin especificar</option>
                              <option value="no">No</option>
                              <option value="yes">Sí</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[12px] font-black uppercase text-black italic">Toma</label>
                            <select name="drinking" defaultValue={selectedCustomer?.drinking === true ? 'yes' : selectedCustomer?.drinking === false ? 'no' : ''} className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer">
                              <option value="">Sin especificar</option>
                              <option value="no">No</option>
                              <option value="yes">Sí</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Notas / Bitácora</label>
                          <textarea name="notes" defaultValue={selectedCustomer?.notes ?? ''} rows={4} placeholder="Acuerdos, próximos pasos..." className="w-full bg-[#ece7e2] p-6 rounded-2xl font-black text-black text-base outline-none resize-none" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border-2 border-black/10 space-y-4">
                    <div>
                      <label className="text-[12px] font-black uppercase text-black italic">Intereses del cliente</label>
                      <p className="text-[11px] text-black/60 mt-1.5 max-w-xl">
                        Estos datos ayudan a nuestro asistente de IA a personalizar la conversación. Escribe enunciados o párrafos y agrégalos con Enter o el botón.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input type="text" value={clientInterestInput} onChange={(e) => setClientInterestInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = clientInterestInput.trim(); if (v) { setClientInterestsList((prev) => [...prev, v]); setClientInterestInput(''); } } }} placeholder="Escribe un interés y presiona Enter para agregar" className="flex-1 bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-base outline-none placeholder:text-black/30 border-2 border-transparent focus:border-black/20" />
                        <button type="button" onClick={() => { const v = clientInterestInput.trim(); if (v) { setClientInterestsList((prev) => [...prev, v]); setClientInterestInput(''); } }} className="px-6 py-5 rounded-2xl bg-black text-white font-black text-sm uppercase tracking-wide hover:opacity-95 transition-opacity shrink-0">Agregar</button>
                      </div>
                      {clientInterestsList.length > 0 && (
                        <ul className="list-disc list-outside space-y-3 mt-4 pl-6 text-black font-bold text-sm [list-style-type:disc]">
                          {clientInterestsList.map((item, i) => (
                            <li key={`${i}-${item.slice(0, 30)}`} className="pl-1">
                              {editingInterestIndex === i ? (
                                <div className="flex flex-col gap-2">
                                  <textarea value={editingInterestDraft} onChange={(e) => setEditingInterestDraft(e.target.value)} rows={4} className="w-full bg-[#ece7e2] p-4 rounded-xl font-black text-black text-sm outline-none resize-y border-2 border-black/20" placeholder="Edita el enunciado..." />
                                  <div className="flex gap-2">
                                    <button type="button" onClick={() => { const v = editingInterestDraft.trim(); if (v) setClientInterestsList((prev) => prev.map((s, j) => (j === i ? v : s))); else setClientInterestsList((prev) => prev.filter((_, j) => j !== i)); setEditingInterestIndex(null); setEditingInterestDraft(''); }} className="px-4 py-2 rounded-xl bg-black text-white font-black text-xs uppercase">Guardar</button>
                                    <button type="button" onClick={() => { setEditingInterestIndex(null); setEditingInterestDraft(''); }} className="px-4 py-2 rounded-xl border border-black/20 text-black font-black text-xs uppercase hover:bg-black/5">Cancelar</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2">
                                  <span className="flex-1 min-w-0">{item}</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button type="button" onClick={() => { setEditingInterestIndex(i); setEditingInterestDraft(item); }} className="p-2 rounded-lg text-black/50 hover:text-black hover:bg-black/10 transition-colors" aria-label="Editar"><Edit3 size={18} /></button>
                                    <button type="button" onClick={() => setClientInterestsList((prev) => prev.filter((_, j) => j !== i))} className="p-2 rounded-lg text-black/50 hover:text-red-600 hover:bg-red-50 transition-colors" aria-label="Quitar"><X size={18} /></button>
                                  </div>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <details className="group bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5">
                    <summary className="list-none cursor-pointer select-none flex items-center justify-between">
                      <div>
                        <p className="text-[12px] font-black uppercase text-black italic">Campos adicionales</p>
                        <p className="text-[11px] font-bold text-black/40 uppercase tracking-widest mt-1">Información financiera y familiar (opcional)</p>
                        {additionalLoading && <p className="text-[10px] font-black text-black/60 uppercase tracking-widest mt-2">Cargando…</p>}
                      </div>
                      <ChevronRight className="text-black/40 transition-transform group-open:rotate-90" size={22} />
                    </summary>
                    <div className="mt-8 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Fecha de contacto</label>
                          <input type="date" value={additionalForm.contact_date} onChange={(e) => setAdditionalForm((p) => ({ ...p, contact_date: e.target.value }))} className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Dependientes económicos</label>
                          <input type="number" min={0} value={additionalForm.economic_dependents} onChange={(e) => setAdditionalForm((p) => ({ ...p, economic_dependents: e.target.value }))} placeholder="Ej. 2" className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Nivel de estudios</label>
                          <SelectWithOther name="education_level" options={EDUCATION_LEVELS} value={additionalForm.education_level} onChange={(v) => setAdditionalForm((p) => ({ ...p, education_level: v }))} emptyOption="Sin especificar" className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Sector</label>
                          <input value={additionalForm.sector} onChange={(e) => setAdditionalForm((p) => ({ ...p, sector: e.target.value }))} placeholder="Ej. Salud, Tecnología..." className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none" />
                        </div>
                      </div>
                      <div className="bg-black p-8 rounded-[2.5rem] shadow-xl space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[12px] font-black uppercase text-white/80 italic">Ingresos mensuales estimados</label>
                            <input type="number" step="0.01" min={0} value={additionalForm.monthly_income_estimated} onChange={(e) => setAdditionalForm((p) => ({ ...p, monthly_income_estimated: e.target.value }))} placeholder="Ej. 45000" className="w-full bg-white p-6 rounded-2xl font-black text-black text-3xl outline-none" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[12px] font-black uppercase text-white/80 italic">Moneda</label>
                            <select value={additionalForm.currency} onChange={(e) => setAdditionalForm((p) => ({ ...p, currency: e.target.value }))} className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer">
                              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-white/80 italic">Objetivos financieros</label>
                          <textarea value={additionalForm.financial_goals} onChange={(e) => setAdditionalForm((p) => ({ ...p, financial_goals: e.target.value }))} rows={3} placeholder="Ej. Retiro, educación, protección familiar..." className="w-full bg-white p-6 rounded-2xl font-black text-black text-base outline-none resize-none placeholder:text-black/30" />
                        </div>
                      </div>
                      <div className="bg-white p-8 rounded-[2.5rem] border border-black/5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[12px] font-black uppercase text-black italic">¿Tiene hijos?</label>
                            <select value={hasChildren} onChange={(e) => setHasChildren(e.target.value as 'yes' | 'no' | '')} className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer">
                              <option value="">Sin especificar</option>
                              <option value="no">No</option>
                              <option value="yes">Sí</option>
                            </select>
                          </div>
                        </div>
                        {hasChildren === 'yes' && (
                          <div className="mt-6 space-y-4">
                            {children.map((child, idx) => (
                              <div key={idx} className="bg-[#ece7e2] rounded-[1.5rem] p-5 border border-black/5">
                                <div className="flex justify-between gap-4 mb-4">
                                  <p className="text-[11px] font-black uppercase text-black/50 tracking-widest">Hijo #{idx + 1}</p>
                                  <button type="button" onClick={() => setChildren((prev) => prev.filter((_, i) => i !== idx))} className="px-4 py-2 rounded-xl bg-black text-white font-black text-[11px] uppercase hover:bg-red-600 transition-all">Eliminar</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-[11px] font-black uppercase text-black italic">Nombre</label>
                                    <input value={child.name} onChange={(e) => setChildren((prev) => prev.map((c, i) => (i === idx ? { ...c, name: e.target.value } : c)))} placeholder="Ej. Sofía" className="w-full bg-white p-4 rounded-2xl font-black text-black text-base outline-none" />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[11px] font-black uppercase text-black italic">Edad</label>
                                    <input value={child.age} onChange={(e) => setChildren((prev) => prev.map((c, i) => (i === idx ? { ...c, age: e.target.value } : c)))} type="number" min={0} max={120} placeholder="Ej. 8" className="w-full bg-white p-4 rounded-2xl font-black text-black text-base outline-none" />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[11px] font-black uppercase text-black italic">Contacto</label>
                                    <input value={child.contact} onChange={(e) => setChildren((prev) => prev.map((c, i) => (i === idx ? { ...c, contact: e.target.value } : c)))} placeholder="Tel/Email" className="w-full bg-white p-4 rounded-2xl font-black text-black text-base outline-none" />
                                  </div>
                                </div>
                              </div>
                            ))}
                            <button type="button" onClick={() => setChildren((prev) => [...prev, { name: '', age: '', contact: '' }])} className="w-full py-4 bg-black text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:opacity-90">Agregar hijo</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </details>

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
                  <Row
                    label="Edad"
                    value={
                      detailCustomer.age != null
                        ? String(detailCustomer.age)
                        : detailCustomer.birthday
                          ? String(calculateAge(detailCustomer.birthday) ?? '')
                          : null
                    }
                  />
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

      {/* Modal: Cliente creado — Capturar póliza o Volver a Clientes */}
      <AnimatePresence>
        {postCreateCustomerId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPostCreateCustomerId(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
            />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="post-create-title"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-black/5 overflow-hidden"
              >
                <div className="p-8 text-center">
                  <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <CheckCircle2 className="text-green-600" size={28} />
                  </div>
                  <h3 id="post-create-title" className="text-xl font-black text-black uppercase tracking-tighter mb-2">
                    Cliente creado
                  </h3>
                  <p className="text-sm text-black/60 mb-6">¿Qué deseas hacer ahora?</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        router.push(`/polizas?customerId=${postCreateCustomerId}`)
                        setPostCreateCustomerId(null)
                      }}
                      className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-black text-sm uppercase bg-black text-white hover:bg-black/90 transition-all"
                    >
                      <FileCheck size={18} /> Capturar datos de póliza
                    </button>
                    <button
                      type="button"
                      onClick={() => setPostCreateCustomerId(null)}
                      className="px-6 py-4 rounded-xl font-black text-sm uppercase border-2 border-black/20 text-black hover:bg-black/5 transition-all"
                    >
                      Volver a Clientes
                    </button>
                  </div>
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
