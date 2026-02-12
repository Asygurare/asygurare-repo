"use client"
import React, { useEffect, useState } from 'react'
import { Bell, Search, User, LogOut, ChevronDown, Menu } from 'lucide-react'
import { supabaseClient } from '@/src/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

type WorkspaceNavbarProps = {
  onMenuClick?: () => void
}

export default function WorkspaceNavbar({ onMenuClick }: WorkspaceNavbarProps) {
  const [user, setUser] = useState<any>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabaseClient.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabaseClient.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="bg-white/70 backdrop-blur-xl border border-white rounded-[2.5rem] p-4 flex items-center justify-between shadow-sm mb-10">
      {/* BUSCADOR */}
      <div className="flex items-center gap-2">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="md:hidden p-4 text-black/30 hover:text-black transition-all"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
        )}

        <div className="relative w-96 hidden md:block ml-4">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-black/20" size={18} />
          <input 
            type="text" 
            placeholder="BUSCAR CLIENTE O PÓLIZA..."
            className="w-full bg-transparent py-3 pl-14 pr-6 rounded-2xl text-[10px] font-black uppercase tracking-widest text-black outline-none placeholder:text-black/20"
          />
        </div>
      </div>

      {/* ACCIONES */}
      <div className="flex items-center gap-4 pr-2">
        <button className="relative p-4 text-black/30 hover:text-black transition-all group">
          <Bell size={20} />
          <span className="absolute top-4 right-4 w-2 h-2 bg-(--accents) rounded-full border-2 border-white"></span>
        </button>

        <div className="h-8 w-[1px] bg-black/5 mx-2" />

        <div className="relative">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-3 bg-black hover:bg-(--accents) transition-all p-1.5 pr-6 rounded-2xl group"
          >
            <div className="w-10 h-10 bg-(--accents) rounded-xl flex items-center justify-center text-white border border-white/10 overflow-hidden font-black">
              {user?.email?.charAt(0).toUpperCase() || <User size={18} />}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-none">Agente</p>
              <p className="text-[11px] font-black text-white uppercase tracking-tighter truncate max-w-[100px]">
                {user?.email?.split('@')[0]}
              </p>
            </div>
            <ChevronDown size={14} className={`text-white/40 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isProfileOpen && (
              <>
                <div className="fixed inset-0 z-[999]" onClick={() => setIsProfileOpen(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute z-[999] right-0 mt-4 w-60 bg-white rounded-[2rem] shadow-2xl border border-black/5 p-6"
                >
                  <div className="pb-4 mb-4 border-b border-gray-50">
                    <p className="text-xs font-black text-black/20 uppercase tracking-widest mb-1">Sesión activa</p>
                    <p className="text-sm font-black truncate text-black">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { setIsProfileOpen(false); router.push('/settings') }}
                    className="w-full flex items-center gap-3 py-3 text-sm font-black uppercase tracking-widest text-black hover:bg-gray-50 rounded-xl transition-all cursor-pointer"
                  >
                    <User size={16} /> Mi perfil
                  </button>
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 py-3 text-sm font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer">
                    <LogOut size={16} /> Cerrar Sesión
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}