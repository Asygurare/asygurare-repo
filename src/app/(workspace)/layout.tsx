"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard, Users, Target, Shield,
  CreditCard, Settings, BrainCircuit, CalendarDays, BarChart3,
  Cpu, Flag, X, ChevronDown,
  User2Icon,
  CpuIcon, FileText, Signature,
  Mail,
  Send,
  Link2
} from 'lucide-react'
import WorkspaceNavbar from '@/src/components/navbar/WorkspaceNavbar'
import Image from 'next/image'
import AgentOrb from '../../components/workspace/chat/AgentOrb'

const Avatar = <Image src="/avatar/avatar.png" alt='' width={80} height={80}/>
const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Flag, label: 'Mis metas', href: '/metas', comingSoon: false },
  { icon: Target, label: 'Prospectos', href: '/prospectos' },
  { icon: Users, label: 'Clientes', href: '/clientes' },
  { icon: Shield, label: 'Pólizas', href: '/polizas' },
  { icon: CreditCard, label: 'Pagos', href: '/pagos', hidden: true }, // omitido por el momento
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
  { icon: User2Icon, label: 'Soporte', href: '/soporte', comingSoon: false},
 


]

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isEmailMenuOpen, setIsEmailMenuOpen] = useState(pathname.startsWith('/email'))
  const previousPathnameRef = useRef(pathname)

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
        {menuItems.filter((item) => !(item as any).hidden).map((item) => {
          // Verificamos si es activo.
          // Usamos startsWith para que si estás en un chat específico, el botón siga resaltado
          const isActive = pathname.startsWith(item.href)

          if ((item as any).comingSoon) {
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

          const children = (item as any).children as Array<{ icon: any; label: string; href: string }> | undefined
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

      {/* Botón de Ajustes al final */}
      <div className="mt-auto pt-6 border-t border-black/5">
        <Link
          href="/settings"
          onClick={onNavigate}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm text-gray-400 hover:text-black transition-all"
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
      {showAgentOrb ? <AgentOrb /> : null}
    </div>
  )
}