"use client"

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DATABASE } from '@/config'
import { Send, Loader2, Sparkles, Zap, ShieldCheck, TrendingUp, User } from 'lucide-react'
import { supabase } from '@/lib/supabase/supabase'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatDatamara({ conversationId, userId }: { conversationId: string, userId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadHistory = async () => {
      const { data } = await supabase
        .from(DATABASE.TABLES.WS_IA_MESSAGES)
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (data) setMessages(data as Message[])
    }
    loadHistory()
  }, [conversationId])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMsg = input.trim()
    const isFirstMessage = messages.length === 0 // Detectamos si es el inicio

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          user_id: userId,
          conversation_id: conversationId, // Usando la prop correctamente
        })
      })

      const data = await res.json()
      
      if (data.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }])

        // --- LÓGICA DE RENOMBRADO AUTOMÁTICO ---
        // Si es el primer mensaje, actualizamos el título de la conversación
        if (isFirstMessage) {
          const newTitle = userMsg.length > 30 
            ? userMsg.substring(0, 30).toUpperCase() + "..." 
            : userMsg.toUpperCase();

          await supabase
            .from(DATABASE.TABLES.WS_IA_CONVERSATIONS)
            .update({ title: newTitle })
            .eq('id', conversationId);
            
          // Nota: Para que el Sidebar se entere del cambio de nombre al instante,
          // lo ideal sería pasarle una función 'refresh' por props al componente.
        }
      }
    } catch (err) {
      console.error("Error en chat UI:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#f8f6f4] rounded-[3rem] border border-black/[0.08] shadow-2xl overflow-hidden relative">
      
      {/* HEADER DINÁMICO */}
      <header className="p-6 bg-white border-b border-black/[0.05] flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-(--accents) blur-lg opacity-40 animate-pulse" />
            <div className="relative w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-(--accents)">
              <Zap size={20} fill="currentColor" />
            </div>
          </div>
          <div>
            <h3 className="font-black text-lg tracking-tight italic uppercase leading-none">Gubot 2.5</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex h-2 w-2 rounded-full bg-green-500" />
              <p className="text-[9px] font-black text-black/40 uppercase tracking-widest">Sincronizado con Cartera Real</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
            <div className="hidden sm:flex flex-col items-end">
                <p className="text-[8px] font-black text-black/30 uppercase tracking-widest">Latencia IA</p>
                <p className="text-[10px] font-bold">142ms</p>
            </div>
        </div>
      </header>

      {/* ÁREA DE CHAT CON GRADIENTE */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 custom-scrollbar relative bg-gradient-to-b from-transparent to-black/[0.02]">
        
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-center space-y-6">
                <div className="bg-white p-8 rounded-[3rem] border border-black/5 shadow-sm max-w-sm">
                    <Sparkles className="text-(--accents) mx-auto mb-4" size={32} />
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-black">Inicia el análisis</p>
                    <p className="text-xs text-black/40 mt-2 font-bold leading-relaxed">Prueba con: "¿Cómo está mi siniestralidad este mes?" o "Resumen de leads pendientes".</p>
                </div>
            </motion.div>
          )}

          {messages.map((m, i) => (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              key={i}
              className={`flex items-start gap-4 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar Icon */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-2 ${m.role === 'user' ? 'bg-black text-white' : 'bg-(--accents) text-black'}`}>
                {m.role === 'user' ? <User size={14} /> : <Zap size={14} fill="currentColor" />}
              </div>

              {/* Burbuja */}
              <div className={`relative p-6 rounded-[2.5rem] text-sm leading-relaxed shadow-sm max-w-[85%] sm:max-w-[70%] font-medium ${
                m.role === 'user' 
                ? 'bg-black text-white rounded-tr-none' 
                : 'bg-white text-black border border-black/5 rounded-tl-none'
              }`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                
                {/* Timestamp sutil */}
                <span className={`text-[8px] absolute bottom-[-18px] font-black uppercase tracking-widest ${m.role === 'user' ? 'right-2 text-black/20' : 'left-2 text-black/20'}`}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start items-center gap-4">
            <div className="w-8 h-8 rounded-xl bg-(--accents) text-black flex items-center justify-center">
              <Loader2 className="animate-spin" size={14} />
            </div>
            <div className="bg-white px-6 py-4 rounded-[2rem] rounded-tl-none border border-black/5 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Consultando Red Neuronal...</span>
            </div>
          </motion.div>
        )}
        <div ref={scrollRef} className="h-4" />
      </div>

      {/* INPUT CON ÁREA TÉCNICA */}
      <div className="p-6 bg-white border-t border-black/[0.05]">
        <div className="max-w-3xl mx-auto relative group">
          <form onSubmit={sendMessage} className="relative flex items-center">
            <div className="absolute left-6 text-black/20 group-focus-within:text-(--accents) transition-colors">
              <Sparkles size={18} />
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ordena una acción estratégica..."
              className="w-full bg-[#f8f6f4] py-6 pl-16 pr-20 rounded-[2rem] font-bold text-black outline-none focus:ring-4 focus:ring-(--accents)/10 transition-all text-xs border border-transparent focus:border-black/5"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-3 p-4 bg-black text-(--accents) rounded-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-20 shadow-lg"
            >
              <Send size={18} />
            </button>
          </form>
          
          <div className="flex justify-between px-6 mt-4">
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-[8px] font-black text-black/20 uppercase tracking-widest">
                <ShieldCheck size={10} /> Datos Cifrados
              </div>
              <div className="flex items-center gap-1.5 text-[8px] font-black text-black/20 uppercase tracking-widest">
                <TrendingUp size={10} /> Optimización Activa
              </div>
            </div>
            <span className="text-[8px] font-black text-black/20 uppercase tracking-widest">
              Engine: Asygurare 
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}