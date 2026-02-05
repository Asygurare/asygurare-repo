"use client"

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Zap, Crown, Rocket, ArrowRight } from 'lucide-react'



export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false)

  return (
    <main className="bg-white min-h-screen pt-40 pb-24 px-7">
      <div className="max-w-7xl mx-auto">

        {/* Header de Pricing */}
        <div className="text-center mb-20">
          <h1
            className="text-5xl md:text-7xl text-(--text) font-medium tracking-tighter mb-6"
          >
            Inversión pequeña. <br />
            <span className="text-(--accents) italic">Resultados masivos.</span>
          </h1 >
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Prueba el poder de Techguros gratis por 15 días. Sin tarjetas, sin compromisos. Solo tú y tu nuevo copiloto.
          </p>

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">

          {/* Plan 1: Free Trial */}
          <PricingCard
            icon={<Rocket size={24} className="text-(--accents)" />}
            title="Trial"
            price="0"
            desc="Ideal para probar la potencia de la plataforma."
            features={[
              "Acceso total por 15 días",
              "CRM Especializado",
              "Captura de datos ilimitada",
              "Soporte por chat"
            ]}
            cta="Empezar Gratis"
            isPopular={false}
          />

          {/* Plan 2: Pro */}
          <PricingCard
            icon={<Zap size={24} className="text-white" />}
            title="Pro"
            price={isAnnual ? "28" : "35"}
            desc="Todo lo que necesitas para escalar tu cartera."
            features={[
              "Uso ilimitado de CRM",
              "Mensajería Automatizada",
              "Anuncios y Novedades",
              "Asistente Virtual IA (Básico)",
              "Soporte Prioritario"
            ]}
            cta="Elegir Pro"
            isPopular={true}
          />

          {/* Plan 3: Ultimate */}
          <PricingCard
            icon={<Crown size={24} className="text-(--accents)" />}
            title="Ultimate"
            price={isAnnual ? "40" : "50"}
            desc="Para asesores de élite basados en datos."
            features={[
              "Todo lo incluido en Pro",
              "Análisis de Datos Avanzado",
              "Recomendaciones de IA",
              "Visualizaciones Personalizadas",
              "Dashboard de Proyecciones"
            ]}
            cta="Elegir Ultimate"
            isPopular={false}
          />
        </div>

        {/* FAQ Rápido / Trust */}
        <div className="mt-24 text-center border-t border-black/5 pt-16">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Seguridad Garantizada</p>
          <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale">
            <span className="font-bold text-(--accents) text-xl">Encriptación 256-bit</span>
            <span className="font-bold text-(--accents) text-xl">RGPD Compliant</span>
            <span className="font-bold text-(--accents) text-xl">Cloud Secured</span>
          </div>
        </div>

      </div>
    </main>
  )
}

function PricingCard({ icon, title, price, desc, features, cta, isPopular }: any) {
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
          Más Popular
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