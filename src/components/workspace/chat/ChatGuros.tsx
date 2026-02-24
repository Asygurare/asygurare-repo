"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DATABASE } from '@/src/config'
import { Send, Loader2, Sparkles, ShieldCheck, TrendingUp, User, RotateCcw } from 'lucide-react'
import { supabaseClient } from '@/src/lib/supabase/client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Image from 'next/image'

interface Message {
  role: 'user' | 'assistant'
  content: string
  status?: 'ok' | 'error' | 'streaming'
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

async function consumeStream(
  response: Response,
  onTextDelta: (delta: string) => void,
  onToolStatus: (tool: string) => void,
  onDone: (fullText: string) => void,
  onError: (error: string) => void,
) {
  const reader = response.body?.getReader()
  if (!reader) { onError('No se pudo leer la respuesta.'); return }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    let eventType = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        const raw = line.slice(6)
        try {
          const data = JSON.parse(raw)
          if (eventType === 'text_delta' && data.delta) onTextDelta(data.delta)
          else if (eventType === 'tool_status' && data.tool) onToolStatus(data.tool)
          else if (eventType === 'done' && data.full_text) onDone(data.full_text)
          else if (eventType === 'error' && data.error) onError(data.error)
        } catch { /* skip malformed */ }
        eventType = ''
      }
    }
  }
}

