"use client"

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DATABASE } from '@/src/config'
import { Send, Loader2, Sparkles, Zap, ShieldCheck, TrendingUp, User } from 'lucide-react'
import { supabaseClient } from '@/src/lib/supabase/client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Image from 'next/image'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function ChatMarkdown({
  content,
  variant,
}: {
  content: string
  variant: 'user' | 'assistant'
}) {
  const isUser = variant === 'user'
  const linkClass = isUser ? 'text-(--accents) underline underline-offset-4' : 'text-blue-600 underline underline-offset-4'
  const codeClass = isUser ? 'bg-white/10 text-white' : 'bg-black/5 text-black'
  const preClass = isUser ? 'bg-white/10 text-white' : 'bg-black/5 text-black'

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      // Seguridad: no habilitamos HTML crudo (rehypeRaw)
      components={{
        p: ({ children }) => <p className="whitespace-pre-wrap leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-black">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={linkClass}
          >
            {children}
          </a>
        ),
        ul: ({ children }) => <ul className="mt-2 ml-5 list-disc space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="mt-2 ml-5 list-decimal space-y-1">{children}</ol>,
        li: ({ children }) => <li className="whitespace-pre-wrap">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className={`mt-2 border-l-2 pl-4 ${isUser ? 'border-white/30 text-white/90' : 'border-black/20 text-black/80'}`}>
            {children}
          </blockquote>
        ),
        hr: () => <hr className={`my-4 ${isUser ? 'border-white/15' : 'border-black/10'}`} />,
        code: ({ children, className }) => {
          const isBlock = Boolean(className)
          if (isBlock) return <code className="">{children}</code>
          return (
            <code className={`px-2 py-1 rounded-lg text-[12px] font-mono ${codeClass}`}>
              {children}
            </code>
          )
        },
        pre: ({ children }) => (
          <pre className={`mt-3 p-4 rounded-2xl overflow-x-auto text-[12px] font-mono ${preClass}`}>
            {children}
          </pre>
        ),
        h1: ({ children }) => <h1 className="text-base font-black tracking-tight mt-3">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-black tracking-tight mt-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-extrabold tracking-tight mt-3">{children}</h3>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export default function ChatDatamara({ conversationId, userId }: { conversationId: string, userId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadHistory = async () => {
      const { data } = await supabaseClient
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
        credentials: 'include',
        body: JSON.stringify({
          message: userMsg,
          user_id: userId,
          conversation_id: conversationId, // Usando la prop correctamente
          client_now: new Date().toISOString(),
          client_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      })

      const contentType = res.headers.get('content-type') || ''

      // Caso típico cuando middleware redirige a /login: fetch sigue el redirect y regresa HTML (no JSON)
      if (!contentType.includes('application/json')) {
        const txt = await res.text()
        const looksLikeLogin = res.redirected || res.url.includes('/login') || txt.includes('/login')
        const msg = looksLikeLogin
          ? 'Tu sesión expiró. Vuelve a iniciar sesión y reintenta.'
          : `No pude leer la respuesta del servidor (status ${res.status}).`
        setMessages(prev => [...prev, { role: 'assistant', content: msg }])
        return
      }

      const data = await res.json()

      if (!res.ok) {
        const errMsg = (data?.error ? String(data.error) : `Error del servidor (status ${res.status}).`)
        setMessages(prev => [...prev, { role: 'assistant', content: errMsg }])
        return
      }

      if (data?.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: String(data.response) }])

        // --- LÓGICA DE RENOMBRADO AUTOMÁTICO ---
        // Si es el primer mensaje, actualizamos el título de la conversación
        if (isFirstMessage) {
          const newTitle = userMsg.length > 30 
            ? userMsg.substring(0, 30).toUpperCase() + "..." 
            : userMsg.toUpperCase();

          await supabaseClient
            .from(DATABASE.TABLES.WS_IA_CONVERSATIONS)
            .update({ title: newTitle })
            .eq('id', conversationId);
            
          // Nota: Para que el Sidebar se entere del cambio de nombre al instante,
          // lo ideal sería pasarle una función 'refresh' por props al componente.
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'No recibí respuesta. Reintenta.' }])
      }
    } catch (err) {
      console.error("Error en chat UI:", err)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de red al enviar el mensaje. Reintenta.' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#f8f6f4] rounded-[2rem] sm:rounded-[3rem] border border-black/[0.08] shadow-2xl overflow-hidden relative">
      
      {/* HEADER DINÁMICO */}
      <header className="p-4 sm:p-6 bg-white border-b border-black/[0.05] flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-(--accents) blur-lg opacity-40 animate-pulse" />
            <div className="relative w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-2xl flex items-center justify-center text-(--accents)">
            <Image src="/avatar/avatar.png" alt="logo" width={44} height={44} />
            </div>
          </div>
          <div>
            <h3 className="font-black text-lg tracking-tight italic uppercase leading-none"></h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex h-2 w-2 rounded-full bg-green-500" />
              <p className="text-[9px] font-black text-black/40 uppercase tracking-widest">Tu asesor personal</p>
            </div>
          </div>
        </div>
      </header>

      {/* ÁREA DE CHAT CON GRADIENTE */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 space-y-6 sm:space-y-8 custom-scrollbar relative bg-gradient-to-b from-transparent to-black/[0.02]">
        
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-center space-y-6">
                <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-black/5 shadow-sm max-w-sm">
                    <Sparkles className="text-(--accents) mx-auto mb-4" size={32} />
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-black">Inicia la conversación</p>
                    <p className="text-xs text-black/40 mt-2 font-bold leading-relaxed">Prueba con: "¿Cómo me preparo para una reunión con un prospecto?" o "Resumen de leads pendientes".</p>
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
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 mt-2 ${m.role === 'user' ? 'bg-black text-white' : 'bg-white text-black'}`}>
                {m.role === 'user' ? <User size={14} /> : <Image src="/avatar/avatar.png" alt="logo" width={44} height={44} />}
              </div>

              {/* Burbuja */}
              <div className={`relative p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] text-[13px] sm:text-sm leading-relaxed shadow-sm max-w-[92%] sm:max-w-[70%] font-medium ${
                m.role === 'user' 
                ? 'bg-black text-white rounded-tr-none' 
                : 'bg-white text-black border border-black/5 rounded-tl-none'
              }`}>
                <div className="space-y-2">
                  <ChatMarkdown content={m.content} variant={m.role} />
                </div>
                
                {/* Timestamp sutil */}
                <span className={`hidden sm:inline text-[8px] absolute bottom-[-18px] font-black uppercase tracking-widest ${m.role === 'user' ? 'right-2 text-black/20' : 'left-2 text-black/20'}`}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start items-center gap-4">
            <div className="w-8 h-8 rounded-xl bg-black text-black flex items-center justify-center">
              <Loader2 className="animate-spin text-white" size={14} />
            </div>
            <div className="bg-white px-6 py-4 rounded-[2rem] rounded-tl-none border border-black/5 shadow-sm">
              <span className="text-[10px] text-black font-black uppercase tracking-widest animate-pulse">Escribiendo...</span>
            </div>
          </motion.div>
        )}
        <div ref={scrollRef} className="h-4" />
      </div>

      {/* INPUT CON ÁREA TÉCNICA */}
      <div className="p-4 sm:p-6 bg-white border-t border-black/[0.05]">
        <div className="max-w-3xl mx-auto relative group">
          <form onSubmit={sendMessage} className="relative flex items-center">
            <div className="absolute left-4 sm:left-6 text-black/20 group-focus-within:text-(--accents) transition-colors">
              <Sparkles size={18} />
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ordena una acción estratégica..."
              className="w-full bg-[#f8f6f4] py-4 sm:py-6 pl-14 sm:pl-16 pr-16 sm:pr-20 rounded-[1.5rem] sm:rounded-[2rem] font-bold text-black outline-none focus:ring-4 focus:ring-(--accents)/10 transition-all text-xs border border-transparent focus:border-black/5"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 sm:right-3 p-3 sm:p-4 bg-black text-(--accents) rounded-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-20 shadow-lg"
            >
              <Send size={18} />
            </button>
          </form>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-2 sm:px-6 mt-4 gap-3">
            <div className="flex gap-4 flex-wrap">
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