"use client"

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Zap, Crown, Rocket, ArrowRight } from 'lucide-react'

type BillingPeriod = "monthly" | "annual"

type PricingPlan = {
  key: "pro" | "ultimate"
  icon: React.ReactNode
  title: string
  desc: string
  priceMonthly: number
  priceAnnualMonthlyEquivalent: number
  highlight?: boolean
  tag?: string
  features: string[]
  cta: string
}


export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false)
  const billing: BillingPeriod = isAnnual ? "annual" : "monthly"

  const plans: PricingPlan[] = [
    {
      key: "pro",
      icon: <Zap size={24} className="text-white" />,
      title: "Pro",
      desc: "El plan para vender más con automatización real.",
      priceMonthly: 20,
      priceAnnualMonthlyEquivalent: 16,
      highlight: true,
      tag: "Más popular",
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
    {
      key: "ultimate",
      icon: <Crown size={24} className="text-(--accents)" />,
      title: "Ultimate",
      desc: "Para equipos o asesores que operan con volumen y datos.",
      priceMonthly: 59,
      priceAnnualMonthlyEquivalent: 47,
      features: [
        "Todo en Pro",
        "GUROS AI: flujos, plantillas y automatizaciones avanzadas",
        "Segmentación y campañas a gran escala",
        "Analítica avanzada y reportes premium",
        "Onboarding + soporte premium",
      ],
      cta: "Elegir Ultimate",
    },
  ]

  return (
    <main className="bg-white min-h-screen pt-40 pb-24 px-7">
      <div className="max-w-7xl mx-auto">

        {/* Header de Pricing */}
        <div className="text-center mb-20">
          <h1 className="text-5xl md:text-7xl text-(--text) font-medium tracking-tighter mb-6">
            Pruébalo gratis por 15 días. <br />
            <span className="text-(--accents) italic">Después, elige tu plan.</span>
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
                Acceso al workspace para conocer el flujo completo. Sin tarjeta. Cancela cuando quieras antes de que termine.
              </p>
            </div>
          </div>

          {/* Selector Mensual/Anual */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-bold ${!isAnnual ? 'text-[#1a1a1a]' : 'text-gray-400'}`}>Mensual</span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="w-14 h-8 bg-white border border-black/10 rounded-full p-1 relative transition-colors"
            >
              <motion.div
                animate={{ x: isAnnual ? 24 : 0 }}
                className="w-6 h-6 bg-(--accents) rounded-full shadow-sm"
              />
            </button>
            <span className={`text-sm font-bold ${isAnnual ? 'text-[#1a1a1a]' : 'text-gray-400'}`}>Anual (Ahorra 20%)</span>
          </div>
        </div>

        {/* Grid de Precios */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end max-w-5xl mx-auto">
          {plans.map((p) => (
            <PricingCard
              key={p.key}
              icon={p.icon}
              title={p.title}
              price={billing === "annual" ? p.priceAnnualMonthlyEquivalent : p.priceMonthly}
              desc={p.desc}
              features={p.features}
              cta={p.cta}
              isPopular={!!p.highlight}
              tag={p.tag}
              billing={billing}
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
            * “Ahorra 20%” aplica al seleccionar facturación anual. Los límites de envío y uso justo aplican para proteger la entregabilidad.
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
  isPopular,
  tag,
  billing,
}: {
  icon: React.ReactNode
  title: string
  price: number
  desc: string
  features: string[]
  cta: string
  isPopular: boolean
  tag?: string
  billing: BillingPeriod
}) {
  return (
    <motion.div
      whileHover={{ y: -10 }}
      className={`relative p-8 rounded-[2.5rem] flex flex-col transition-all ${isPopular
          ? 'bg-[#1a1a1a] text-white shadow-2xl scale-105 z-10'
          : 'bg-white text-[#1a1a1a] border border-black/5'
        }`}
    >
      {isPopular && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-(--accents) text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
          {tag || "Más popular"}
        </div>
      )}

      <div className={`w-12 h-12 rounded-2xl mb-6 flex items-center justify-center ${isPopular ? 'bg-(--accents)' : 'bg-[#4A7766]/10'}`}>
        {icon}
      </div>

      <h3 className="text-2xl font-bold mb-2">{title}</h3>
      <p className={`text-sm mb-8 ${isPopular ? 'text-gray-400' : 'text-gray-500'}`}>{desc}</p>

      <div className="mb-8">
        <span className="text-5xl font-bold tracking-tighter">${price}</span>
        <span className="text-sm opacity-50">/mes</span>
        {billing === "annual" ? (
          <div className={`mt-2 text-[11px] font-bold ${isPopular ? "text-gray-300" : "text-gray-500"}`}>
            Facturado anual
          </div>
        ) : null}
      </div>

      <ul className="space-y-4 mb-10 flex-1">
        {features.map((f: string, i: number) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <Check size={16} className="text-(--accents) shrink-0" />
            <span className={isPopular ? 'text-gray-300' : 'text-gray-600'}>{f}</span>
          </li>
        ))}
      </ul>

      <button className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${isPopular
          ? 'bg-(--accents) hover:bg-blue-500 text-white'
          : 'bg-[#1a1a1a] hover:bg-black text-white'
        }`}>
        {cta} <ArrowRight size={18} />
      </button>
    </motion.div>
  )
}