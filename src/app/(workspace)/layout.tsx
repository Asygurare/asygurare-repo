"use client"

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard, Users, Target, Shield,
  CreditCard, Settings, BrainCircuit, CalendarDays, BarChart3,
  Cpu, Flag, X, ChevronDown,
  User2Icon, UserPlus,
  FileText, Signature,
  Mail,
  Send,
  Link2,
  type LucideIcon,
  Loader2,
  Sparkles,
} from 'lucide-react'
import WorkspaceNavbar from '@/src/components/navbar/WorkspaceNavbar'
import Image from 'next/image'
import AgentOrb from '../../components/workspace/chat/AgentOrb'
import { supabaseClient } from '@/src/lib/supabase/client'
import {
  type SectionPermissions,
  type TeamRole,
  FULL_PERMISSIONS,
  HREF_TO_SECTION,
  parsePermissions,
} from '@/src/services/team/permissions'

type MenuChild = {
  icon: LucideIcon
  label: string
  href: string
}

type MenuItem = {
  icon: LucideIcon
  label: string
  href: string
  hidden?: boolean
  comingSoon?: boolean
  children?: MenuChild[]
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Flag, label: 'Mis metas', href: '/metas', comingSoon: false },
  { icon: Target, label: 'Prospectos', href: '/prospectos' },
  { icon: Users, label: 'Clientes', href: '/clientes' },
  { icon: Shield, label: 'Pólizas', href: '/polizas' },
  { icon: CreditCard, label: 'Pagos', href: '/pagos', hidden: true },
  { icon: CalendarDays, label: 'Calendario', href: '/calendario' },
  { icon: Cpu, label: 'Automatizar', href: '/automatizar' },
  {
    icon: Mail,
    label: 'Email',
    href: '/email',
    comingSoon: false,
    children: [
      { icon: Link2, label: 'Conecta tu email', href: '/email/conecta-tu-email' },
      { icon: Send, label: 'Enviar', href: '/email/enviar' },
      { icon: FileText, label: 'Mis plantillas', href: '/email/plantillas' },
      { icon: Signature, label: 'Firma electrónica', href: '/email/firma-electronica' },
    ],
  },
  { icon: BrainCircuit, label: 'Guros IA', href: '/ia' },
  { icon: BarChart3, label: 'Análisis', href: '/analytics', comingSoon: false },
  { icon: User2Icon, label: 'Soporte', href: '/soporte', comingSoon: false },
]

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isEmailMenuOpen, setIsEmailMenuOpen] = useState(pathname.startsWith('/email'))
  const previousPathnameRef = useRef(pathname)
  const [teamRole, setTeamRole] = useState<TeamRole>("owner")
  const [teamPermissions, setTeamPermissions] = useState<SectionPermissions>(FULL_PERMISSIONS)
  const [mandatoryTrialGateLoading, setMandatoryTrialGateLoading] = useState(true)
  const [requiresMandatoryTrialCheckout, setRequiresMandatoryTrialCheckout] = useState(false)
  const [mandatoryCheckoutLoading, setMandatoryCheckoutLoading] = useState(false)
  const [isVerifyingBilling, setIsVerifyingBilling] = useState(false)
  const [billingVerifyError, setBillingVerifyError] = useState<string | null>(null)

  const fetchTeamRole = useCallback(async () => {
    try {
      const res = await fetch("/api/team/status", { cache: "no-store" })
      if (!res.ok) return
      const json = await res.json()
      setTeamRole(json.role || "owner")
      setTeamPermissions(json.role === "member" ? parsePermissions(json.permissions) : FULL_PERMISSIONS)
    } catch {}
  }, [])

  useEffect(() => {
    fetchTeamRole()
  }, [fetchTeamRole])

  const refreshMandatoryTrialGate = useCallback(async () => {
    try {
      setMandatoryTrialGateLoading(true)

      const { data: authData } = await supabaseClient.auth.getUser()
      const user = authData.user
      if (!user) {
        setRequiresMandatoryTrialCheckout(false)
        return
      }

      const metadata = (user.user_metadata || {}) as Record<string, unknown>
      const requiresTrialCheckout = Boolean(metadata.trial_checkout_required)
      if (!requiresTrialCheckout) {
        setRequiresMandatoryTrialCheckout(false)
        return
      }

      const billingRes = await fetch("/api/billing/status", { cache: "no-store" })
      const billingJson = await billingRes.json().catch(() => ({}))
      const hasProAccess = Boolean(billingJson?.billing?.has_pro_access)

      setRequiresMandatoryTrialCheckout(!hasProAccess)
    } catch {
      setRequiresMandatoryTrialCheckout(false)
    } finally {
      setMandatoryTrialGateLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshMandatoryTrialGate()
  }, [refreshMandatoryTrialGate, pathname])

  useEffect(() => {
    const billingStatus = searchParams.get('billing')
    if (billingStatus !== 'success') return

    let cancelled = false
    let attempts = 0
    const maxAttempts = 10

    const verifyBilling = async () => {
      if (cancelled) return
      setIsVerifyingBilling(true)
      setBillingVerifyError(null)

      while (!cancelled && attempts < maxAttempts) {
        attempts += 1
        await refreshMandatoryTrialGate()

        const { data } = await supabaseClient.auth.getUser()
        const metadata = (data.user?.user_metadata || {}) as Record<string, unknown>

        const billingRes = await fetch('/api/billing/status', { cache: 'no-store' })
        const billingJson = await billingRes.json().catch(() => ({}))
        const hasProAccess = Boolean(billingJson?.billing?.has_pro_access)

        if (hasProAccess) {
          // Marca onboarding de checkout como completado en metadata.
          if (metadata.trial_checkout_required) {
            await supabaseClient.auth.updateUser({
              data: {
                ...metadata,
                trial_checkout_required: false,
              },
            })
          }

          if (!cancelled) {
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem('showAsygurareWelcomeModal', '1')
            }
            setIsVerifyingBilling(false)
            setBillingVerifyError(null)
            router.replace('/dashboard')
          }
          return
        }

        await new Promise((resolve) => setTimeout(resolve, 1500))
      }

      if (!cancelled) {
        setIsVerifyingBilling(false)
        setBillingVerifyError('Seguimos procesando tu activación. Reintenta en unos segundos.')
      }
    }

    verifyBilling()

    return () => {
      cancelled = true
    }
  }, [pathname, refreshMandatoryTrialGate, router, searchParams])

  const filteredMenuItems = menuItems.filter((item) => {
    if (item.hidden) return false
    if (teamRole === "owner") return true
    const section = HREF_TO_SECTION[item.href]
    if (!section) return true
    return teamPermissions[section] !== "none"
  })

  useEffect(() => {
    // Cierra el menú móvil solo cuando realmente cambia la ruta.
    if (previousPathnameRef.current !== pathname) {
      setIsMobileSidebarOpen(false)
      previousPathnameRef.current = pathname
    }
  }, [pathname])

  useEffect(() => {
    if (pathname.startsWith('/email')) setIsEmailMenuOpen(true)
  }, [pathname])

  useEffect(() => {
    if (!isMobileSidebarOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileSidebarOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMobileSidebarOpen])

  const showAgentOrb = !pathname.startsWith('/ia')

  const handleStartMandatoryCheckout = useCallback(async () => {
    setMandatoryCheckoutLoading(true)
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.url) {
        throw new Error(json?.error || "No se pudo iniciar el checkout")
      }
      window.location.href = String(json.url)
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : "No se pudo iniciar el checkout")
    } finally {
      setMandatoryCheckoutLoading(false)
    }
  }, [])

  const SidebarInner = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <Link href="/" className="flex items-center group mb-10" onClick={onNavigate}>
        <div className="w-8 h-8 bg-(--accents) rounded-lg flex items-center justify-center text-[#ece7e2] transition-transform group-hover:rotate-12">
          <Image src="/logo/logo.png" alt='logo' width={24} height={24} />
        </div>
        <div className=" px-2">
          <h1 className="text-xl font-black tracking-tighter text-(--accents)">
            ASYGURARE<span className="text-black">.</span>
          </h1>
        </div>
      </Link>

      <nav className="flex-1 space-y-2">
        {filteredMenuItems.map((item) => {
          // Verificamos si es activo.
          // Usamos startsWith para que si estás en un chat específico, el botón siga resaltado
          const isActive = pathname.startsWith(item.href)

          if (item.comingSoon) {
            return (
              <div
                key={item.href}
                className={`
                  flex items-center justify-between gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all
                  text-gray-300 bg-gray-50 border border-black/5 cursor-not-allowed select-none
                `}
                title="Coming soon"
              >
                <div className="flex items-center gap-3">
                  <item.icon size={20} />
                  {item.label}
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-(--accents)/50 text-white">
                  Soon
                </span>
              </div>
            )
          }

          const children = item.children
          if (children && children.length > 0) {
            return (
              <div key={item.href} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setIsEmailMenuOpen((prev) => !prev)}
                  className={`
                    w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all
                    ${isActive
                      ? 'bg-(--accents) text-white shadow-lg shadow-(--accents)/20'
                      : 'text-gray-400 hover:text-black hover:bg-gray-50'
                    }
                  `}
                >
                  <span className="flex items-center gap-3">
                    <item.icon size={20} />
                    {item.label}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${isEmailMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isEmailMenuOpen ? (
                  <div className="ml-4 pl-3 border-l border-black/10 space-y-1">
                    {children.map((child) => {
                      const isChildActive = pathname === child.href || pathname.startsWith(`${child.href}/`)
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onNavigate}
                          className={`
                            flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-[12px] transition-all
                            ${isChildActive
                              ? 'bg-black text-white'
                              : 'text-gray-500 hover:text-black hover:bg-gray-50'
                            }
                          `}
                        >
                          <child.icon size={14} />
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all
                ${isActive
                  ? 'bg-(--accents) text-white shadow-lg shadow-(--accents)/20'
                  : 'text-gray-400 hover:text-black hover:bg-gray-50'
                }
              `}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-6 border-t border-black/5 space-y-1">
        {teamRole === "owner" && (
          <Link
            href="/equipo"
            onClick={onNavigate}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
              pathname.startsWith('/equipo')
                ? 'bg-(--accents) text-white shadow-lg shadow-(--accents)/20'
                : 'text-gray-400 hover:text-black hover:bg-gray-50'
            }`}
          >
            <UserPlus size={20} />
            Mi equipo
          </Link>
        )}
        <Link
          href="/settings"
          onClick={onNavigate}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
            pathname.startsWith('/settings')
              ? 'bg-(--accents) text-white shadow-lg shadow-(--accents)/20'
              : 'text-gray-400 hover:text-black hover:bg-gray-50'
          }`}
        >
          <Settings size={20} />
          Configuración
        </Link>
      </div>
    </>
  )

  return (
    <div className="flex min-h-dvh bg-(--bg)">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-black/5 p-6 flex-col shrink-0">
        <SidebarInner />
      </aside>

      {/* Sidebar (Mobile Drawer) */}
      <div
        className={[
          'fixed inset-0 z-[70] md:hidden',
          isMobileSidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'
        ].join(' ')}
        aria-hidden={!isMobileSidebarOpen}
      >
        <div
          className={[
            'absolute inset-0 bg-black/40 transition-opacity duration-200',
            isMobileSidebarOpen ? 'opacity-100' : 'opacity-0'
          ].join(' ')}
          onClick={() => setIsMobileSidebarOpen(false)}
        />
        <aside
          className={[
            'absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white border-r border-black/5 p-6 flex flex-col',
            'transition-transform duration-200 will-change-transform',
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          ].join(' ')}
        >
          <button
            type="button"
            className="absolute right-4 top-4 p-2 text-gray-400 hover:text-black transition-colors"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
          <SidebarInner onNavigate={() => setIsMobileSidebarOpen(false)} />
        </aside>
      </div>

      {/* Área de Contenido Principal */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Renderizado del Navbar en la parte superior del contenido */}
        <div className="relative z-40 px-4 pt-4 pb-0 sm:px-6 sm:pt-6 lg:px-10 lg:pt-10">
          <WorkspaceNavbar onMenuClick={() => setIsMobileSidebarOpen(true)} />
        </div>

        {/* Contenido dinámico con scroll independiente */}
        <div className="flex-1 overflow-y-auto p-4 pt-2 sm:p-6 sm:pt-4 lg:p-10 lg:pt-4 custom-scrollbar">
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
      {showAgentOrb && !requiresMandatoryTrialCheckout ? <AgentOrb /> : null}

      {isVerifyingBilling ? (
        <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-md px-4 py-6 flex items-center justify-center">
          <div className="w-full max-w-xl rounded-[2.2rem] border border-white/20 bg-[#f7f4f0] shadow-2xl p-8 md:p-10 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-black text-white flex items-center justify-center shadow-lg">
              <Loader2 size={26} className="animate-spin" />
            </div>
            <p className="mt-5 text-[11px] font-black uppercase tracking-[0.25em] text-black/40">
              Activando tu cuenta
            </p>
            <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-black">
              Verificando suscripción
            </h2>
            <p className="mt-4 text-sm md:text-base font-bold text-black/60 leading-relaxed max-w-xl mx-auto">
              Estamos confirmando tu checkout con Stripe para desbloquear tu workspace.
              Esto tarda solo unos segundos.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-(--accents)/10 text-(--accents) px-4 py-2 text-[11px] font-black uppercase tracking-widest">
              <Sparkles size={14} />
              Preparando experiencia Pro
            </div>
          </div>
        </div>
      ) : null}

      {!mandatoryTrialGateLoading && requiresMandatoryTrialCheckout && !isVerifyingBilling ? (
        <div className="fixed inset-0 z-[140] bg-black/65 backdrop-blur-md px-4 py-6 flex items-center justify-center">
          <div className="w-full max-w-2xl rounded-[2.2rem] border border-white/20 bg-[#f7f4f0] shadow-2xl p-8 md:p-10 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-(--accents) text-white flex items-center justify-center shadow-lg">
              <CreditCard size={24} />
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.25em] text-black/40">
              Activacion obligatoria
            </p>
            <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-black">
              Empieza tu prueba gratis de 15 dias
            </h2>
            <p className="mt-4 text-sm md:text-base font-bold text-black/60 leading-relaxed max-w-xl mx-auto">
              Para usar la plataforma, necesitamos que actives tu prueba del plan Pro con tarjeta.
              No se te cobrara hoy; el primer cargo se realiza al finalizar los 15 dias de prueba.
              Puedes cancelar cuando quieras antes de esa fecha.
            </p>
            <button
              type="button"
              onClick={handleStartMandatoryCheckout}
              disabled={mandatoryCheckoutLoading}
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-[1.2rem] bg-black text-white px-8 py-4 text-sm font-black uppercase tracking-widest hover:bg-(--accents) transition-all disabled:opacity-60"
            >
              {mandatoryCheckoutLoading ? "Abriendo checkout..." : "Activar prueba gratis"}
            </button>
            {billingVerifyError ? (
              <p className="mt-4 text-xs font-bold text-black/50">{billingVerifyError}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}