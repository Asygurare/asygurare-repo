"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DATABASE,
  Currency,
  CustomerStatus,
  EducationLevel,
  Gender,
  InsuranceType,
  LeadFormStage,
  LeadStatus,
  MaritalStatus,
  OriginSource,
  PipelineStage,
} from '@/src/config'
import { 
  Zap, Target, X, Mail, Phone, Loader2, CheckCircle2, 
  TrendingUp, DollarSign, UserCheck, Trash2, Edit3, 
  Search, Clock, Info, Share2, MessageSquare, ChevronRight, User, FileCheck
} from 'lucide-react'
import { supabaseClient } from '@/src/lib/supabase/client'
import { toast, Toaster } from 'sonner'
import { calculateAge } from '@/src/lib/utils/utils'
import { SelectWithOther } from '@/src/components/ui/SelectWithOther'
import { RefreshButton } from '@/src/components/workspace/RefreshButton'

export default function ProspectosFinalUltraPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [fetching, setFetching] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'activos' | 'descartados'>('activos')
  const [discardModalLead, setDiscardModalLead] = useState<any>(null)
  const [discardReason, setDiscardReason] = useState('')
  const [discardStage, setDiscardStage] = useState(LeadFormStage.PrimerContacto)
  const [discardReasonFilter, setDiscardReasonFilter] = useState('__all__')
  const [stageFilter, setStageFilter] = useState<string>('__all__')
  const [includeDiscarded, setIncludeDiscarded] = useState(false)
  const [reactivateModalLead, setReactivateModalLead] = useState<any>(null)
  const [reactivateStage, setReactivateStage] = useState<string>(LeadFormStage.PrimerContacto)
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
  const [formBirthday, setFormBirthday] = useState('')
  const [formAge, setFormAge] = useState('')
  const [clientInterestsList, setClientInterestsList] = useState<string[]>([])
  const [clientInterestInput, setClientInterestInput] = useState('')
  const [editingInterestIndex, setEditingInterestIndex] = useState<number | null>(null)
  const [editingInterestDraft, setEditingInterestDraft] = useState('')
  const [formDirty, setFormDirty] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [convertedCustomerId, setConvertedCustomerId] = useState<string | null>(null)
  const router = useRouter()

  const LEAD_FORM_STAGES = Object.values(LeadFormStage)
  const STATUSES = Object.values(LeadStatus)
  const PIPELINE_OPTIONS = Object.values(PipelineStage)
  const PIPELINE_COLOR_MAP: Record<string, { border: string; bg: string; text: string; badge: string }> = {
    'Nuevo': { border: '#cbd5e1', bg: '#f8fafc', text: '#334155', badge: '#e2e8f0' },
    [PipelineStage.PrimerContacto]: { border: '#86efac', bg: '#f0fdf4', text: '#166534', badge: '#dcfce7' },
    [PipelineStage.CitaAgendada]: { border: '#60a5fa', bg: '#eff6ff', text: '#1d4ed8', badge: '#dbeafe' },
    [PipelineStage.PropuestaEnviada]: { border: '#a78bfa', bg: '#f5f3ff', text: '#5b21b6', badge: '#ede9fe' },
    [PipelineStage.EnNegociacion]: { border: '#f59e0b', bg: '#fffbeb', text: '#92400e', badge: '#fef3c7' },
    [PipelineStage.Ganado]: { border: '#14b8a6', bg: '#f0fdfa', text: '#0f766e', badge: '#ccfbf1' },
    [PipelineStage.Descartado]: { border: '#ef4444', bg: '#fef2f2', text: '#991b1b', badge: '#fee2e2' },
  }
  const MARITAL_STATUSES = Object.values(MaritalStatus)
  const GENDERS = Object.values(Gender)
  const INSURANCE_TYPES = Object.values(InsuranceType)
  const ORIGIN_SOURCES = Object.values(OriginSource)
  const EDUCATION_LEVELS = Object.values(EducationLevel)
  const CURRENCIES = Object.values(Currency)
  // Los campos adicionales se guardan en `WS_LEADS.additional_fields` (JSONB)

  const leadDisplayName = useCallback((lead: any) => {
    const legacy = String(lead?.full_name || '').trim()
    if (legacy) return legacy
    const name = String(lead?.name || '').trim()
    const last = String(lead?.last_name || '').trim()
    const merged = `${name} ${last}`.trim()
    return merged || 'Sin nombre'
  }, [])

  const parseTriBool = useCallback((v: FormDataEntryValue | null): boolean | null => {
    const s = String(v || '').trim()
    if (!s) return null
    if (s === 'yes') return true
    if (s === 'no') return false
    return null
  }, [])

  const normalizeText = useCallback((value: unknown) => String(value || '').trim().toLowerCase(), [])

  const isDiscardedLead = useCallback((lead: any) => normalizeText(lead?.status) === 'descartado', [normalizeText])

  const resolveVisualStatus = useCallback((lead: any) => {
    if (isDiscardedLead(lead)) return 'Descartado'

    const stage = String(lead?.stage || '').trim()
    if ((PIPELINE_OPTIONS as readonly string[]).includes(stage)) return stage

    const normalizedStatus = normalizeText(lead?.status)
    if (normalizedStatus === 'ganado') return 'Ganado'
    if (normalizedStatus === 'nuevo') return 'Nuevo'
    return PipelineStage.PrimerContacto
  }, [isDiscardedLead, normalizeText, PIPELINE_OPTIONS])

  const getDiscardReason = useCallback((lead: any) => {
    const extra = lead?.additional_fields && typeof lead.additional_fields === 'object'
      ? lead.additional_fields
      : {}
    return String(extra?.discard_reason || '').trim()
  }, [])

  const getDiscardStage = useCallback((lead: any) => {
    const extra = lead?.additional_fields && typeof lead.additional_fields === 'object'
      ? lead.additional_fields
      : {}
    return String(extra?.discard_stage || lead?.stage || '').trim()
  }, [])

  // Sincronizar fecha de nacimiento y edad al abrir el modal (edad editable solo si no hay birthday)
  useEffect(() => {
    if (isModalOpen) {
      const b = selectedLead?.birthday ?? ''
      setFormBirthday(b)
      const age =
        selectedLead?.age != null
          ? String(selectedLead.age)
          : b
            ? String(calculateAge(b) ?? '')
            : ''
      setFormAge(age)
    }
  }, [isModalOpen, selectedLead?.id, selectedLead?.birthday, selectedLead?.age])

  useEffect(() => {
    if (isModalOpen) {
      const raw = String(selectedLead?.client_interests ?? '').trim()
      setClientInterestsList(raw ? raw.split(/\n/).map((s) => s.trim()).filter(Boolean) : [])
      setClientInterestInput('')
    } else {
      setClientInterestsList([])
      setClientInterestInput('')
      setEditingInterestIndex(null)
      setEditingInterestDraft('')
    }
  }, [isModalOpen, selectedLead?.id, selectedLead?.client_interests])

  useEffect(() => {
    if (isModalOpen) setFormDirty(false)
  }, [isModalOpen])

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

  const updateLeadVisualStatus = async (lead: any, newStatus: string) => {
    if (newStatus === 'Descartado') {
      setDiscardModalLead(lead)
      setDiscardReason('')
      setDiscardStage(LEAD_FORM_STAGES.includes(lead?.stage) ? lead.stage : LeadFormStage.PrimerContacto)
      return
    }

    const nextRawStatus = newStatus === 'Ganado' ? 'Ganado' : 'En seguimiento'
    const { error } = await supabaseClient
      .from(DATABASE.TABLES.WS_LEADS)
      .update({
        stage: newStatus,
        status: nextRawStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id)

    if (error) {
      toast.error("Error al mover etapa")
      return
    }

    toast.success(`Estatus actualizado: ${newStatus}`)
    setLeads((prev) =>
      prev.map((l) =>
        l.id === lead.id ? { ...l, stage: newStatus, status: nextRawStatus } : l
      )
    )
  }

  const confirmDiscardLead = async () => {
    if (!discardModalLead?.id) return
    if (!discardReason.trim()) {
      toast.error('Comparte el motivo del descarte.')
      return
    }

    const prevExtra =
      discardModalLead?.additional_fields && typeof discardModalLead.additional_fields === 'object'
        ? discardModalLead.additional_fields
        : {}
    const nextExtra = {
      ...prevExtra,
      discard_reason: discardReason.trim(),
      discard_stage: discardStage,
      discarded_at: new Date().toISOString(),
    }

    const { error } = await supabaseClient
      .from(DATABASE.TABLES.WS_LEADS)
      .update({
        status: 'Descartado',
        stage: discardStage,
        additional_fields: nextExtra,
        updated_at: new Date().toISOString(),
      })
      .eq('id', discardModalLead.id)

    if (error) {
      toast.error('No se pudo descartar el prospecto.')
      return
    }

    setLeads((prev) =>
      prev.map((l) =>
        l.id === discardModalLead.id
          ? { ...l, status: 'Descartado', stage: discardStage, additional_fields: nextExtra }
          : l
      )
    )
    setDiscardModalLead(null)
    setDiscardReason('')
    setDiscardStage(LeadFormStage.PrimerContacto)
    toast.success('Prospecto movido a descartados.')
  }

  const reactivateLead = async (lead: any, stage: string) => {
    const prevExtra =
      lead?.additional_fields && typeof lead.additional_fields === 'object'
        ? lead.additional_fields
        : {}
    const nextExtra = {
      ...prevExtra,
      reactivated_at: new Date().toISOString(),
    }

    const targetStage = stage && (LEAD_FORM_STAGES as readonly string[]).includes(stage) ? stage : LeadFormStage.PrimerContacto
    const { error } = await supabaseClient
      .from(DATABASE.TABLES.WS_LEADS)
      .update({
        status: 'En seguimiento',
        stage: targetStage,
        additional_fields: nextExtra,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id)

    if (error) {
      toast.error('No se pudo reactivar el prospecto.')
      return
    }

    setLeads((prev) =>
      prev.map((l) =>
        l.id === lead.id
          ? { ...l, status: 'En seguimiento', stage: targetStage, additional_fields: nextExtra }
          : l
      )
    )
    setReactivateModalLead(null)
    setReactivateStage(LeadFormStage.PrimerContacto)
    toast.success('Prospecto reactivado y movido a activos.')
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

    const nowIso = new Date().toISOString()
    const baseExtra =
      lead?.additional_fields && typeof lead.additional_fields === 'object'
        ? lead.additional_fields
        : {}

    // 1. Insertar en clientes (WS_CUSTOMERS_2, schema alineado con Prospectos)
    const { data: newCustomer, error: insertError } = await supabaseClient
      .from(DATABASE.TABLES.WS_CUSTOMERS_2)
      .insert({
        user_id: user.id,
        name,
        last_name: lead?.last_name || null,
        status: CustomerStatus.Activo,
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
      country: lead?.country || null,
      state: lead?.state || null,
      city: lead?.city || null,
      postal_code: lead?.postal_code || null,
      address: lead?.address || null,
      // Marker so Metas/Analytics can measure conversions lead -> customer
        additional_fields: { ...baseExtra, converted_from_lead_id: String(lead?.id || ''), converted_at: nowIso },
      })
      .select('id')
      .single()

    if (insertError) {
      toast.error("Error al convertir: " + insertError.message)
    } else {
      // 2. Eliminar de leads
      await supabaseClient.from(DATABASE.TABLES.WS_LEADS).delete().eq('id', lead.id)
      toast.success("¡FELICIDADES! Venta cerrada y movida a Clientes.")
      setIsModalOpen(false)
      fetchData()
      if (newCustomer?.id) setConvertedCustomerId(newCustomer.id)
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
    const clientInterests =
      clientInterestsList.length > 0
        ? clientInterestsList.map((s) => s.trim()).filter(Boolean).join('\n').trim() || null
        : null
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
      : (birthday ? calculateAge(birthday) ?? null : null)

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
      setFormDirty(false)
      setIsModalOpen(false)
      fetchData()
    }
    setLoading(false)
  }

  const totalValue = useMemo(() => leads.reduce((acc, l) => acc + (Number(l.estimated_value) || 0), 0), [leads])
  const totalProspectos = useMemo(() => leads.length, [leads])
  const leadsFiltrados = useMemo(
    () => leads.filter((l) => leadDisplayName(l).toLowerCase().includes(searchTerm.toLowerCase())),
    [leads, searchTerm, leadDisplayName]
  )
  const activeLeads = useMemo(() => leadsFiltrados.filter((l) => !isDiscardedLead(l)), [leadsFiltrados, isDiscardedLead])
  const discardedLeads = useMemo(() => leadsFiltrados.filter((l) => isDiscardedLead(l)), [leadsFiltrados, isDiscardedLead])
  const discardReasonOptions = useMemo(() => {
    const set = new Set<string>()
    discardedLeads.forEach((lead) => {
      const reason = getDiscardReason(lead)
      if (reason) set.add(reason)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [discardedLeads, getDiscardReason])
  const discardedLeadsFilteredByReason = useMemo(() => {
    if (discardReasonFilter === '__all__') return discardedLeads
    if (discardReasonFilter === '__none__') return discardedLeads.filter((l) => !getDiscardReason(l))
    return discardedLeads.filter((l) => getDiscardReason(l) === discardReasonFilter)
  }, [discardedLeads, discardReasonFilter, getDiscardReason])
  const baseListForStage = useMemo(() => {
    if (activeTab === 'descartados') return discardedLeadsFilteredByReason
    if (includeDiscarded) return [...activeLeads, ...discardedLeadsFilteredByReason]
    return activeLeads
  }, [activeTab, includeDiscarded, activeLeads, discardedLeadsFilteredByReason])
  const visibleLeads = useMemo(() => {
    if (stageFilter === '__all__') return baseListForStage
    return baseListForStage.filter((lead) => {
      const stage = activeTab === 'activos' ? resolveVisualStatus(lead) : (lead?.stage ?? getDiscardStage(lead))
      return stage === stageFilter
    })
  }, [activeTab, baseListForStage, stageFilter, resolveVisualStatus, getDiscardStage])

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

      {/* GUIA DE ESTATUS */}
      <div className="bg-white/70 backdrop-blur-sm p-6 rounded-[2rem] flex flex-wrap gap-8 items-center border border-black/5">
        <div className="flex items-center gap-2 border-r border-black/10 pr-6">
            <Info size={18} className="text-black" />
            <span className="text-base font-black text-black uppercase italic">Estatus del pipeline:</span>
        </div>
        {PIPELINE_OPTIONS.map((s) => (
            <div key={s} className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full border-2"
                  style={{ backgroundColor: PIPELINE_COLOR_MAP[s]?.badge, borderColor: PIPELINE_COLOR_MAP[s]?.border }}
                />
                <span className="text-sm font-black text-black uppercase tracking-tighter">{s}</span>
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="bg-white p-2 rounded-[1.5rem] inline-flex items-center gap-2 border border-black/5 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('activos')}
            className={`px-6 py-3 rounded-[1rem] text-sm font-black uppercase tracking-widest transition-all ${
              activeTab === 'activos' ? 'bg-black text-white' : 'text-black/60 hover:bg-black/5'
            }`}
          >
            Prospectos activos ({activeLeads.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('descartados')}
            className={`px-6 py-3 rounded-[1rem] text-sm font-black uppercase tracking-widest transition-all ${
              activeTab === 'descartados' ? 'bg-red-600 text-white' : 'text-black/60 hover:bg-black/5'
            }`}
          >
            Prospectos descartados ({discardedLeads.length})
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <RefreshButton onRefresh={fetchData} refreshing={fetching} />
          {activeTab === 'activos' && (
            <div className="flex items-center gap-2 mr-5">
              <span className="text-sm font-black uppercase tracking-widest text-black/70 whitespace-nowrap">Incluir descartados</span>
              <button
                type="button"
                role="switch"
                aria-checked={includeDiscarded}
                onClick={() => setIncludeDiscarded((v) => !v)}
                className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accents) focus-visible:ring-offset-2 ${
                  includeDiscarded ? 'bg-(--accents) border-(--accents)' : 'bg-black/10 border-black/20'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                    includeDiscarded ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                  style={{ marginTop: 2 }}
                />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-sm font-black uppercase tracking-widest text-black/70 whitespace-nowrap">Etapa</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="bg-white border-2 border-black/10 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wide text-black outline-none focus:border-(--accents) min-w-[200px] cursor-pointer"
            >
              <option value="__all__">Todas las etapas</option>
              {PIPELINE_OPTIONS.map((stage) => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {activeTab === 'descartados' && (
        <div className="bg-white p-4 rounded-[1.5rem] border border-red-100 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
          <label className="text-sm font-black uppercase tracking-widest text-red-700">Filtrar por motivo</label>
          <select
            value={discardReasonFilter}
            onChange={(e) => setDiscardReasonFilter(e.target.value)}
            className="bg-[#fff7f7] border border-red-100 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-black outline-none min-w-[260px]"
          >
            <option value="__all__">Todos los motivos</option>
            <option value="__none__">Sin motivo registrado</option>
            {discardReasonOptions.map((reason) => (
              <option key={reason} value={reason}>{reason}</option>
            ))}
          </select>
        </div>
      )}

      {/* LISTA */}
      <div className="grid grid-cols-1 gap-5">
        {fetching ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-(--accents)" size={40}/></div> : 
        visibleLeads.map((lead) => {
          const visualStatus = resolveVisualStatus(lead)
          const tone = PIPELINE_COLOR_MAP[visualStatus] || PIPELINE_COLOR_MAP['Nuevo']
          return (
          <div key={lead.id} className="p-8 rounded-[3rem] border-2 flex flex-wrap items-center gap-8 group transition-all shadow-md" style={{ borderColor: tone.border, backgroundColor: activeTab === 'descartados' ? '#ffffff' : tone.bg }}>
            <div className="flex-1 min-w-[300px] cursor-pointer" onClick={() => {setSelectedLead(lead); setIsModalOpen(true)}}>
              <h4 className="font-black text-black text-2xl uppercase italic transition-colors tracking-tighter" style={{ color: tone.text }}>{leadDisplayName(lead)}</h4>
              <div className="flex flex-wrap gap-4 mt-2">
                <span className="flex items-center gap-1 text-sm font-black text-black/40 uppercase italic tracking-wider"><Share2 size={12}/> {lead.source || 'Sin Fuente'}</span>
                <span className="flex items-center gap-1 text-sm font-black text-black/40 uppercase italic tracking-wider"><Mail size={12}/> {lead.email || 'Sin Email'}</span>
                <span className="flex items-center gap-1 text-sm font-black text-(--accents) uppercase italic tracking-wider"><Phone size={12}/> {lead.phone || 'Sin Tel.'}</span>
                <span className="px-3 py-1 rounded-full text-sm font-black uppercase tracking-widest" style={{ backgroundColor: tone.badge, color: tone.text }}>
                  {visualStatus}
                </span>
              </div>
              {activeTab === 'descartados' && (
                <div className="mt-4 bg-[#fff7f7] border border-red-100 rounded-2xl p-4 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-700">
                    Motivo: {getDiscardReason(lead) || 'Sin motivo registrado'}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-700/80">
                    Etapa: {getDiscardStage(lead) || 'Sin etapa'}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white p-5 rounded-[2rem] border border-black/10 min-w-[280px]">
              <p className="text-[10px] font-black text-black/50 uppercase tracking-widest mb-2">Etapa</p>
              <div>
                <select
                  value={visualStatus}
                  onChange={(e) => updateLeadVisualStatus(lead, e.target.value)}
                  className="w-full bg-[#ece7e2] p-4 rounded-2xl font-black text-black text-sm uppercase tracking-wide outline-none appearance-none cursor-pointer border-2 border-transparent focus:border-(--accents)"
                >
                  {PIPELINE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-[10px] font-black text-black/40 uppercase italic">Monto Estimado</p>
                <p className="font-black text-black text-3xl tracking-tighter">${Number(lead.estimated_value).toLocaleString()}</p>
              </div>
              {activeTab === 'descartados' && (
                <button
                  type="button"
                  onClick={() => {
                    const currentStage = lead?.stage
                    const validStage = currentStage && LEAD_FORM_STAGES.filter((s) => s !== LeadFormStage.Otro).includes(currentStage)
                      ? currentStage
                      : LeadFormStage.PrimerContacto
                    setReactivateStage(validStage)
                    setReactivateModalLead(lead)
                  }}
                  className="px-5 py-3 rounded-2xl bg-emerald-600 text-white font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all"
                >
                  Reactivar
                </button>
              )}
              <button onClick={() => handleDelete(lead.id)} className="p-4 text-black/20 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={24}/></button>
            </div>
          </div>
        )})}
        {!fetching && visibleLeads.length === 0 && (
          <div className="bg-white border border-black/5 rounded-[2rem] p-8 text-center text-black/60 font-black uppercase tracking-widest">
            No hay prospectos en esta pestaña.
          </div>
        )}
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
                <div className="p-8 md:p-10 bg-white flex flex-wrap justify-between items-center gap-4 border-b-2 border-black/5 shadow-sm">
                  <div>
                    <h3 className="text-3xl font-black italic text-black uppercase tracking-tighter">{selectedLead ? 'Expediente' : 'Nuevo prospecto'}</h3>
                    <p className="text-xs font-bold text-black/50 uppercase tracking-widest mt-1">
                      Captura rápida, clara y completa.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedLead && (
                      <button
                        type="button"
                        disabled={!formDirty || loading}
                        onClick={() => formRef.current?.requestSubmit()}
                        className="px-5 py-3 rounded-2xl bg-(--accents) text-white font-black text-sm uppercase tracking-wide shadow-md hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Guardar cambios'}
                      </button>
                    )}
                    <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-full text-black transition-all" aria-label="Cerrar"><X size={32}/></button>
                  </div>
                </div>

                <form ref={formRef} onSubmit={handleSaveLead} onChange={() => setFormDirty(true)} className="max-h-[80vh] overflow-y-auto p-8 md:p-10 space-y-8 custom-scrollbar">
                
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
                      <label className="text-[12px] font-black uppercase text-black italic">WhatsApp / Tel</label>
                      <input
                        name="phone"
                        defaultValue={selectedLead?.phone || ''}
                        placeholder="+52..."
                        maxLength={12}
                        inputMode="numeric"
                        autoComplete="tel"
                        onInput={(e) => { const v = e.currentTarget.value.replace(/\D/g, '').slice(0, 12); e.currentTarget.value = v; }}
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
                          options={ORIGIN_SOURCES}
                          defaultValue={selectedLead?.source || ''}
                          emptyOption="Selecciona una opción..."
                          otherOptionValue="Personalizado"
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
                          options={LEAD_FORM_STAGES}
                          defaultValue={selectedLead?.stage || LeadFormStage.PrimerContacto}
                          className="w-full bg-white p-5 rounded-2xl font-black text-black text-lg outline-none appearance-none cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-black/5 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Cumpleaños</label>
                          <input
                            name="birthday"
                            type="date"
                            value={formBirthday}
                            onChange={(e) => {
                              const v = e.target.value
                              setFormBirthday(v)
                              setFormAge(v ? String(calculateAge(v) ?? '') : '')
                            }}
                            className="w-full bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-lg outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-black uppercase text-black italic">Edad</label>
                          <input
                            name="age"
                            type="number"
                            value={formAge}
                            onChange={(e) => { const v = e.target.value; const n = v === '' ? '' : Math.min(99, Math.max(0, parseInt(v, 10) || 0)).toString(); setFormAge(n); }}
                            readOnly={!!formBirthday}
                            placeholder={formBirthday ? '' : 'Ej. 32 (editable si no hay fecha)'}
                            min={0}
                            max={99}
                            className={`w-full p-5 rounded-2xl font-black text-black text-lg outline-none ${formBirthday ? 'bg-gray-100 cursor-not-allowed' : 'bg-[#ece7e2]'}`}
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
                        <label className="text-[12px] font-black uppercase text-black italic">Notas / Bitácora</label>
                        <textarea
                          name="notes"
                          defaultValue={selectedLead?.notes || ''}
                          rows={4}
                          className="w-full bg-[#ece7e2] p-6 rounded-2xl font-black text-black text-base outline-none resize-none placeholder:text-black/20"
                          placeholder="Escribe aquí acuerdos, próximos pasos y contexto..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border-2 border-(--accents)/20 space-y-4">
                  <div>
                    <label className="text-base font-black uppercase text-(--accents) italic">Intereses del cliente</label>
                    <p className="text-sm text-black/60 mt-1.5 max-w-xl">
                      Estos datos ayudan a nuestro asistente de IA a personalizar la conversación y ofrecer mejores recomendaciones. Escribe palabras, enunciados o párrafos (por ejemplo: &quot;Quiere asegurar a su familia&quot;, &quot;Le gusta el teatro&quot;) y agrégalos con Enter o el botón.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={clientInterestInput}
                        onChange={(e) => setClientInterestInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const v = clientInterestInput.trim()
                            if (v) {
                              setClientInterestsList((prev) => [...prev, v])
                              setClientInterestInput('')
                            }
                          }
                        }}
                        placeholder="Escribe hobbies, preferencias, etc... Presiona Enter para agregar."
                        className="flex-1 bg-[#ece7e2] p-5 rounded-2xl font-black text-black text-base outline-none placeholder:text-black/30 border-2 border-transparent focus:border-(--accents)"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const v = clientInterestInput.trim()
                          if (v) {
                            setClientInterestsList((prev) => [...prev, v])
                            setClientInterestInput('')
                          }
                        }}
                        className="px-6 py-5 rounded-2xl bg-(--accents) text-white font-black text-sm uppercase tracking-wide hover:opacity-95 transition-opacity shrink-0"
                      >
                        Agregar
                      </button>
                    </div>
                    {clientInterestsList.length > 0 && (
                      <ul className="list-disc list-outside space-y-3 mt-4 pl-6 text-black font-bold text-sm [list-style-type:disc]">
                        {clientInterestsList.map((item, i) => (
                          <li key={`${i}-${item.slice(0, 30)}`} className="pl-1">
                            {editingInterestIndex === i ? (
                              <div className="flex flex-col gap-2">
                                <textarea
                                  value={editingInterestDraft}
                                  onChange={(e) => setEditingInterestDraft(e.target.value)}
                                  rows={4}
                                  className="w-full bg-[#ece7e2] p-4 rounded-xl font-black text-black text-sm outline-none resize-y border-2 border-(--accents)"
                                  placeholder="Edita el enunciado o párrafo..."
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const v = editingInterestDraft.trim()
                                      if (v) {
                                        setClientInterestsList((prev) => prev.map((s, j) => (j === i ? v : s)))
                                      } else {
                                        setClientInterestsList((prev) => prev.filter((_, j) => j !== i))
                                      }
                                      setEditingInterestIndex(null)
                                      setEditingInterestDraft('')
                                    }}
                                    className="px-4 py-2 rounded-xl bg-(--accents) text-white font-black text-xs uppercase"
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingInterestIndex(null)
                                      setEditingInterestDraft('')
                                    }}
                                    className="px-4 py-2 rounded-xl border border-black/20 text-black font-black text-xs uppercase hover:bg-black/5"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <span className="flex-1 min-w-0">{item}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingInterestIndex(i)
                                      setEditingInterestDraft(item)
                                    }}
                                    className="p-2 rounded-lg text-black/50 hover:text-(--accents) hover:bg-(--accents)/10 transition-colors"
                                    aria-label="Editar"
                                    title="Editar"
                                  >
                                    <Edit3 size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setClientInterestsList((prev) => prev.filter((_, j) => j !== i))}
                                    className="p-2 rounded-lg text-black/50 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    aria-label="Quitar"
                                    title="Quitar"
                                  >
                                    <X size={18} />
                                  </button>
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
                          max={99}
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
                                        const v = e.target.value.replace(/\D/g, '').slice(0, 2)
                                        const n = v === '' ? v : String(Math.min(99, parseInt(v, 10) || 0))
                                        setChildren((prev) => prev.map((c, i) => (i === idx ? { ...c, age: n } : c)))
                                      }}
                                      type="text"
                                      inputMode="numeric"
                                      maxLength={2}
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

      <AnimatePresence>
        {discardModalLead && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDiscardModalLead(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[80]"
            />
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
              <motion.div
                role="dialog"
                aria-modal="true"
                initial={{ opacity: 0, scale: 0.97, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 10 }}
                transition={{ type: 'spring', damping: 25 }}
                className="w-full max-w-2xl bg-white shadow-2xl rounded-[2rem] overflow-hidden border border-white/20"
              >
                <div className="p-6 bg-[#fef2f2] border-b border-red-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black italic text-red-700 uppercase tracking-tighter">Descartar prospecto</h3>
                    <p className="text-sm font-bold text-red-700/70 uppercase tracking-widest mt-1">
                      {leadDisplayName(discardModalLead)}
                    </p>
                  </div>
                  <button onClick={() => setDiscardModalLead(null)} className="p-2 hover:bg-red-100 rounded-full text-red-700 transition-all">
                    <X size={24} />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-black uppercase text-black italic">¿Cuál fue el motivo por el cual no continuó?</label>
                    <textarea
                      value={discardReason}
                      onChange={(e) => setDiscardReason(e.target.value)}
                      rows={4}
                      placeholder="Ej. Presupuesto insuficiente, no respondió, eligió otra aseguradora..."
                      className="w-full bg-[#fff7f7] p-4 rounded-2xl font-black text-black text-sm outline-none border border-red-100 resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black uppercase text-black italic">¿En qué etapa se quedó?</label>
                    <select
                      value={discardStage}
                      onChange={(e) => setDiscardStage(e.target.value as LeadFormStage)}
                      className="w-full bg-[#fff7f7] p-4 rounded-2xl font-black text-black text-sm outline-none border border-red-100 appearance-none cursor-pointer"
                    >
                      {LEAD_FORM_STAGES.filter((stage) => stage !== LeadFormStage.Otro).map((stage) => (
                        <option key={stage} value={stage}>{stage}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setDiscardModalLead(null)}
                      className="px-5 py-3 rounded-2xl border border-black/10 text-black/70 font-black text-xs uppercase tracking-widest hover:bg-black/5 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={confirmDiscardLead}
                      className="px-6 py-3 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all"
                    >
                      Confirmar descarte
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reactivateModalLead && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReactivateModalLead(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[80]"
            />
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
              <motion.div
                role="dialog"
                aria-modal="true"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ type: 'spring', damping: 25 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white shadow-2xl rounded-2xl overflow-hidden border border-black/10 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-black italic text-black uppercase tracking-tighter">Reactivar prospecto</h3>
                  <button onClick={() => setReactivateModalLead(null)} className="p-2 hover:bg-black/5 rounded-full text-black/60 transition-colors" aria-label="Cerrar">
                    <X size={22} />
                  </button>
                </div>
                <p className="text-sm text-black/60 mb-4">
                  Elige en qué etapa del pipeline quieres que aparezca al reactivar.
                </p>
                <div className="space-y-2 mb-6">
                  <label className="text-sm font-black uppercase text-black italic">Etapa</label>
                  <select
                    value={reactivateStage}
                    onChange={(e) => setReactivateStage(e.target.value)}
                    className="w-full bg-[#ece7e2] p-4 rounded-2xl font-black text-black text-sm outline-none border-2 border-transparent focus:border-(--accents) appearance-none cursor-pointer"
                  >
                    {LEAD_FORM_STAGES.filter((s) => s !== LeadFormStage.Otro).map((stage) => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setReactivateModalLead(null)}
                    className="px-5 py-3 rounded-2xl border border-black/10 text-black/70 font-black text-sm uppercase tracking-widest hover:bg-black/5 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => reactivateLead(reactivateModalLead, reactivateStage)}
                    className="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all"
                  >
                    Reactivar
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Modal: Prospecto convertido en cliente — Ir a cliente / Capturar póliza / Volver */}
      <AnimatePresence>
        {convertedCustomerId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConvertedCustomerId(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
            />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="convert-success-title"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-black/5 overflow-hidden"
              >
                <div className="p-8 text-center">
                  <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                    <CheckCircle2 className="text-emerald-600" size={28} />
                  </div>
                  <h3 id="convert-success-title" className="text-xl font-black text-black uppercase tracking-tighter mb-2">
                    ¡Venta cerrada!
                  </h3>
                  <p className="text-sm text-black/60 mb-6">El prospecto ya es cliente. ¿Qué deseas hacer ahora?</p>
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        router.push(`/clientes?openId=${convertedCustomerId}`)
                        setConvertedCustomerId(null)
                      }}
                      className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-black text-sm uppercase bg-black text-white hover:bg-black/90 transition-all"
                    >
                      <User size={18} /> Ir a actualizar información del cliente
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        router.push(`/polizas?customerId=${convertedCustomerId}`)
                        setConvertedCustomerId(null)
                      }}
                      className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-black text-sm uppercase border-2 border-black/20 text-black hover:bg-black/5 transition-all"
                    >
                      <FileCheck size={18} /> Capturar póliza
                    </button>
                    <button
                      type="button"
                      onClick={() => setConvertedCustomerId(null)}
                      className="px-6 py-4 rounded-xl font-black text-sm uppercase text-black/60 hover:bg-black/5 transition-all"
                    >
                      Volver a prospectos
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