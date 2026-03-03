"use client"

import React, { useState, useEffect } from 'react'
import SidebarConversaciones from '@/src/components/workspace/chat/SidebarConversaciones'
import ChatDatamara from '@/src/components/workspace/chat/ChatGuros'
import { supabaseClient } from '@/src/lib/supabase/client'
import { BrainCircuit, CircleHelp, CreditCard, PanelLeft, Sparkles, X } from 'lucide-react'
import Image from 'next/image'
import { SectionTutorial, type SectionTutorialStep } from '@/src/components/workspace/tutorial/SectionTutorial'
import Link from 'next/link'

const IA_TUTORIAL_STEPS: SectionTutorialStep[] = [
  {
    id: 'titulo',
    title: 'Guros IA',
    description: 'Esta es tu zona de trabajo con el agente para ventas, operacion y seguimiento.',
    selector: '[data-tutorial="ia-title"]',
  },
  {
    id: 'acciones',
    title: 'Acciones rapidas',
    description: 'Desde aqui controlas historial, tutorial y guia de capacidades.',
    selector: '[data-tutorial="ia-actions"]',
  },
  {
    id: 'historial',
    title: 'Historial de conversaciones',
    description: 'Abre conversaciones pasadas para continuar contexto sin empezar de cero.',
    selector: '[data-tutorial="ia-history-panel"]',
  },
  {
    id: 'chat',
    title: 'Panel de chat',
    description: 'Aqui escribes tus solicitudes y ejecutas todo lo que necesites con el agente.',
    selector: '[data-tutorial="ia-chat-panel"]',
  },
]

