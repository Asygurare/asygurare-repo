"use client"

import React from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, Users, FileCheck, ArrowUpRight,
  Sparkles, Plus, Inbox, Loader2, AlertCircle,
  CalendarDays, PhoneCall, MessageSquare, Briefcase, Clock, Target
} from 'lucide-react'

type TaskKind = 'Llamada' | 'Cita' | 'Mensaje' | 'Seguimiento' | 'Otro'
type TaskPriority = 'Alta' | 'Media' | 'Baja'
type TaskStatus = 'open' | 'done'
type EntityType = 'lead' | 'customer' | 'none'

type MonthTask = {
  id: string
  title: string
  kind: TaskKind
  priority: TaskPriority
  status: TaskStatus
  due_at: string
  entity_type: EntityType
  entity_id: string | null
  related_name?: string | null
}

function kindIcon(kind: TaskKind) {
  if (kind === 'Llamada') return PhoneCall
  if (kind === 'Mensaje') return MessageSquare
  if (kind === 'Cita') return CalendarDays
  if (kind === 'Seguimiento') return Briefcase
  return Clock
}

function priorityDot(priority: TaskPriority) {
  if (priority === 'Alta') return 'bg-red-500'
  if (priority === 'Media') return 'bg-orange-500'
  return 'bg-gray-300'
}

