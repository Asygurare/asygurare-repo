"use client"

import React from 'react'
import { motion } from 'framer-motion'
import { 
  Bot, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  PieChart, 
  ArrowUpRight, 
  Calendar,
  Zap
} from 'lucide-react'

const ease = [0.76, 0, 0.24, 1]

export default function TechDashboard() {
  return (
    <section className="px-7 py-24 bg-[#ece7e2]">
      <div className="max-w-7xl mx-auto">
        
        {/* Encabezado de la sección */}
        <div className="mb-16 text-center md:text-left">
          <h2 className="text-4xl md:text-5xl text-(--text) font-medium tracking-tight mb-4">
            Control total. <span className="text-(--accents)">Esfuerzo cero.</span>
          </h2>
          <p className="text-gray-600 max-w-xl">
            Tu centro de mando integra cada etapa del ciclo de vida del asegurado con automatización de grado bancario.
          </p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative bg-[#f9f7f5] rounded-[2.5rem] border border-white p-4 shadow-[0_32px_64px_-16px_rgba(74,119,102,0.1)] overflow-hidden"
        >
          {/* Main Interface Wrapper */}
          <div className="bg-[#fff] rounded-[1.8rem] w-full min-h-[700px] flex overflow-hidden border border-gray-100 shadow-inner">
            
            {/* 1. Sidebar Inteligente */}
            <div className="w-16 md:w-20 border-r border-gray-50 bg-[#fafafa] flex flex-col items-center py-10 gap-8">
              <div className="w-10 h-10 bg-[#4A7766] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#4A7766]/20">
                <Zap size={20} fill="currentColor" />
              </div>
              <nav className="flex flex-col gap-6 text-gray-400">
                <Users size={22} className="hover:text-[#4A7766] cursor-pointer transition-colors" />
                <PieChart size={22} className="hover:text-[#4A7766] cursor-pointer transition-colors" />
                <MessageSquare size={22} className="hover:text-[#4A7766] cursor-pointer transition-colors" />
                <Calendar size={22} className="hover:text-[#4A7766] cursor-pointer transition-colors" />
              </nav>
            </div>

            {/* 2. Área de Trabajo Principal */}
            <div className="flex-1 p-6 md:p-10 bg-[#fdfdfd] overflow-hidden">
              
              {/* Top Bar: Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: "Primas Emitidas", val: "$2.4M", inc: "+12%", color: "#4A7766" },
                  { label: "Leads Activos", val: "142", inc: "+5%", color: "#1a1a1a" },
                  { label: "Tasa de Cierre", val: "68%", inc: "+24%", color: "#4A7766" },
                  { label: "Renovaciones", val: "94%", inc: "+2%", color: "#1a1a1a" }
                ].map((stat, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={i} 
                    className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100"
                  >
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">{stat.label}</p>
                    <div className="flex justify-between items-end">
                      <span className="text-2xl font-semibold tracking-tight" style={{ color: stat.color }}>{stat.val}</span>
                      <span className="text-[10px] text-[#4A7766] font-bold flex items-center gap-0.5 bg-[#4A7766]/5 px-2 py-0.5 rounded-full">
                        <TrendingUp size={10} /> {stat.inc}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Middle Section: CRM + Reportes */}
              <div className="grid grid-cols-12 gap-6">
                
                {/* CRM Automatizado View */}
                <div className="col-span-12 lg:col-span-8 space-y-6">
                  <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="font-bold text-gray-800">Pipeline de Conversión Inteligente</h4>
                      <button className="text-[11px] font-bold text-[#4A7766] bg-[#4A7766]/10 px-3 py-1 rounded-lg">Ver todo el Funnel</button>
                    </div>
                    
                    <div className="space-y-4">
                      {[
                        { name: "Andrés Villaman", status: "Cierre Pendiente", score: 98, policy: "Vida Elite" },
                        { name: "Lucía Fernández", status: "Análisis de Riesgo", score: 72, policy: "Hogar Global" },
                        { name: "Corporativo Sky", status: "Primer Contacto", score: 45, policy: "Flotilla" }
                      ].map((lead, i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-gray-50 hover:border-[#4A7766]/30 transition-all cursor-pointer bg-[#fafafa]/50">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-200 to-gray-50 flex items-center justify-center font-bold text-xs">
                              {lead.name[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{lead.name}</p>
                              <p className="text-[11px] text-gray-400">{lead.policy}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-medium text-gray-500 mb-1">{lead.status}</p>
                            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                whileInView={{ width: `${lead.score}%` }}
                                className="h-full bg-[#4A7766]" 
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Reportes Rápidos */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                  <div className="flex-1 p-6 bg-[#1a1a1a] rounded-3xl text-white relative overflow-hidden">
                    <p className="text-xs opacity-60 mb-2 uppercase tracking-tighter">Proyección Mensual</p>
                    <h5 className="text-3xl font-light mb-6">Meta: <span className="text-[#4A7766] font-bold">115%</span></h5>
                    <div className="flex items-end gap-2 h-24">
                      {[40, 70, 50, 90, 60, 100, 80].map((h, i) => (
                        <motion.div 
                          key={i}
                          initial={{ height: 0 }}
                          whileInView={{ height: `${h}%` }}
                          transition={{ delay: i * 0.05 }}
                          className="flex-1 bg-[#4A7766] rounded-t-sm"
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-6 bg-[#4A7766]/5 rounded-3xl border border-[#4A7766]/10">
                    <div className="flex items-center gap-2 mb-4 text-[#4A7766]">
                      <MessageSquare size={16} />
                      <span className="text-xs font-bold uppercase">Chat Automatizado</span>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm text-[11px] text-gray-600 border border-gray-100">
                        "Enviando recordatorio de renovación a 14 clientes..."
                      </div>
                      <div className="bg-[#4A7766] text-white p-3 rounded-2xl rounded-tr-none shadow-sm text-[11px] ml-4">
                        "3 clientes ya confirmaron pago."
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* --- COPILOTO IA FLOATING (EL CEREBRO) --- */}
          <motion.div 
            style={{ x: "-50%" }}
            initial={{ y: 100, x: "-50%", opacity: 0 }}
            whileInView={{ y: 0, x: "-50%", opacity: 1 }}
            className="absolute bottom-8 left-1/2 w-[90%] md:w-[600px] bg-white/80 backdrop-blur-xl border border-white rounded-2xl p-5 shadow-2xl flex items-center gap-5"
          >
            <div className="relative">
              <div className="w-12 h-12 bg-[#4A7766] rounded-full flex items-center justify-center animate-pulse">
                <Bot size={24} className="text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-xs text-[#4A7766]">IA COPILOT</span>
                <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-400">PENSANDO...</span>
              </div>
              <p className="text-sm text-gray-700 leading-snug">
                "Hay una oportunidad de <strong>Venta Cruzada</strong> en la póliza de Gastos Médicos de Carlos Ruiz. He preparado una propuesta de Seguro de Vida con un 15% de descuento por lealtad."
              </p>
            </div>

            <button className="bg-[#1a1a1a] text-white text-[11px] font-bold px-4 py-3 rounded-xl hover:bg-black transition-colors shrink-0 flex items-center gap-2">
              EJECUTAR <ArrowUpRight size={14} />
            </button>
          </motion.div>

        </motion.div>
      </div>
    </section>
  )
}