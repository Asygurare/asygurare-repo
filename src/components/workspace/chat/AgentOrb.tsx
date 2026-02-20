"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Send, X } from "lucide-react"
import Image from "next/image"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { supabaseClient } from "@/src/lib/supabase/client"
import { DATABASE } from "@/src/config"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

export default function AgentOrb() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabaseClient.auth.getUser()
      setUserId(data.user?.id ?? null)
    }
    loadUser()
  }, [])

  useEffect(() => {
    if (!isOpen || !userId || conversationId) return
    const createConversation = async () => {
      const { data } = await supabaseClient
        .from(DATABASE.TABLES.WS_IA_CONVERSATIONS)
        .insert([{ user_id: userId, title: "ORB RAPIDO" }])
        .select("id")
        .single()

      if (data?.id) setConversationId(String(data.id))
    }
    createConversation()
  }, [isOpen, userId, conversationId])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !conversationId || !userId) return

    const userMsg = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMsg }])
    setIsLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: userMsg,
          user_id: userId,
          conversation_id: conversationId,
          client_now: new Date().toISOString(),
          client_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })

      const data = (await res.json().catch(() => ({}))) as { response?: string; error?: string }
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data?.error || `Error del servidor (${res.status})` },
        ])
        return
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: String(data?.response || "No recibí respuesta. Reintenta.") },
      ])
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error de red. Reintenta." }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[65]">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative w-16 h-16 rounded-full bg-white text-(--accents) shadow-2xl border-2 border-(--accents) hover:scale-105 transition-transform"
          aria-label="Abrir agente IA"
        >
          <span className="absolute inset-0 rounded-full bg-(--accents)/10 blur-xl group-hover:opacity-100 opacity-70 transition-opacity" />
          <span className="relative flex items-center justify-center w-full h-full">
            <Image src="/avatar/avatar.png" alt="Avatar IA" width={40} height={40} className="rounded-full" />
          </span>
        </button>
      ) : (
        <div className="w-[340px] max-w-[90vw] h-[480px] bg-white border border-black/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-black/5 bg-[#f8f6f4] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/avatar/avatar.png" alt="Avatar IA" width={18} height={18} className="rounded-full" />
              <p className="text-[11px] text-black font-black uppercase tracking-wider">Asygurare IA</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-black/40 hover:text-black transition-colors"
              aria-label="Cerrar agente IA"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#fcfbfa] custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center px-4">
                <p className="text-[12px] font-bold text-black/40">Haz una pregunta rápida o pide una acción.</p>
              </div>
            ) : null}

            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[90%] p-3 rounded-2xl text-[12px] leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto bg-black text-white rounded-tr-sm"
                    : "mr-auto bg-white border border-black/5 text-black rounded-tl-sm"
                }`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="whitespace-pre-wrap leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="ml-5 list-disc space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="whitespace-pre-wrap">{children}</li>,
                    strong: ({ children }) => <strong className="font-black">{children}</strong>,
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              </div>
            ))}

            {isLoading ? (
              <div className="max-w-[90%] p-3 rounded-2xl text-[12px] mr-auto bg-white border border-black/5 text-black rounded-tl-sm flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Pensando...
              </div>
            ) : null}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={sendMessage} className="p-3 border-t border-black/5 bg-white">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu instrucción..."
                className="w-full bg-[#f8f6f4] rounded-2xl py-3 pl-4 pr-12 text-[12px] text-black font-medium outline-none border border-transparent focus:border-black/10"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || !conversationId || !userId}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-black text-(--accents) disabled:opacity-30 flex items-center justify-center"
              >
                <Send size={14} />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
