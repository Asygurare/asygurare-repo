"use client"

import React, { useState, useEffect } from 'react'
import SidebarConversaciones from '@/src/components/workspace/chat/SidebarConversaciones'
import ChatDatamara from '@/src/components/workspace/chat/ChatGuros'
import { supabaseClient } from '@/src/lib/supabase/client'
import { Sparkles, BrainCircuit, Activity } from 'lucide-react'

export default function IASectorPage() {
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

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
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-transparent rounded-2xl shadow-xl">
              <BrainCircuit className="text-(--accents)" size={28} />
            </div>
            <h2 className="text-4xl font-black text-black tracking-tighter  uppercase">Tu Asistente de IA.</h2>
          </div>
          <p className="text-black/50 font-bold text-[10px] uppercase tracking-[0.4em] ml-1">
            Potenciado por Datamara
          </p>
        </div>

        {/* METRICA RAPIDA DE IA */}
        <div className="hidden md:flex gap-4">
            <div className="bg-white px-6 py-4 rounded-3xl border border-black/5 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] text-black font-black uppercase tracking-widest">Tu Copiloto de Seguros</span>
            </div>
        </div>
      </div>

      {/* CONTENEDOR DEL WORKSPACE DE IA */}
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-250px)] min-h-[600px]">
        
        {/* Lado Izquierdo: Historial (Sidebar especializado) */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <SidebarConversaciones 
            userId={user.id} 
            activeChatId={activeChatId} 
            onSelectChat={(id) => setActiveChatId(id)} 
          />
        </div>

        {/* Lado Derecho: Interfaz de Chat */}
        <div className="flex-1 relative bg-white rounded-[3rem] border border-black/5 shadow-sm overflow-hidden flex flex-col">
          {activeChatId ? (
            <ChatDatamara conversationId={activeChatId} userId={user.id} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#ece7e2]/20">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-(--accents) blur-3xl opacity-50 animate-pulse" />
                <div className="relative w-24 h-24 bg-transparent rounded-[2.5rem] flex items-center justify-center text-(--accents) shadow-2xl">
                    <BrainCircuit size={40} fill="currentColor" />
                </div>
              </div>
              <h3 className="text-3xl font-black text-black  uppercase tracking-tighter">¿Cómo puedo ayudarte hoy?</h3>

              
              <div className="grid grid-cols-2 gap-4 mt-12 w-full max-w-md">
                
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}