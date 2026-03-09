"use client"

import React, { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  BadgeCheck,
  Bell,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Save,
  Settings2,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { supabaseClient } from "@/src/lib/supabase/client"
import { useRouter } from "next/navigation"
import { changeUserPassword, deleteUserAccount, validatePassword } from "@/src/lib/utils/auth/auth-service"
import { SITE_CONFIG } from "@/src/config/site"
import { SectionTutorial, type SectionTutorialStep } from "@/src/components/workspace/tutorial/SectionTutorial"

type Preferences = {
  language: "es-MX" | "en-US"
  timezone: string
  density: "normal" | "compact"
  reduceMotion: boolean
}

type Notifications = {
  renewals: boolean
  payments: boolean
  productUpdates: boolean
}

type SettingsState = {
  firstName: string
  lastName: string
  agencyName: string
  city: string
  country: string
  preferences: Preferences
  notifications: Notifications
}

type BillingState = {
  status: string
  has_pro_access: boolean
  trial_ends_at: string | null
  current_period_ends_at: string | null
  cancel_at_period_end: boolean
}

type UserSettingsMetadata = {
  preferences?: Partial<Preferences>
  notifications?: Partial<Notifications>
}

type UserMetadata = {
  first_name?: string
  last_name?: string
  agency_name?: string
  city?: string
  country?: string
  settings?: UserSettingsMetadata
}

const LS_KEY = "tg_settings_v1"

const SETTINGS_TUTORIAL_STEPS: SectionTutorialStep[] = [
  {
    id: "settings-header",
    title: "Configuracion general",
    description: "Aqui gestionas tu perfil y los ajustes de tu cuenta.",
    selector: '[data-tutorial="settings-header"]',
  },
  {
    id: "settings-profile",
    title: "Perfil del agente",
    description: "Actualiza nombre, agencia y datos de ubicacion.",
    selector: '[data-tutorial="settings-profile"]',
  },
  {
    id: "settings-preferences",
    title: "Preferencias",
    description: "Consulta la configuracion de experiencia y notificaciones.",
    selector: '[data-tutorial="settings-preferences"]',
  },
  {
    id: "settings-security",
    title: "Seguridad",
    description: "Cambia tu contrasena y gestiona acciones sensibles de la cuenta.",
    selector: '[data-tutorial="settings-security"]',
  },
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido"
}

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <div className={`flex items-start justify-between gap-6 py-4 ${disabled ? "opacity-60" : ""}`}>
      <div className="min-w-0">
        <p className="text-sm font-black text-black uppercase tracking-widest">{label}</p>
        {description ? (
          <p className="text-sm font-bold text-black/40 leading-relaxed mt-1">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        aria-pressed={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`shrink-0 w-14 h-8 rounded-full border transition-all relative ${disabled ? "cursor-not-allowed" : ""
          } ${checked ? "bg-(--accents) border-(--accents)" : "bg-black/5 border-black/10"}`}
      >
        <span
          className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-6" : "translate-x-0"
            }`}
        />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [email, setEmail] = useState<string>("")
  const [state, setState] = useState<SettingsState>({
    firstName: "",
    lastName: "",
    agencyName: "",
    city: "",
    country: "",
    preferences: {
      language: "es-MX",
      timezone: "America/Mexico_City",
      density: "normal",
      reduceMotion: false,
    },
    notifications: {
      renewals: true,
      payments: true,
      productUpdates: true,
    },
  })

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setPassword] = useState("")
  const [confirmNewPassword, setPassword2] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [billingLoading, setBillingLoading] = useState(true)
  const [billingActionLoading, setBillingActionLoading] = useState(false)
  const [billing, setBilling] = useState<BillingState>({
    status: "free",
    has_pro_access: false,
    trial_ends_at: null,
    current_period_ends_at: null,
    cancel_at_period_end: false,
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const { data: authData, error: authError } = await supabaseClient.auth.getUser()
        if (authError) throw authError
        const user = authData.user
        if (!user) {
          setLoading(false)
          return
        }

        setEmail(user.email || "")

        const meta = (user.user_metadata || {}) as UserMetadata
        const metaSettings = isPlainObject(meta.settings) ? meta.settings : {}
        const metaPrefs = isPlainObject(metaSettings.preferences) ? metaSettings.preferences : {}
        const metaNotifs = isPlainObject(metaSettings.notifications) ? metaSettings.notifications : {}

        const lsRaw = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null
        const ls = lsRaw ? (JSON.parse(lsRaw) as Partial<SettingsState>) : null

        let firstName = (meta.first_name ?? ls?.firstName ?? "") as string
        let lastName = (meta.last_name ?? ls?.lastName ?? "") as string
        let agencyName = (meta.agency_name ?? ls?.agencyName ?? "") as string
        let city = (meta.city ?? ls?.city ?? "") as string
        let country = (meta.country ?? ls?.country ?? "") as string

        const { data: profile, error: profileError } = await supabaseClient
          .from("PROFILES")
          .select("first_name, last_name, agency_name, city, country")
          .eq("id", user.id)
          .maybeSingle()

        if (!profileError && profile) {
          firstName = profile.first_name ?? firstName
          lastName = profile.last_name ?? lastName
          agencyName = profile.agency_name ?? agencyName
          city = (profile.city ?? "") || city
          country = (profile.country ?? "") || country
        }

        setState((prev) => ({
          ...prev,
          firstName,
          lastName,
          agencyName,
          city,
          country,
          preferences: {
            language:
              (metaPrefs.language ?? ls?.preferences?.language ?? prev.preferences.language) === "en-US"
                ? "en-US"
                : "es-MX",
            timezone: (metaPrefs.timezone ?? ls?.preferences?.timezone ?? tz ?? prev.preferences.timezone) as string,
            density:
              (metaPrefs.density ?? ls?.preferences?.density ?? prev.preferences.density) === "compact"
                ? "compact"
                : "normal",
            reduceMotion: Boolean(metaPrefs.reduceMotion ?? ls?.preferences?.reduceMotion ?? prev.preferences.reduceMotion),
          },
          notifications: {
            renewals: Boolean(metaNotifs.renewals ?? ls?.notifications?.renewals ?? prev.notifications.renewals),
            payments: Boolean(metaNotifs.payments ?? ls?.notifications?.payments ?? prev.notifications.payments),
            productUpdates: Boolean(
              metaNotifs.productUpdates ?? ls?.notifications?.productUpdates ?? prev.notifications.productUpdates
            ),
          },
        }))
      } catch (error: unknown) {
        toast.error("No se pudieron cargar tus ajustes: " + getErrorMessage(error))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  useEffect(() => {
    const loadBilling = async () => {
      setBillingLoading(true)
      try {
        const response = await fetch("/api/billing/status", { cache: "no-store" })
        const json = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(json?.error || "No se pudo cargar billing")
        if (json?.billing) setBilling(json.billing as BillingState)
      } catch {
        setBilling({
          status: "free",
          has_pro_access: false,
          trial_ends_at: null,
          current_period_ends_at: null,
          cancel_at_period_end: false,
        })
      } finally {
        setBillingLoading(false)
      }
    }

    loadBilling()
  }, [])

  const agentLabel = useMemo(() => {
    const base = email?.split("@")?.[0] || "Agente"
    return base.toUpperCase()
  }, [email])

  const persistLocal = (next: SettingsState) => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      const { data: authData, error: authError } = await supabaseClient.auth.getUser()
      if (authError) throw authError
      if (!authData.user) throw new Error("Sesión expirada")
      const userId = authData.user.id

      const existing = (authData.user.user_metadata || {}) as UserMetadata
      const existingSettings = isPlainObject(existing.settings) ? existing.settings : {}
      const nextSettings = {
        ...existingSettings,
        preferences: { ...(isPlainObject(existingSettings.preferences) ? existingSettings.preferences : {}), ...state.preferences },
        notifications: {
          ...(isPlainObject(existingSettings.notifications) ? existingSettings.notifications : {}),
          ...state.notifications,
        },
      }
      const nextMeta = {
        ...existing,
        first_name: state.firstName,
        last_name: state.lastName,
        agency_name: state.agencyName,
        city: state.city.trim() || undefined,
        country: state.country.trim() || undefined,
        settings: nextSettings,
      }

      const { error: updateMetaError } = await supabaseClient.auth.updateUser({ data: nextMeta })
      if (updateMetaError) throw updateMetaError

      const { error: profileError } = await supabaseClient
        .from("PROFILES")
        .update({
          first_name: state.firstName,
          last_name: state.lastName,
          agency_name: state.agencyName,
          city: state.city.trim() || null,
          country: state.country.trim() || null,
        })
        .eq("id", userId)

      if (profileError) throw profileError

      persistLocal(state)
      toast.success("Cambios guardados correctamente")
    } catch {
      toast.error("Hubo un error al guardar los cambios. Por favor verifica la información e intenta nuevamente")
      try {
        persistLocal(state)
      } catch { }
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword?.trim()) {
      toast.error("Ingresa tu contraseña actual")
      return
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Las contraseñas no coinciden")
      return
    }
    const validation = validatePassword(newPassword)
    if (!validation.isValid) {
      toast.error(validation.message ?? "Contraseña no válida")
      return
    }

    setSavingPassword(true)
    try {
      const result = await changeUserPassword(currentPassword, newPassword)
      if (result.success) {
        setCurrentPassword("")
        setPassword("")
        setPassword2("")
        toast.success("Contraseña actualizada")
      } else {
        toast.error(result.error ?? "No se pudo actualizar la contraseña")
      }
    } catch (error: unknown) {
      toast.error("No se pudo actualizar la contraseña: " + getErrorMessage(error))
    } finally {
      setSavingPassword(false)
    }
  }

  // Handle account deletion
  const handleDeleteAccount = async () => {
    try {
      console.log('Starting account deletion process...');
      const result = await deleteUserAccount();

      if (result.success) {
        console.log('Account deletion completed successfully');
        // Redirect to home page after successful deletion
        router.push(`/login?code=account_deleted`);
      } else {
        console.error('Account deletion failed:', result.error);
      }
    } catch (error) {
      console.error('Unexpected error during account deletion:', error);
    }
  };

  const openCheckout = async () => {
    setBillingActionLoading(true)
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.url) {
        throw new Error(json?.error || "No se pudo abrir checkout")
      }
      window.location.href = String(json.url)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir checkout")
    } finally {
      setBillingActionLoading(false)
    }
  }

  const openPortal = async () => {
    setBillingActionLoading(true)
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.url) {
        throw new Error(json?.error || "No se pudo abrir el portal")
      }
      window.location.href = String(json.url)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir el portal")
    } finally {
      setBillingActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-black/30" size={42} />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <Toaster richColors position="top-center" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4" data-tutorial="settings-header">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-black rounded-2xl shadow-xl">
              <Settings2 className="text-(--accents)" size={26} />
            </div>
            <h2 className="text-4xl font-black text-black tracking-tighter italic uppercase">Configuración.</h2>
          </div>
          <p className="text-black/50 font-bold text-lg uppercase tracking-[0.4em] ml-1">
            Preferencias del workspace y perfil del agente
          </p>
        </div>

        <div className="flex items-center gap-3">
          <SectionTutorial
            steps={SETTINGS_TUTORIAL_STEPS}
            ariaLabel="Tutorial de la seccion configuracion"
            triggerClassName="inline-flex items-center gap-2 rounded-[2rem] border border-black/10 bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:bg-black hover:text-white"
          />
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-black text-white px-10 py-5 rounded-[2rem] font-black text-sm flex items-center gap-3 hover:bg-(--accents) transition-all shadow-2xl active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {saving ? "GUARDANDO" : "GUARDAR CAMBIOS"}
          </button>
        </div>
      </div>

      {/* IDENTIDAD / QUICK CARD */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm flex flex-col md:flex-row md:items-center gap-6"
      >
        <div className="w-14 h-14 bg-(--accents) rounded-[1.5rem] flex items-center justify-center text-white font-black shadow-lg">
          {email?.charAt(0).toUpperCase() || <UserIcon size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-black/30 uppercase tracking-[0.3em]">Agente activo</p>
          <p className="text-xl font-black text-black uppercase tracking-tighter truncate">
            {state.firstName || state.lastName ? `${state.firstName} ${state.lastName}`.trim() : agentLabel}
          </p>
          <p className="text-base font-bold text-black/40 truncate mt-1">{email || "—"}</p>
        </div>
        <div className="bg-black/5 rounded-3xl px-6 py-4 border border-black/5">
          <p className="text-[10px] font-black uppercase tracking-widest text-black/30">Agencia</p>
          <p className="text-sm font-black text-black uppercase tracking-tight">{state.agencyName || "SIN NOMBRE"}</p>
        </div>
      </motion.div>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PERFIL */}
        <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-10 space-y-8" data-tutorial="settings-profile">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-4 bg-gray-50 rounded-2xl text-black">
                <UserIcon size={20} />
              </div>
              <div>
                <p className="text-base font-black text-gray-400 uppercase tracking-widest">Perfil</p>
                <p className="text-xl font-black text-black italic">Datos del agente</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 text-(--accents) bg-(--accents)/10 px-4 py-2 rounded-full">
              <CheckCircle2 size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Sync</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-black text-black/40 uppercase tracking-widest block">Nombre</label>
              <input
                value={state.firstName}
                onChange={(e) => setState((s) => ({ ...s, firstName: e.target.value }))}
                placeholder="Mariano"
                className="w-full bg-[#ece7e2]/50 text-black font-black py-4 px-6 rounded-2xl outline-none border-2 border-transparent focus:border-(--accents)/30 transition-all uppercase"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black text-black/40 uppercase tracking-widest block">Apellido</label>
              <input
                value={state.lastName}
                onChange={(e) => setState((s) => ({ ...s, lastName: e.target.value }))}
                placeholder="Lara"
                className="w-full bg-[#ece7e2]/50 text-black font-black py-4 px-6 rounded-2xl outline-none border-2 border-transparent focus:border-(--accents)/30 transition-all uppercase"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-black text-black/40 uppercase tracking-widest block">Agencia</label>
              <input
                value={state.agencyName}
                onChange={(e) => setState((s) => ({ ...s, agencyName: e.target.value }))}
                placeholder="ASYGURARE"
                className="w-full bg-[#ece7e2]/50 text-black font-black py-4 px-6 rounded-2xl outline-none border-2 border-transparent focus:border-(--accents)/30 transition-all uppercase"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black text-black/40 uppercase tracking-widest block">Ciudad</label>
              <input
                value={state.city}
                onChange={(e) => setState((s) => ({ ...s, city: e.target.value }))}
                placeholder="Ciudad de México"
                className="w-full bg-[#ece7e2]/50 text-black font-black py-4 px-6 rounded-2xl outline-none border-2 border-transparent focus:border-(--accents)/30 transition-all uppercase"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black text-black/40 uppercase tracking-widest block">País</label>
              <input
                value={state.country}
                onChange={(e) => setState((s) => ({ ...s, country: e.target.value }))}
                placeholder="México"
                className="w-full bg-[#ece7e2]/50 text-black font-black py-4 px-6 rounded-2xl outline-none border-2 border-transparent focus:border-(--accents)/30 transition-all uppercase"
              />
            </div>
            <div className="md:col-span-2">
              <p className="text-[11px] font-bold text-black/40 leading-relaxed">
                Tu email se administra desde el sistema de autenticación. Para cambiarlo se requiere confirmación por correo.
              </p>
            </div>
          </div>
        </div>

        {/* PREFERENCIAS */}
        <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-10 space-y-8" data-tutorial="settings-preferences">
          <div className="flex items-center gap-3">
            <div className="p-4 bg-gray-50 rounded-2xl text-black">
              <Settings2 size={20} />
            </div>
            <div>
              <p className="text-base font-black text-gray-400 uppercase tracking-widest">Preferencias</p>
              <p className="text-xl font-black text-[rgb(170,170,170)] italic">Experiencia</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60">
            <div className="space-y-2">
              <label className="text-sm font-black text-black/40 uppercase tracking-widest block">Idioma</label>
              <select
                disabled
                value={state.preferences.language}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    preferences: { ...s.preferences, language: e.target.value === "en-US" ? "en-US" : "es-MX" },
                  }))
                }
                className="w-full bg-[#ece7e2]/50 text-black font-black py-4 px-6 rounded-2xl outline-none border-2 border-transparent focus:border-(--accents)/30 transition-all uppercase cursor-not-allowed"
              >
                <option value="es-MX">ESPAÑOL (MX)</option>
                <option value="en-US">ENGLISH (US)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black text-black/40 uppercase tracking-widest block">Densidad</label>
              <select
                disabled
                value={state.preferences.density}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    preferences: { ...s.preferences, density: e.target.value === "compact" ? "compact" : "normal" },
                  }))
                }
                className="w-full bg-[#ece7e2]/50 text-black font-black py-4 px-6 rounded-2xl outline-none border-2 border-transparent focus:border-(--accents)/30 transition-all uppercase cursor-not-allowed"
              >
                <option value="normal">NORMAL</option>
                <option value="compact">COMPACTO</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-black text-black/40 uppercase tracking-widest block">Zona horaria</label>
              <input
                disabled
                value={state.preferences.timezone}
                onChange={(e) => setState((s) => ({ ...s, preferences: { ...s.preferences, timezone: e.target.value } }))}
                placeholder="America/Mexico_City"
                className="w-full bg-[#ece7e2]/50 text-black font-black py-4 px-6 rounded-2xl outline-none border-2 border-transparent focus:border-(--accents)/30 transition-all cursor-not-allowed"
              />
              <p className="text-[11px] font-bold text-black/40 leading-relaxed mt-2">
                Esto se guarda para futuras automatizaciones (renovaciones, recordatorios, pagos).
              </p>
            </div>
          </div>

          {/* <div className="border-t border-black/5 pt-4">
            <Toggle
              checked={state.preferences.reduceMotion}
              onChange={(next) => setState((s) => ({ ...s, preferences: { ...s.preferences, reduceMotion: next } }))}
              label="Reducir animaciones"
              description="Ideal si quieres una interfaz más sobria o si tu equipo es lento."
            />
          </div> */}
        </div>

        {/* NOTIFICACIONES */}
        <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-10 space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-4 bg-gray-50 rounded-2xl text-black">
              <Bell size={20} />
            </div>
            <div>
              <p className="text-base font-black text-gray-400 uppercase tracking-widest">Notificaciones</p>
              <p className="text-xl font-black text-[rgb(170,170,170)] italic">Alertas del negocio</p>
            </div>
          </div>

          <div className="divide-y divide-black/5">
            <Toggle
              disabled
              checked={state.notifications.renewals}
              onChange={(next) => setState((s) => ({ ...s, notifications: { ...s.notifications, renewals: next } }))}
              label="Renovaciones"
              description="Avisos de pólizas por vencer y acciones de retención."
            />
            <Toggle
              disabled
              checked={state.notifications.payments}
              onChange={(next) => setState((s) => ({ ...s, notifications: { ...s.notifications, payments: next } }))}
              label="Pagos"
              description="Recordatorios de cobranza y confirmación de pagos."
            />
            <Toggle
              disabled
              checked={state.notifications.productUpdates}
              onChange={(next) =>
                setState((s) => ({ ...s, notifications: { ...s.notifications, productUpdates: next } }))
              }
              label="Actualizaciones del sistema"
              description="Mejoras y novedades de ASYGURARE."
            />
          </div>
        </div>

        {/* BILLING */}
        <div className="bg-white rounded-[2.5rem] border border-[#D4AF37]/35 shadow-sm p-10 space-y-8 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-20 -right-16 h-44 w-44 rounded-full bg-(--accents)/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-12 h-48 w-48 rounded-full bg-[#D4AF37]/20 blur-3xl" />
          <div className="flex items-center gap-3">
            <div className="p-4 bg-gradient-to-br from-[#F8E7A4] to-[#D4AF37] rounded-2xl text-black shadow-sm">
              <CreditCard size={20} />
            </div>
            <div>
              <p className="text-base font-black text-[#9A7A17] uppercase tracking-widest">Suscripción</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-black text-black italic">Plan Pro</p>
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#D4AF37] to-(--accents) px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
                  Premium
                </span>
              </div>
            </div>
          </div>

          {billingLoading ? (
            <div className="rounded-2xl border border-[#D4AF37]/35 bg-gradient-to-r from-[#FFF8DC] to-[#F8F6FF] p-5 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-[#9A7A17]" />
              <p className="text-sm font-bold text-[#614D12]">Cargando estado de suscripción...</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#D4AF37]/35 bg-gradient-to-r from-[#FFF8DC] to-[#F3EEFF] p-5 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-black uppercase tracking-widest text-[#6D5714]">Estado actual</p>
                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest bg-gradient-to-r from-(--accents) to-[#D4AF37] text-white shadow-sm">
                  <BadgeCheck size={14} />
                  {billing.status}
                </div>
              </div>
              {billing.trial_ends_at ? (
                <p className="text-sm font-bold text-[#5C4A14]">
                  Trial termina: {new Date(billing.trial_ends_at).toLocaleDateString("es-MX")}
                </p>
              ) : null}
              {billing.current_period_ends_at ? (
                <p className="text-sm font-bold text-[#5C4A14]">
                  Próximo corte: {new Date(billing.current_period_ends_at).toLocaleDateString("es-MX")}
                </p>
              ) : null}
              {billing.cancel_at_period_end ? (
                <p className="text-xs font-black uppercase tracking-widest text-[#8A5A00]">
                  Tu plan está programado para cancelarse al final del periodo actual.
                </p>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openCheckout}
              disabled={billingActionLoading || billing.has_pro_access}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-(--accents) to-[#D4AF37] text-white text-[11px] font-black uppercase tracking-widest shadow-md hover:brightness-105 transition-all disabled:opacity-50"
            >
              {billing.has_pro_access ? "Plan activo" : "Iniciar Pro + trial 15 días"}
            </button>
            <button
              type="button"
              onClick={openPortal}
              disabled={billingActionLoading || !billing.has_pro_access}
              className="px-5 py-3 rounded-2xl border border-[#D4AF37]/50 bg-white text-[11px] text-[#6A5416] font-black uppercase tracking-widest hover:bg-[#FFF8E8] transition-all disabled:opacity-50"
            >
              Administrar suscripción
            </button>
          </div>
        </div>

        {/* SEGURIDAD */}
        <div className="bg-white rounded-[2.5rem] border-2 border-red-200 shadow-sm p-10 space-y-8" data-tutorial="settings-security">
          <div className="flex items-center gap-3">
            <div className="p-4 bg-red-50 rounded-2xl text-red-600">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-base font-black text-red-600 uppercase tracking-widest">Seguridad</p>
              <p className="text-xl font-black text-black italic">Credenciales</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-black text-black/40 uppercase tracking-widest block">Contraseña actual</label>
              <div className="relative">
                <KeyRound className="absolute left-5 top-1/2 -translate-y-1/2 text-black/30" size={18} />
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#ece7e2]/50 text-black font-black py-4 pl-14 pr-12 rounded-2xl outline-none border-2 border-transparent focus:border-(--accents)/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-black/40 hover:text-black transition-colors cursor-pointer"
                  aria-label={showCurrentPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black text-black/40 uppercase tracking-widest block">Nueva contraseña</label>
              <div className="relative">
                <KeyRound className="absolute left-5 top-1/2 -translate-y-1/2 text-black/30" size={18} />
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#ece7e2]/50 text-black font-black py-4 pl-14 pr-12 rounded-2xl outline-none border-2 border-transparent focus:border-(--accents)/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-black/40 hover:text-black transition-colors cursor-pointer"
                  aria-label={showNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-sm font-bold text-black/40 leading-relaxed">
                {SITE_CONFIG.PASSWORD_RULES_TEXT}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black text-black/40 uppercase tracking-widest block">Confirmar contraseña</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmNewPassword}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#ece7e2]/50 text-black font-black py-4 pl-6 pr-12 rounded-2xl outline-none border-2 border-transparent focus:border-(--accents)/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-black/40 hover:text-black transition-colors cursor-pointer"
                  aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="w-full bg-(--accents) text-white py-5 rounded-[2rem] font-black text-sm flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-xl active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {savingPassword ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
              {savingPassword ? "ACTUALIZANDO" : "ACTUALIZAR CONTRASEÑA"}
            </button>
          </form>

          {/* Eliminar cuenta - Danger zone */}
          <div className="pt-6 border-t border-red-200">
            <div className="bg-red-50/80 rounded-2xl border border-red-200 p-6 space-y-4">
              <p className="text-sm font-black text-black uppercase tracking-widest">Eliminar cuenta</p>
              <p className="text-sm font-bold text-red-600/80 leading-relaxed">
                Esta acción es permanente. Se borrarán todos tus datos, pólizas y historial asociado a esta cuenta. No podrás recuperar el acceso ni la información.
              </p>
              <button
                type="button"
                className="w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest border-2 border-red-200 text-red-600 hover:bg-red-50 transition-all active:scale-[0.98] cursor-pointer"
                onClick={handleDeleteAccount}
              >
                Eliminar cuenta
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