export default function ChatDatamara({ conversationId, userId }: { conversationId: string, userId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [toolStatus, setToolStatus] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const queueRef = useRef<string[]>([])
  const processingRef = useRef(false)

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
  }, [messages, toolStatus])

  const processOneMessage = useCallback(async (userMsg: string) => {
    setIsLoading(true)
    setToolStatus(null)
    const isFirstMessage = messages.length === 0 && queueRef.current.length === 0

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMsg,
          user_id: userId,
          conversation_id: conversationId,
          client_now: new Date().toISOString(),
          client_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      })

      const contentType = res.headers.get('content-type') || ''

      if (contentType.includes('text/event-stream')) {
        setMessages(prev => [...prev, { role: 'assistant', content: '', status: 'streaming' }])

        await consumeStream(
          res,
          (delta) => {
            setToolStatus(null)
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant' && (last.status === 'streaming')) {
                updated[updated.length - 1] = { ...last, content: last.content + delta }
              }
              return updated
            })
          },
          (tool) => setToolStatus(tool),
          (fullText) => {
            setToolStatus(null)
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = { ...last, content: fullText, status: 'ok' }
              }
              return updated
            })
          },
          (error) => {
            setToolStatus(null)
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = { ...last, content: error, status: 'error' }
              }
              return updated
            })
          },
        )
      } else if (contentType.includes('application/json')) {
        const data = await res.json()
        if (!res.ok) {
          const looksLikeLogin = res.redirected || res.url.includes('/login')
          const errMsg = looksLikeLogin
            ? 'Tu sesión expiró. Vuelve a iniciar sesión y reintenta.'
            : (data?.error ? String(data.error) : `Error del servidor (status ${res.status}).`)
          setMessages(prev => [...prev, { role: 'assistant', content: errMsg, status: 'error' }])
          return
        }
        if (data?.response) {
          setMessages(prev => [...prev, { role: 'assistant', content: String(data.response), status: 'ok' }])
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: 'No recibí respuesta.', status: 'error' }])
        }
      } else {
        const txt = await res.text()
        const looksLikeLogin = res.redirected || res.url.includes('/login') || txt.includes('/login')
        const msg = looksLikeLogin
          ? 'Tu sesión expiró. Vuelve a iniciar sesión y reintenta.'
          : `No pude leer la respuesta del servidor (status ${res.status}).`
        setMessages(prev => [...prev, { role: 'assistant', content: msg, status: 'error' }])
        return
      }

      if (isFirstMessage) {
        const newTitle = userMsg.length > 30
          ? userMsg.substring(0, 30).toUpperCase() + "..."
          : userMsg.toUpperCase();

        await supabaseClient
          .from(DATABASE.TABLES.WS_IA_CONVERSATIONS)
          .update({ title: newTitle })
          .eq('id', conversationId);
      }
    } catch (err) {
      console.error("Error en chat UI:", err)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de red al enviar el mensaje.', status: 'error' }])
    } finally {
      setIsLoading(false)
      setToolStatus(null)
    }
  }, [conversationId, userId, messages.length])

  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true

    while (queueRef.current.length > 0) {
      const nextMsg = queueRef.current.shift()!
      await processOneMessage(nextMsg)
    }

    processingRef.current = false
  }, [processOneMessage])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])

    queueRef.current.push(userMsg)
    processQueue()
  }

  const retryLastMessage = useCallback(() => {
    setMessages(prev => {
      const lastAssistant = prev.length - 1
      if (lastAssistant < 1 || prev[lastAssistant]?.role !== 'assistant') return prev
      const lastUserIdx = lastAssistant - 1
      if (prev[lastUserIdx]?.role !== 'user') return prev

      const userMsg = prev[lastUserIdx].content
      const withoutLast = prev.slice(0, lastAssistant)

      queueRef.current.push(userMsg)
      setTimeout(() => processQueue(), 0)

      return withoutLast
    })
  }, [processQueue])

  return (
    <div className="flex flex-col h-full w-full bg-[#f8f6f4] rounded-[2rem] sm:rounded-[3rem] border border-black/[0.08] shadow-2xl overflow-hidden relative">
      
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

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 space-y-6 sm:space-y-8 custom-scrollbar relative bg-gradient-to-b from-transparent to-black/[0.02]">
        
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-center space-y-6">
                <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-black/5 shadow-sm max-w-sm">
                    <Sparkles className="text-(--accents) mx-auto mb-4" size={32} />
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-black">Inicia la conversación</p>
                    <p className="text-xs text-black/40 mt-2 font-bold leading-relaxed">Prueba con: &quot;¿Cómo me preparo para una reunión con un prospecto?&quot; o &quot;Resumen de leads pendientes&quot;.</p>
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
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 mt-2 ${m.role === 'user' ? 'bg-black text-white' : 'bg-white text-black'}`}>
                {m.role === 'user' ? <User size={14} /> : <Image src="/avatar/avatar.png" alt="logo" width={44} height={44} />}
              </div>

              <div className="flex flex-col gap-1 max-w-[92%] sm:max-w-[70%]">
                <div className={`relative p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] text-[13px] sm:text-sm leading-relaxed shadow-sm font-medium ${
                  m.role === 'user'
                  ? 'bg-black text-white rounded-tr-none'
                  : 'bg-white text-black border border-black/5 rounded-tl-none'
                }`}>
                  {m.content ? (
                    <div className="space-y-2">
                      <ChatMarkdown content={m.content} variant={m.role} />
                    </div>
                  ) : m.status === 'streaming' ? (
                    <span className="text-[10px] text-black/40 font-black uppercase tracking-widest animate-pulse">Pensando...</span>
                  ) : null}

                  <span className={`hidden sm:inline text-[8px] absolute bottom-[-18px] font-black uppercase tracking-widest ${m.role === 'user' ? 'right-2 text-black/20' : 'left-2 text-black/20'}`}>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {m.role === 'assistant' && m.status === 'error' && i === messages.length - 1 && !isLoading && (
                  <button
                    type="button"
                    onClick={retryLastMessage}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors ml-2 mt-1"
                  >
                    <RotateCcw size={12} />
                    Reintentar
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && !messages.some(m => m.status === 'streaming') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start items-center gap-4">
            <div className="w-8 h-8 rounded-xl bg-black text-black flex items-center justify-center">
              <Loader2 className="animate-spin text-white" size={14} />
            </div>
            <div className="bg-white px-6 py-4 rounded-[2rem] rounded-tl-none border border-black/5 shadow-sm">
              <span className="text-[10px] text-black font-black uppercase tracking-widest animate-pulse">Conectando...</span>
            </div>
          </motion.div>
        )}

        {toolStatus && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start items-center gap-4">
            <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center">
              <Loader2 className="animate-spin text-white" size={14} />
            </div>
            <div className="bg-white px-6 py-4 rounded-[2rem] rounded-tl-none border border-black/5 shadow-sm">
              <span className="text-[10px] text-black font-black uppercase tracking-widest animate-pulse">{toolStatus}...</span>
            </div>
          </motion.div>
        )}

        <div ref={scrollRef} className="h-4" />
      </div>

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
              disabled={!input.trim()}
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
