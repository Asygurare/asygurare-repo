"use client"

import React, { useState, useEffect } from 'react'
import { Plus, MessageSquare, Trash2, Clock, Check, Edit2, X } from 'lucide-react'
import { supabaseClient } from '@/src/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { DATABASE } from '@/src/config'

export default function SidebarConversaciones({ 
  userId, 
  onSelectChat, 
  activeChatId 
}: { 
  userId: string, 
  onSelectChat: (id: string) => void,
  activeChatId: string | null 
}) {
  const [conversations, setConversations] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")

  useEffect(() => {
    fetchConversations()
  }, [userId])

  const fetchConversations = async () => {
    const { data } = await supabaseClient
      .from(DATABASE.TABLES.WS_IA_CONVERSATIONS)
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    if (data) setConversations(data)
  }

  const createNewChat = async () => {
    const { data } = await supabaseClient
      .from(DATABASE.TABLES.WS_IA_CONVERSATIONS)
      .insert([{ user_id: userId, title: 'NUEVA CONSULTA' }])
      .select().single()

    if (data) {
      setConversations([data, ...conversations])
      onSelectChat(data.id)
    }
  }

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const confirm = window.confirm("¿Estás seguro de eliminar este análisis?")
    if (!confirm) return

    const { error } = await supabaseClient.from(DATABASE.TABLES.WS_IA_CONVERSATIONS).delete().eq('id', id)
    if (!error) {
      setConversations(conversations.filter(c => c.id !== id))
      if (activeChatId === id) onSelectChat("")
    }
  }

  const startEditing = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(id)
    setEditTitle(title)
  }

  const saveTitle = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!editTitle.trim()) return

    const { error } = await supabaseClient
      .from(DATABASE.TABLES.WS_IA_CONVERSATIONS)
      .update({ title: editTitle.toUpperCase() })
      .eq('id', id)

    if (!error) {
      setConversations(conversations.map(c => c.id === id ? { ...c, title: editTitle.toUpperCase() } : c))
      setEditingId(null)
    }
  }

  return (
    <div className="w-80 h-full bg-white rounded-[3rem] p-6 flex flex-col border border-black/5 shadow-xl">
      <button 
        onClick={createNewChat}
        className="w-full bg-black text-(--accents) p-5 rounded-2xl font-black text-xs flex items-center justify-center gap-3 hover:scale-[1.02] transition-all mb-8 shadow-xl shadow-black/10"
      >
        <Plus size={18} /> NUEVA CONSULTA IA
      </button>

      <div className="flex items-center gap-2 mb-6 px-2 text-black/20">
        <Clock size={14} />
        <span className="text-[10px] font-black uppercase tracking-widest">Historial Reciente</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        <AnimatePresence>
          {conversations.map((chat) => (
            <motion.div
              layout
              key={chat.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => onSelectChat(chat.id)}
              className={`group p-4 rounded-2xl cursor-pointer transition-all border ${
                activeChatId === chat.id 
                ? 'bg-black text-white border-black' 
                : 'bg-[#ece7e2]/30 border-transparent text-black hover:bg-[#ece7e2]/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  <MessageSquare size={14} className={activeChatId === chat.id ? 'text-(--accents)' : 'text-black/20'} />
                  
                  {editingId === chat.id ? (
                    <input 
                      autoFocus
                      className="bg-transparent border-b border-(--accents) outline-none text-[11px] font-bold uppercase w-full"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveTitle(chat.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <p className="text-[11px] font-bold uppercase truncate tracking-tight">
                      {chat.title}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {editingId === chat.id ? (
                    <button onClick={(e) => saveTitle(chat.id, e)} className="p-1 hover:text-green-500"><Check size={14}/></button>
                  ) : (
                    <>
                      <button onClick={(e) => startEditing(chat.id, chat.title, e)} className="p-1 hover:text-(--accents)"><Edit2 size={12}/></button>
                      <button onClick={(e) => deleteConversation(chat.id, e)} className="p-1 hover:text-red-500"><Trash2 size={12}/></button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}