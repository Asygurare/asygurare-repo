"use client"

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Zap, Rocket, ArrowRight, CreditCard, ShieldCheck, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

type PricingPlan = {
  key: "pro"
  icon: React.ReactNode
  title: string
  desc: string
  price: number
  features: string[]
  cta: string
}


export default function PricingPage() {
  const router = useRouter()
  const [loadingPlan, setLoadingPlan] = useState<null | "pro">(null)

  const plans: PricingPlan[] = [
    {
      key: "pro",
      icon: <Zap size={24} className="text-black" />,
      title: "Pro",
      desc: "El plan para vender más con automatización real.",
      price: 20,
      features: [
        "Workspace completo (Prospectos, Clientes, Pólizas, Calendario)",
        "Análisis (KPIs + gráficas del negocio)",
        "Automatizaciones con Gmail (OAuth) + envíos a listas",
        "GUROS AI (copiloto): redacta, sugiere y acelera tu operación",
        "Historial de correos enviados",
        "Soporte prioritario",
      ],
      cta: "Elegir Pro",
    },
  ]

  const handlePlanCheckout = async (planKey: PricingPlan["key"]) => {
    if (planKey !== "pro") return
    setLoadingPlan(planKey)
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
      })

      // In this app, unauthenticated API requests can be redirected by proxy to /login.
      if (response.redirected || response.url.includes("/login")) {
        router.push("/login")
        return
      }

      const json = await response.json().catch(() => ({}))

      if (response.status === 401) {
        router.push("/login")
        return
      }
      if (!response.ok || !json?.url) {
        throw new Error(json?.error || "No se pudo iniciar el checkout")
      }

      window.location.href = String(json.url)
    } catch (error: unknown) {
      console.error(error)
      const message = error instanceof Error ? error.message : "No se pudo abrir Stripe Checkout. Intenta nuevamente."
      alert(message)
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <main className="bg-white min-h-screen pt-40 pb-24 px-7">
      <div className="max-w-7xl mx-auto">

        {/* Header de Pricing */}
        <div className="text-center mb-20">
          <h1 className="text-5xl md:text-7xl text-(--text) font-medium tracking-tighter mb-6">
            Pruébalo gratis por 15 días. <br />
            <span className="text-(--accents) italic"></span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Asygurare es el workspace para seguros. Prospectos, clientes, análisis y automatizaciones con correo.
            GUROS AI es tu copiloto: el asesor del asesor. Te ayuda a automatizar tu operación e incrementar tus ventas.
          </p>

          <div className="max-w-3xl mx-auto mb-10">
            <div className="rounded-[2rem] border border-black/5 bg-gray-50/60 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-(--accents) flex items-center justify-center">
                  <Rocket size={18} className="text-white" />
                </div>
                <p className="text-[11px] font-black uppercase tracking-widest text-black">Prueba gratis (15 días)</p>
              </div>
              <p className="text-sm font-bold text-black/50 leading-relaxed">
                Acceso total al workspace por 15 dias. Tarjeta requerida al iniciar prueba. Cancela antes del dia 15 para no generar cobro.
              </p>
            </div>
          </div>

          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#9A7A17]">
            Un solo plan, todo incluido
          </p>
        </div>

        {/* Grid de Precios */}
        <div className="grid grid-cols-1 gap-8 items-end max-w-3xl mx-auto">
          {plans.map((p) => (
            <PricingCard
              key={p.key}
              icon={p.icon}
              title={p.title}
              price={p.price}
              desc={p.desc}
              features={p.features}
              cta={p.cta}
              onSelect={() => handlePlanCheckout(p.key)}
              loading={loadingPlan === p.key}
            />
          ))}
        </div>

        {/* FAQ Rápido / Trust */}
        <div className="mt-24 text-center border-t border-black/5 pt-16">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Seguridad Garantizada</p>
          <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale">
            <span className="font-bold text-(--accents) text-xl">Encriptación 256-bit</span>
            <span className="font-bold text-(--accents) text-xl">RGPD Compliant</span>
            <span className="font-bold text-(--accents) text-xl">Cloud Secured</span>
          </div>
          <p className="text-xs text-gray-500 mt-8 max-w-3xl mx-auto leading-relaxed">
            * Incluye prueba gratis de 15 días. Se solicita tarjeta al iniciar la prueba.
          </p>
        </div>

      </div>
    </main>
  )
}

function PricingCard({
  icon,
  title,
  price,
  desc,
  features,
  cta,
  onSelect,
  loading,
}: {
  icon: React.ReactNode
  title: string
  price: number
  desc: string
  features: string[]
  cta: string
  onSelect: () => void
  loading: boolean
}) {
  return (
    <motion.div
      whileHover={{ y: -10 }}
      className="relative p-8 rounded-[2.5rem] flex flex-col transition-all border border-[#D4AF37]/35 shadow-2xl bg-gradient-to-br from-[#FFF8DC] via-white to-[#EEF7F3]"
    >
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#D4AF37] to-(--accents) text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-md">
        Plan Pro
      </div>

      <div className="w-12 h-12 rounded-2xl mb-6 flex items-center justify-center bg-gradient-to-br from-[#F8E7A4] to-[#D4AF37]">
        {icon}
      </div>

      <h3 className="text-2xl font-bold mb-2 text-black">{title}</h3>
      <p className="text-sm mb-8 text-black/60">{desc}</p>

      <div className="mb-8 text-black">
        <span className="text-5xl font-bold tracking-tighter">${price}</span>
        <span className="text-sm opacity-60">/mes</span>
      </div>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-xl border border-[#D4AF37]/35 bg-white/80 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-black/70 inline-flex items-center gap-2">
          <CreditCard size={14} className="text-(--accents)" />
          Tarjeta requerida
        </div>
        <div className="rounded-xl border border-[#D4AF37]/35 bg-white/80 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-black/70 inline-flex items-center gap-2">
          <ShieldCheck size={14} className="text-(--accents)" />
          No cobro hoy
        </div>
      </div>

      <ul className="space-y-4 mb-10 flex-1">
        {features.map((f: string, i: number) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <Check size={16} className="text-(--accents) shrink-0" />
            <span className="text-black/70">{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onSelect}
        disabled={loading}
        className="w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60 text-white bg-gradient-to-r from-(--accents) to-[#D4AF37] hover:brightness-105"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Conectando...
          </>
        ) : (
          <>
            {cta}
            <ArrowRight size={18} />
          </>
        )}
      </button>
    </motion.div>
  )
}