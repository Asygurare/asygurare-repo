"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, Users, Target, Shield, 
  CreditCard, Settings, BrainCircuit, CalendarDays, BarChart3
} from 'lucide-react'
import WorkspaceNavbar from '@/components/navbar/WorkspaceNavbar'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Target, label: 'Prospectos', href: '/prospectos' },
  { icon: Users, label: 'Clientes', href: '/clientes' },
  { icon: Shield, label: 'Pólizas', href: '/polizas' },
  { icon: CreditCard, label: 'Pagos', href: '/pagos' },
  { icon: CalendarDays, label: 'Calendario', href: '/calendario' },
  { icon: BarChart3, label: 'Analytics', href: '/analytics', comingSoon: true },
  { icon: BrainCircuit, label: 'Tu Asistente de IA', href: '/ia' }, // <-- NUEVA SECCIÓN
]

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  return (
    <div className="flex h-screen bg-(--bg)">
      {/* Sidebar Elegante (Fijo) */}
      <aside className="w-64 bg-white border-r border-black/5 p-6 flex flex-col shrink-0">
        <div className="mb-10 px-2">
          <h1 className="text-xl font-black tracking-tighter text-(--accents)">
            TECHGUROS<span className="text-black">.</span>
          </h1>
        </div>
        
        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => {
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
                  <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-black/5 text-gray-400">
                    Soon
                  </span>
                </div>
              )
            }

            return (
              <Link 
                key={item.href} 
                href={item.href} 
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
            className="flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm text-gray-400 hover:text-black transition-all"
          >
            <Settings size={20} />
            Configuración
          </Link>
        </div>
      </aside>

      {/* Área de Contenido Principal */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Renderizado del Navbar en la parte superior del contenido */}
        <div className="px-10 pt-10 pb-0 z-[999]">
          <WorkspaceNavbar />
        </div>
        
        {/* Contenido dinámico con scroll independiente */}
        <div className="flex-1 overflow-y-auto p-10 pt-4 custom-scrollbar">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}