export default function TechnoDashboard() {
  // Demo data (no funcional): usado solo para mostrar UI.
  const loading = false
  const tasksAvailable = true
  const stats = {
    primas: 2412500,
    clientes: 128,
    renovaciones: 9,
    leads: 36
  }

  const now = new Date()
  const inDays = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000).toISOString()
  const monthTasks: MonthTask[] = [
    {
      id: 'demo-1',
      title: 'Llamar a Carlos Ruiz (renovación GMM)',
      kind: 'Llamada',
      priority: 'Alta',
      status: 'open',
      due_at: inDays(1),
      entity_type: 'customer',
      entity_id: 'cust-demo-1',
      related_name: 'Carlos Ruiz',
    },
    {
      id: 'demo-2',
      title: 'Enviar propuesta Vida Elite a Lucía Fernández',
      kind: 'Mensaje',
      priority: 'Media',
      status: 'open',
      due_at: inDays(3),
      entity_type: 'lead',
      entity_id: 'lead-demo-2',
      related_name: 'Lucía Fernández',
    },
    {
      id: 'demo-3',
      title: 'Cita de análisis: flotilla Corporativo Sky',
      kind: 'Cita',
      priority: 'Alta',
      status: 'open',
      due_at: inDays(6),
      entity_type: 'lead',
      entity_id: 'lead-demo-3',
      related_name: 'Corporativo Sky',
    },
    {
      id: 'demo-4',
      title: 'Seguimiento post-venta: entrega de póliza Hogar Global',
      kind: 'Seguimiento',
      priority: 'Baja',
      status: 'done',
      due_at: inDays(-2),
      entity_type: 'customer',
      entity_id: 'cust-demo-4',
      related_name: 'Andrés Villaman',
    },
  ]

  const cards = [
    { label: 'Primas Totales', value: `$${stats.primas.toLocaleString()}`, color: 'text-black', icon: TrendingUp, detail: 'Cartera total' },
    { label: 'Clientes Activos', value: stats.clientes.toString(), color: 'text-(--accents)', icon: Users, detail: 'Cuentas registradas' },
    { label: 'Pólizas a Renovar', value: stats.renovaciones.toString(), color: 'text-orange-600', icon: FileCheck, detail: 'Próximos 30 días' },
    { label: 'Oportunidades Lead', value: stats.leads.toString(), color: 'text-blue-600', icon: Sparkles, detail: 'En seguimiento' },
  ]

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-10 lg:px-10 lg:py-12 overflow-x-hidden">
      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8 rounded-md border-2 border-(--accents) bg-white p-4 sm:p-8 lg:p-12">
        {/* --- SALUDO E IA --- */}
        <section className="flex flex-col md:flex-row gap-6 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex-1 bg-white p-6 sm:p-8 rounded-[2rem] border border-black/5 shadow-sm"
          >
            <h2 className="text-2xl sm:text-3xl font-black text-black mb-2">
              Panel de <span className="text-(--accents) italic">Control.</span>
            </h2>
            <p className="text-gray-500 mb-6 font-bold text-sm uppercase tracking-tight">
              {stats.clientes > 0 ? `Gestionando ${stats.clientes} asegurados actualmente.` : "Tu workspace está listo. Comienza agregando a tu primer cliente."}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button className="w-full sm:w-auto justify-center bg-black text-white px-5 py-3 sm:px-8 sm:py-4 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-(--accents) transition-all shadow-xl">
                <Plus size={18} /> Nueva Acción
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="md:w-1/3 bg-[#1a1a1a] p-6 sm:p-8 rounded-[2rem] text-white relative overflow-hidden flex flex-col justify-center"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-(--accents) mb-4">
                <Sparkles size={20} fill="currentColor" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">IA Insight</span>
              </div>
              <p className="text-sm font-bold leading-relaxed italic opacity-90">
                {stats.renovaciones > 0
                  ? `¡Atención! Tienes ${stats.renovaciones} pólizas por vencer. Es momento de iniciar campañas de retención.`
                  : "Todo está en orden. No hay renovaciones críticas para los próximos 7 días."}
              </p>
            </div>
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-(--accents) blur-[80px] opacity-20" />
          </motion.div>
        </section>

        {/* --- ESTADÍSTICAS REALES --- */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-black/5 shadow-sm group hover:border-(--accents)/30 transition-all"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="p-4 bg-gray-50 rounded-2xl text-black group-hover:bg-(--accents) group-hover:text-white transition-all">
                  <stat.icon size={24} />
                </div>
                <ArrowUpRight size={20} className="text-gray-300 group-hover:text-black" />
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-2">{stat.label}</p>
              {loading ? (
                <Loader2 className="animate-spin text-gray-200" size={24} />
              ) : (
                <>
                  <h4 className={`text-2xl sm:text-3xl font-black ${stat.color}`}>{stat.value}</h4>
                  <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase">{stat.detail}</p>
                </>
              )}
            </motion.div>
          ))}
        </section>

        {/* --- ACTIVIDAD Y TAREAS --- */}
        <section className="grid lg:grid-cols-3 gap-8">

          <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-black/5 p-6 sm:p-8 lg:p-10 flex flex-col overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 sm:mb-10">
              <h3 className="text-xl font-black text-black italic">Actividad del Mes</h3>
              <span className="text-[10px] font-black text-(--accents) bg-(--accents)/10 px-4 py-2 rounded-full uppercase">En tiempo real</span>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-gray-200" size={28} />
              </div>
            ) : !tasksAvailable ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 py-10">
                <CalendarDays size={54} className="text-gray-100 mb-4" />
                <p className="font-bold text-black">Calendario no sincronizado</p>
                <p className="text-[11px] font-bold text-black/40 max-w-md mt-2">
                  No se detectó la tabla <span className="text-black">tasks</span> o no hay permisos. Crea tareas en Calendario y activa la tabla para ver actividad aquí.
                </p>
              </div>
            ) : monthTasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                <Inbox size={48} className="text-gray-200 mb-4" />
                <p className="font-bold text-black">No hay tareas registradas este mes</p>
                <p className="text-[11px] font-bold text-black/40 mt-2">Crea una llamada, cita o mensaje desde Calendario.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {monthTasks.map((t) => {
                  const Icon = kindIcon(t.kind)
                  const dt = new Date(t.due_at)
                  const timeLabel = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' }).format(dt).toUpperCase()
                  const hourLabel = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(dt)
                  const badge =
                    t.entity_type === 'customer' ? 'Cliente' :
                      t.entity_type === 'lead' ? 'Prospecto' : null

                  return (
                    <div key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-all">
                      <div className={`w-2 h-2 rounded-full ${t.status === 'done' ? 'bg-green-500' : priorityDot(t.priority)}`} />

                      <div className="p-2 bg-gray-50 rounded-xl text-black shrink-0">
                        <Icon size={16} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-black text-black truncate ${t.status === 'done' ? 'line-through opacity-60' : ''}`}>
                          {t.title}
                        </p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${t.status === 'done' ? 'bg-green-50 text-green-700' :
                              t.priority === 'Alta' ? 'bg-red-50 text-red-600' :
                                t.priority === 'Media' ? 'bg-orange-50 text-orange-700' :
                                  'bg-gray-50 text-gray-600'
                            }`}>
                            {t.status === 'done' ? 'HECHA' : t.priority}
                          </span>
                          {badge ? (
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-widest text-black/30 inline-flex items-start gap-2 max-w-full min-w-0 flex-wrap">
                              <Target size={12} className="opacity-30 shrink-0 mt-[1px]" />
                              <span className="min-w-0 break-words">
                                {badge}{t.related_name ? `: ${t.related_name}` : ''}
                              </span>
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <span className="text-[10px] font-black text-gray-300 whitespace-normal sm:whitespace-nowrap self-end sm:self-auto sm:ml-auto">
                        {timeLabel} · {hourLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-6 sm:p-8 lg:p-10 overflow-hidden">
            <h3 className="text-xl font-black text-black mb-6 sm:mb-8 italic">Urgente</h3>
            <div className="space-y-6">
              {stats.renovaciones > 0 ? (
                <div className="p-6 bg-orange-50 rounded-[2rem] border border-orange-100">
                  <div className="flex items-center gap-3 text-orange-700 mb-2">
                    <AlertCircle size={18} />
                    <span className="text-xs font-black uppercase tracking-widest">Renovaciones</span>
                  </div>
                  <p className="text-sm font-bold text-orange-900 leading-tight">
                    Tienes {stats.renovaciones} pólizas que requieren contacto inmediato.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 font-bold italic text-center py-10">Nada urgente por ahora.</p>
              )}
            </div>
            <button className="w-full mt-8 py-4 sm:py-5 border-2 border-dashed border-gray-100 rounded-[2rem] text-gray-400 font-black text-[10px] uppercase tracking-[0.15em] sm:tracking-widest hover:border-(--accents) hover:text-(--accents) transition-all whitespace-normal break-words">
              + Crear Recordatorio
            </button>
          </div>

        </section>
      </div>
    </main>
  )
}