export default function IASectorPage() {
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [billingLoading, setBillingLoading] = useState(true)
  const [hasProAccess, setHasProAccess] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isDesktopSidebarHidden, setIsDesktopSidebarHidden] = useState(false)
  const [isCapabilitiesOpen, setIsCapabilitiesOpen] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabaseClient.auth.getUser()
      setUser(user)

      if (user) {
        try {
          const response = await fetch("/api/billing/status", { cache: "no-store" })
          const json = await response.json().catch(() => ({}))
          setHasProAccess(Boolean(json?.billing?.has_pro_access))
        } catch {
          setHasProAccess(false)
        } finally {
          setBillingLoading(false)
        }
      } else {
        setBillingLoading(false)
      }
    }
    getUser()
  }, [])

  if (!user || billingLoading) return null

  if (!hasProAccess) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-black text-white px-4 py-2 text-[11px] font-black uppercase tracking-widest">
            <CreditCard size={14} />
            Plan Pro requerido
          </div>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-black">Guros IA es parte de Pro</h2>
          <p className="mt-3 text-sm font-bold text-black/60 leading-relaxed">
            Activa la prueba gratis de 15 días con tarjeta para usar Guros IA sin límites.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="px-5 py-3 rounded-2xl bg-black text-white text-[11px] font-black uppercase tracking-widest"
            >
              Ver plan Pro
            </Link>
            <Link
              href="/settings"
              className="px-5 py-3 rounded-2xl border border-black/20 bg-white text-[11px] font-black uppercase tracking-widest"
            >
              Administrar suscripción
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* HEADER DE SECCIÓN */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
        <div data-tutorial="ia-title">
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
        <div data-tutorial="ia-actions" className="flex items-center gap-3 md:gap-4">
            <SectionTutorial
              steps={IA_TUTORIAL_STEPS}
              ariaLabel="Tutorial de la seccion Guros IA"
              onBeforeStart={() => {
                setIsDesktopSidebarHidden(false)
                setIsMobileSidebarOpen(false)
              }}
              triggerLabel="Tutorial"
              triggerClassName="bg-white px-4 py-3 rounded-2xl border border-black/5 flex items-center gap-2 shadow-sm text-[10px] font-black uppercase tracking-widest text-black/70 hover:text-black transition-colors"
            />

            <button
              type="button"
              onClick={() => setIsCapabilitiesOpen(true)}
              className="bg-white px-4 py-3 rounded-2xl border border-black/5 flex items-center gap-2 shadow-sm text-[10px] font-black uppercase tracking-widest text-black/70 hover:text-black transition-colors"
            >
              <Sparkles size={16} className="text-(--accents)" />
              Descubre lo que puede hacer por ti
            </button>

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
          <div data-tutorial="ia-history-panel" className="hidden lg:block w-full lg:w-80 flex-shrink-0">
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
        <div data-tutorial="ia-chat-panel" className="flex-1 relative bg-white rounded-[2rem] sm:rounded-[3rem] border border-black/5 shadow-sm overflow-hidden flex flex-col min-h-[70dvh] lg:min-h-0">
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

      {isCapabilitiesOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setIsCapabilitiesOpen(false)}
            aria-label="Cerrar listado de capacidades"
          />
          <div className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-[2rem] border border-black/10 bg-white p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Guros IA</p>
                <h3 className="text-2xl font-black text-black tracking-tight">Todo lo que puedes pedirle</h3>
                <p className="text-sm font-bold text-black/60 mt-2">
                  No solo te responde: trabaja en modo agentistico para quitarte carga administrativa y ejecutar acciones reales en tu workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCapabilitiesOpen(false)}
                className="p-2 rounded-xl border border-black/10 text-black/60 hover:text-black hover:bg-gray-50 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-(--accents)/30 bg-(--accents)/10 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-black">Poder agentistico (tu mano derecha)</p>
                <p className="text-[12px] font-bold text-black/70 mt-2">"Revisa pendientes de hoy y conviertelos en un plan operativo por prioridad."</p>
                <p className="text-[12px] font-bold text-black/70">"Haz seguimiento de leads frios: dame lista priorizada + siguiente accion por cada uno."</p>
                <p className="text-[12px] font-bold text-black/70">"Quiero delegarte la parte administrativa: detecta tareas repetitivas y propon automatizaciones."</p>
              </div>

              <div className="rounded-2xl border border-black/5 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-black">Ventas y seguimiento inteligente</p>
                <p className="text-[12px] font-bold text-black/60 mt-2">"Prepara un plan de seguimiento para este prospecto en 7 dias."</p>
                <p className="text-[12px] font-bold text-black/60">"Redacta 3 mensajes de seguimiento: WhatsApp, email y llamada."</p>
                <p className="text-[12px] font-bold text-black/60">"Detecta clientes listos para renovacion y arma secuencia de contacto."</p>
              </div>

              <div className="rounded-2xl border border-black/5 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-black">Correos: redactar, enviar y programar</p>
                <p className="text-[12px] font-bold text-black/60 mt-2">"Escribe un correo para reactivar clientes inactivos con tono cercano."</p>
                <p className="text-[12px] font-bold text-black/60">"Crea una plantilla para bienvenida de nuevos prospectos."</p>
                <p className="text-[12px] font-bold text-black/60">"Programa este correo para manana 8:30 AM y crea tarea de seguimiento 24h despues."</p>
              </div>

              <div className="rounded-2xl border border-black/5 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-black">Operacion diaria sin friccion</p>
                <p className="text-[12px] font-bold text-black/60 mt-2">"Organiza mis prioridades de hoy con base en tareas y clientes."</p>
                <p className="text-[12px] font-bold text-black/60">"Dame checklist para preparar una cita de cierre."</p>
                <p className="text-[12px] font-bold text-black/60">"Crea tareas de seguimiento para todos los clientes contactados hoy."</p>
              </div>

              <div className="rounded-2xl border border-black/5 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-black">Analisis + decisiones accionables</p>
                <p className="text-[12px] font-bold text-black/60 mt-2">"Analiza mis resultados y propon 5 acciones para subir conversion."</p>
                <p className="text-[12px] font-bold text-black/60">"Que cuellos de botella ves en mi proceso comercial actual?"</p>
                <p className="text-[12px] font-bold text-black/60">"Donde estoy perdiendo renovaciones y que hago esta semana para corregirlo?"</p>
              </div>

              <div className="rounded-2xl border border-black/5 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-black">Reuniones, llamadas y objeciones</p>
                <p className="text-[12px] font-bold text-black/60 mt-2">"Genera un guion de llamada para cliente indeciso."</p>
                <p className="text-[12px] font-bold text-black/60">"Dame respuestas para objeciones de precio y urgencia."</p>
                <p className="text-[12px] font-bold text-black/60">"Prepara briefing para mi reunion de hoy con datos clave del cliente."</p>
              </div>

              <div className="rounded-2xl border border-black/5 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-black">Automatizaciones e integraciones</p>
                <p className="text-[12px] font-bold text-black/60 mt-2">"Revisa mis automatizaciones activas y recomienda mejoras."</p>
                <p className="text-[12px] font-bold text-black/60">"Sincroniza reuniones de calendario a tareas y marca prioridades."</p>
                <p className="text-[12px] font-bold text-black/60">"Crea links de agenda y preparame mensaje para compartirlo con prospectos."</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsCapabilitiesOpen(false)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/85"
              >
                <CircleHelp size={14} />
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}