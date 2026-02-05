"use client"

import React from "react"
import { motion } from "framer-motion"
import { BarChart3 } from "lucide-react"

export default function AnalyticsPage() {

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-12 overflow-hidden relative"
      >
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-(--accents) blur-[90px] opacity-20" />

        <div className="flex items-center gap-3 mb-6">
          <div className="p-4 bg-black rounded-2xl shadow-xl">
            <BarChart3 className="text-(--accents)" size={26} />
          </div>
          <div>
            <p className="text-[10px] font-black text-black/30 uppercase tracking-[0.35em]">Workspace</p>
            <h2 className="text-4xl font-black text-black tracking-tighter italic uppercase">Analytics.</h2>
          </div>
        </div>

        <p className="text-black/50 font-bold text-sm leading-relaxed max-w-2xl">
          Estamos construyendo el tablero automático de todo tu ecosistema (primas, cartera, cobranza, actividad y más).
          Muy pronto tendrás reportes listos para compartir en un click.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
          <div className="p-8 rounded-[2.5rem] border border-black/5 bg-gray-50/60">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/30">01. Métricas clave</p>
            <p className="mt-3 font-black text-black">Primas, cobranza, renovaciones</p>
          </div>
          <div className="p-8 rounded-[2.5rem] border border-black/5 bg-gray-50/60">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/30">02. Reportes por cliente</p>
            <p className="mt-3 font-black text-black">Tablero personalizado</p>
          </div>
          <div className="p-8 rounded-[2.5rem] border border-black/5 bg-gray-50/60">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/30">03. Exportables</p>
            <p className="mt-3 font-black text-black">PDF / CSV / enlaces</p>
          </div>
        </div>

        <div className="mt-10 inline-flex items-center gap-3 px-6 py-4 rounded-[2rem] bg-black text-white font-black text-[10px] uppercase tracking-widest">
          Coming soon
          <span className="px-3 py-1 rounded-full bg-white/10 text-white/80">v1</span>
        </div>
      </motion.div>
    </div>
  )
}

