"use client"

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Shield, BarChart3, Bot, Mail, Calendar, Video, Sparkles } from 'lucide-react'
import TechDashboard from '@/src/components/landing/Dashboard/TechnoDashboard'

const INTEGRATIONS = [
  { name: 'Gmail', src: '/logo_integrations/logo_gmail.png', alt: 'Gmail' },
  { name: 'Google Calendar', src: '/logo_integrations/google_calendar.png', alt: 'Google Calendar' },
  { name: 'Calendly', src: '/logo_integrations/calendly_logo.png', alt: 'Calendly' },
  { name: 'Cal.com', src: '/logo_integrations/cal_logo.png', alt: 'Cal.com' },
  { name: 'Google Meet', src: '/logo_integrations/meet_logo.jpg', alt: 'Google Meet' },
]

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

      {/* --- AUTOMATIZA TU TRABAJO DE ASESOR --- */}
      <section className="py-16 md:py-24 px-4 sm:px-7 bg-gradient-to-b from-(--bg) to-white/80 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
            className="text-center mb-12 md:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium text-(--text) tracking-tight mb-4 md:mb-6">
              Automatiza tu trabajo de asesor
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Manda correos, crea reuniones en tu calendario y coordina videollamadas — todo con IA. Menos tareas repetitivas, más tiempo para asesorar.
            </p>
          </motion.div>

          {/* Feature pills - responsive grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-14 md:mb-20"
          >
            {[
              { icon: Mail, label: "Correos automáticos", desc: "Redacta y envía emails con IA" },
              { icon: Calendar, label: "Calendario inteligente", desc: "Crea y gestiona reuniones" },
              { icon: Video, label: "Videollamadas", desc: "Integra Google Meet" },
              { icon: Bot, label: "Copiloto 24/7", desc: "Asistente siempre disponible" },
            ].map((item, i) => (
              <div
                key={item.label}
                className="group flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-white/80 border border-black/5 hover:border-(--main)/20 hover:shadow-lg hover:shadow-(--main)/5 transition-all duration-300"
              >
                <div className="flex-shrink-0 p-2.5 sm:p-3 rounded-xl bg-(--main)/10 text-(--main) group-hover:bg-(--main)/15 transition-colors">
                  <item.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-(--text) text-sm sm:text-base">{item.label}</p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Integrations logos */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <p className="text-center text-sm font-medium text-gray-500 mb-6 md:mb-8">
              Integraciones que ya usas
            </p>
            {/* Mobile: grid wrap | Desktop: marquee */}
            <div className="md:hidden flex flex-wrap justify-center gap-4 sm:gap-6 py-4 px-2">
              {INTEGRATIONS.map((logo) => (
                <div
                  key={logo.name}
                  className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border border-black/5 shadow-sm hover:shadow-md hover:border-(--main)/15 transition-all duration-300 p-2.5 sm:p-3"
                >
                  <Image
                    src={logo.src}
                    alt={logo.alt}
                    width={64}
                    height={64}
                    className="w-full h-full object-contain"
                  />
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-hidden py-4">
              <div className="flex animate-marquee gap-8">
                {[...INTEGRATIONS, ...INTEGRATIONS].map((logo, i) => (
                  <div
                    key={`${logo.name}-${i}`}
                    className="flex-shrink-0 flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-black/5 shadow-sm hover:shadow-md hover:border-(--main)/15 transition-all duration-300 p-4"
                  >
                    <Image
                      src={logo.src}
                      alt={logo.alt}
                      width={64}
                      height={64}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ))}
              </div>
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