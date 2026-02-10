"use client"

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Shield, BarChart3, Bot, ChevronRight, CheckCircle2 } from 'lucide-react'
import TechDashboard from '@/src/components/landing/Dashboard/TechnoDashboard'

// Animaciones constantes tipo GSAP
const transition = { duration: 0.8, ease: [0.76, 0, 0.24, 1] }

export default function Home() {
  return (
    <main className="min-h-screen bg-(--bg)  overflow-x-hidden">

      {/* --- HERO SECTION --- */}
      <section className="pt-44 pb-20 px-7 bg-(--bg)">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}

            className="max-w-3xl"
          >
            <span className="inline-block px-4 py-1.5 bg-(--accents) border border-[#4A7766]/20 rounded-full text-white text-xs font-bold tracking-widest uppercase mb-6">
              El futuro de la industria de seguros
            </span>
            <h1 className="text-6xl text-(--text) md:text-8xl font-medium tracking-tight leading-[0.9] mb-8">
              Vende seguros con <span className="text-(--main) italic">superpoderes.</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 leading-relaxed mb-10 max-w-2xl">
              Asygurare es el ecosistema operativo diseñado para asesores que buscan escala. Somos el asesor del asesor y el copiloto de IA más avanzado del sector.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/signup">
              <button className="bg-(--accents) text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-blue-700 transition-all">
                Comenzar ahora
              </button>
              </Link>
              <Link href="/sections">
              <button className="text-(--text) px-8 py-4 rounded-xl text-lg font-medium border border-black/10 hover:bg-black/5 transition-all">
                Ver Funciones
              </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- DASHBOARD PREVIEW (EL MOMENTO "WOW") --- */}

      <TechDashboard/>


      {/* --- FEATURES --- */}
      <section className="py-32 px-7">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-12">
          <FeatureCard 
            icon={<Shield className="text-(--accents)" />}
            title="Un ecosistema para el asesor moderno"
            desc="No es un CRM genérico. Está diseñado para el ciclo de vida de una póliza, renovaciones y siniestros."
          />
          <FeatureCard 
            icon={<BarChart3 className="text-(--accents)" />}
            title="Funnel Automatizado"
            desc="Visualiza tu pipeline. Desde el prospecto frío hasta la firma digital en un flujo sin fricciones."
          />
          <FeatureCard 
            icon={<Bot className="text-(--accents)" />}
            title="Copiloto de Ventas"
            desc="Tu IA redacta correos, analiza riesgos y te sugiere el mejor momento para llamar."
          />
        </div>
      </section>

      {/* --- REINVENTANDO EL ROL --- */}
      <section className="py-32 bg-(--main) text-white rounded-[3rem] mx-4 mb-10 overflow-hidden relative">
        <div className="max-w-4xl mx-auto text-center relative z-10 px-7">
          <h2 className="text-4xl md:text-6xl font-medium mb-8">Tus ventas, garantizadas por datos, no por azar.</h2>
          <p className="text-xl opacity-80 mb-12">Asygurare elimina la carga administrativa para que vuelvas a hacer lo que mejor sabes: asesorar personas.</p>
          <button className="bg-(--accents) text-white px-10 py-5 rounded-full text-lg font-bold hover:scale-105 transition-transform">
            Eleva tu carrera ahora
          </button>
        </div>
        {/* Abstract Background Shape */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      </section>

    </main>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="group p-8 rounded-3xl bg-white/50 border border-transparent hover:border-[#4A7766]/20 transition-all"
    >
      <div className="mb-6 p-3 bg-white inline-block rounded-2xl shadow-sm group-hover:shadow-md transition-shadow">
        {icon}
      </div>
      <h3 className="text-2xl text-(--accents) font-bold mb-4">{title}</h3>
      <p className="text-gray-900 leading-relaxed">{desc}</p>
    </motion.div>
  )
}