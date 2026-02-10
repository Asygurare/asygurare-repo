// pages/services.tsx (o como tengas tu componente de Servicios)
"use client"

import React from 'react'
import { motion } from 'framer-motion'
import { 
  Database, 
  BarChart, 
  Sparkles, 
  Zap, 
  MousePointer2,
  CheckCircle,
  MessageSquareText, // Nuevo icono para mensajería
  Megaphone // Nuevo icono para anuncios
} from 'lucide-react'

export default function Services() {
  return (
    <section className="bg-white py-32 px-7 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* Encabezado: La Promesa de Simplicidad */}
        <div className="max-w-3xl mb-24">
          <motion.span 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="text-(--main) font-bold tracking-[0.2em] uppercase text-xs mb-4 block"
          >
            Lo que incluye el Workspace
          </motion.span>
          <h2 className="text-5xl md:text-7xl font-medium text-(--text) tracking-tight mb-8">
            Todo tu negocio, <br />
            <span className="text-(--main) italic">en una sola herramienta.</span>
          </h2>
          <p className="text-xl text-gray-600 leading-relaxed">
            Prospectos, clientes, pólizas, calendario, análisis y automatizaciones con correo electrónico. Diseñado para asesores: rápido, claro y listo para usar.
          </p>
        </div>

        {/* Grid de Servicios con Enfoque en Facilidad */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* 1. Prospectos */}
          <ServiceCard 
            icon={<Database className="text-white" size={28} />}
            title="Prospectos y Pipeline"
            description="Gestiona tu lista de prospectos, etapas y estatus en un CRM pensado para seguros. Ordena, filtra y convierte sin fricción."
            tag="CRM de seguros"
          />

          {/* 2. Clientes */}
          <ServiceCard 
            icon={<Megaphone className="text-white" size={28} />}
            title="Clientes y Seguimiento"
            description="Centraliza información clave de tus clientes y mantén un historial limpio para dar seguimiento oportuno. Menos búsqueda, más acción."
            tag="Orden y control"
          />

          {/* 3. Pólizas + renovaciones */}
          <ServiceCard 
            icon={<Zap className="text-white" size={28} />}
            title="Pólizas y Renovaciones"
            description="Registra pólizas, primas y fechas de vencimiento para tener claridad de tu cartera. Mantén el control de renovaciones y oportunidades."
            tag="Cartera clara"
          />

          {/* 4. Análisis */}
          <ServiceCard 
            icon={<BarChart className="text-white" size={28} />}
            title="Análisis y KPIs"
            description="Visualiza tu operación con indicadores y gráficas en tiempo real: crecimiento, conversiones y desempeño por fuente o etapa."
            tag="Decisiones rápidas"
          />

          {/* 5. Automatizaciones */}
          <ServiceCard 
            icon={<MessageSquareText className="text-white" size={28} />}
            title="Automatizaciones con Email"
            description="Conecta tu Gmail vía OAuth y envía correos desde tu workspace a prospectos o clientes seleccionados. Incluye redactor y GUROS AI para crear mensajes listos para enviar."
            tag="Gmail + GUROS AI"
            isPrimary={true}
          />

          {/* 6. Asistente IA */}
          <ServiceCard 
            icon={<Sparkles className="text-white" size={28} />}
            title="GUROS AI"
            description="Tu copiloto. El asesor del asesor. Te ayuda a automatizar tu operación, comunicarte mejor y vender más, con borradores listos para enviar (tú decides el mensaje final)."
            tag="Copiloto de ventas"
          />

        </div>

        {/* --- BANNER DE "NO EXPERIENCIA" --- */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="mt-20 p-12 bg-white rounded-[3rem] border border-black/5 flex flex-col md:flex-row items-center gap-10"
        >
          <div className="bg-(--accents) p-6 rounded-full">
            <MousePointer2 size={48} className="text-white animate-bounce" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-3xl font-bold mb-3 text-[#1a1a1a]">Un workspace que sí se siente sencillo.</h3>
            <p className="text-lg text-gray-500">
              Entra, carga tu información y trabaja. Prospectos, clientes, pólizas, análisis y correos en un solo lugar, con una interfaz limpia y directa.
            </p>
          </div>
          <div className="flex flex-col gap-3 shrink-0">
            <div className="flex items-center gap-2 text-sm font-bold text-(--accents)">
              <CheckCircle size={18} /> Empieza en minutos
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-(--accents)">
              <CheckCircle size={18} /> Vista clara del negocio
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-(--accents)">
              <CheckCircle size={18} /> Automatiza comunicación
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  )
}

function ServiceCard({ icon, title, description, tag, isPrimary = false }: { 
  icon: React.ReactNode, 
  title: string, 
  description: string, 
  tag: string,
  isPrimary?: boolean
}) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`p-10 rounded-[2.5rem] flex flex-col justify-between h-[450px] transition-all ${
        isPrimary ? 'bg-[#1a1a1a] text-white shadow-2xl' : 'bg-white text-[#1a1a1a] border border-black/5 shadow-sm'
      }`}
    >
      <div>
        <div className="flex justify-between items-start mb-10">
          <div className={`p-4 rounded-2xl ${isPrimary ? 'bg-(--main)' : 'bg-(--accents)'}`}>
            {icon}
          </div>
          <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
            isPrimary ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-400'
          }`}>
            {tag}
          </span>
        </div>
        <h3 className="text-3xl font-bold mb-6 tracking-tight leading-none">{title}</h3>
        <p className={`text-lg leading-relaxed ${isPrimary ? 'opacity-70' : 'text-gray-500'}`}>
          {description}
        </p>
      </div>
      
      <div className={`mt-6 flex items-center gap-2 text-sm font-bold ${isPrimary ? 'text-(--main)' : 'text-(--accents)'}`}>
        Explorar funcionalidad <Zap size={14} fill="currentColor" />
      </div>
    </motion.div>
  )
}