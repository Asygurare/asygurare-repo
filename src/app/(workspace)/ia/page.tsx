"use client"

import React, { useState, useEffect } from 'react'
import SidebarConversaciones from '@/src/components/workspace/chat/SidebarConversaciones'
import ChatDatamara from '@/src/components/workspace/chat/ChatGuros'
import { supabaseClient } from '@/src/lib/supabase/client'
import { BrainCircuit, PanelLeft, X } from 'lucide-react'
import Image from 'next/image'

export default function IASectorPage() {
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isDesktopSidebarHidden, setIsDesktopSidebarHidden] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabaseClient.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  if (!user) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* HEADER DE SECCIÓN */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-transparent rounded-2xl shadow-xl">
              <BrainCircuit className="text-(--accents)" size={28} />
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-black tracking-tighter uppercase">GUROS IA.</h2>
          </div>
          <p className="text-black/50 font-bold text-[10px] uppercase tracking-[0.4em] ml-1">
            Tu copiloto. El asesor del asesor.
          </p>
        </div>

        {/* METRICA RAPIDA DE IA */}
        <div className="flex items-center gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden bg-white px-4 py-3 rounded-2xl border border-black/5 flex items-center gap-2 shadow-sm text-[10px] font-black uppercase tracking-widest text-black/70 hover:text-black transition-colors"
              aria-label="Abrir historial de conversaciones"
            >
              <PanelLeft size={16} className="text-(--accents)" />
              Historial
            </button>

            <button
              type="button"
              onClick={() => setIsDesktopSidebarHidden((prev) => !prev)}
              className="hidden lg:flex bg-white px-4 py-3 rounded-2xl border border-black/5 items-center gap-2 shadow-sm text-[10px] font-black uppercase tracking-widest text-black/70 hover:text-black transition-colors"
              aria-label={isDesktopSidebarHidden ? 'Mostrar historial de conversaciones' : 'Ocultar historial de conversaciones'}
            >
              <PanelLeft size={16} className="text-(--accents)" />
              {isDesktopSidebarHidden ? 'Mostrar historial' : 'Ocultar historial'}
            </button>

            <div className="hidden md:flex gap-4">
            <div className="bg-white px-6 py-4 rounded-3xl border border-black/5 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] text-black font-black uppercase tracking-widest">Copiloto de operación y ventas</span>
            </div>
            </div>
        </div>
      </div>

      {/* CONTENEDOR DEL WORKSPACE DE IA */}
      <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100dvh-250px)] lg:min-h-[600px] min-h-0">

        {/* Sidebar (Desktop) */}
        {!isDesktopSidebarHidden && (
          <div className="hidden lg:block w-full lg:w-80 flex-shrink-0">
            <SidebarConversaciones
              userId={user.id}
              activeChatId={activeChatId}
              onSelectChat={(id) => setActiveChatId(id)}
            />
          </div>
        )}

        {/* Sidebar (Mobile Drawer) */}
        <div
          className={[
            'fixed inset-0 z-50 lg:hidden',
            isMobileSidebarOpen ? 'pointer-events-auto' : 'pointer-events-none',
          ].join(' ')}
          aria-hidden={!isMobileSidebarOpen}
        >
          <div
            className={[
              'absolute inset-0 bg-black/40 transition-opacity duration-200',
              isMobileSidebarOpen ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
            onClick={() => setIsMobileSidebarOpen(false)}
          />

          <aside
            className={[
              'absolute inset-y-0 left-0 w-[22rem] max-w-[90vw] bg-(--bg) p-4 sm:p-6',
              'transition-transform duration-200 will-change-transform',
              isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
            ].join(' ')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-black/50">
                <PanelLeft size={16} className="text-(--accents)" />
                <span className="text-[10px] font-black uppercase tracking-widest">Conversaciones</span>
              </div>
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-black transition-colors"
                onClick={() => setIsMobileSidebarOpen(false)}
                aria-label="Cerrar historial"
              >
                <X size={18} />
              </button>
            </div>

            <div className="h-[calc(100dvh-5.5rem)]">
              <SidebarConversaciones
                userId={user.id}
                activeChatId={activeChatId}
                onSelectChat={(id) => {
                  setActiveChatId(id)
                  setIsMobileSidebarOpen(false)
                }}
              />
            </div>
          </aside>
        </div>

        {/* Lado Derecho: Interfaz de Chat */}
        <div className="flex-1 relative bg-white rounded-[2rem] sm:rounded-[3rem] border border-black/5 shadow-sm overflow-hidden flex flex-col min-h-[70dvh] lg:min-h-0">
          {activeChatId ? (
            <ChatDatamara conversationId={activeChatId} userId={user.id} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-12 bg-[#ece7e2]/20">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-(--accents) blur-3xl opacity-50 animate-pulse" />
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-transparent rounded-[2.5rem] flex items-center justify-center text-(--accents) shadow-2xl">
                    <Image src="/avatar/avatar.png" alt='' width={80} height={80}/>
                </div>
              </div>
              <h3 className="text-xl sm:text-3xl font-black text-black uppercase tracking-tighter">¿Cómo puedo ayudarte hoy?</h3>

              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 sm:mt-12 w-full max-w-md">
                
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}