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

const transition = { duration: 0.8, ease: [0.76, 0, 0.24, 1] }

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
            Nuestras Capacidades
          </motion.span>
          <h2 className="text-5xl md:text-7xl font-medium text-(--text) tracking-tight mb-8">
            Poder de grado militar. <br />
            <span className="text-(--main) italic">Simplicidad de juguete.</span>
          </h2>
          <p className="text-xl text-gray-600 leading-relaxed">
            Techguros elimina la curva de aprendizaje. Si sabes usar un smartphone, sabes usar Techguros. Diseñado para asesores, no para ingenieros.
          </p>
        </div>

        {/* Grid de Servicios con Enfoque en Facilidad */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* 1. CRM Especializado */}
          <ServiceCard 
            icon={<Database className="text-white" size={28} />}
            title="CRM con Alma de Seguro"
            description="Olvídate de configurar campos infinitos. Techguros viene pre-cargado con la estructura de pólizas, ramos y renovaciones que ya usas. Solo entra y empieza a organizar."
            tag="Cero Configuración"
          />

          {/* 2. Análisis de Datos */}
          <ServiceCard 
            icon={<BarChart className="text-white" size={28} />}
            title="Análisis de Datos Automático"
            description="Tus números se procesan solos. Identifica quién está a punto de cancelar o quién necesita un seguro de vida sin tocar una sola celda de Excel."
            tag="Inteligencia Pasiva"
          />

          {/* 3. Visualizaciones y Reportes */}
          <ServiceCard 
            icon={<Zap className="text-white" size={28} />}
            title="Reportes que se explican solos"
            description="Gráficas elegantes y limpias que puedes entender en 3 segundos. Visualiza tu crecimiento y tus metas con un diseño que da gusto mirar."
            tag="Diseño Intuitivo"
          />

          {/* 4. Asistente Virtual IA */}
          <ServiceCard 
            icon={<Sparkles className="text-white" size={28} />}
            title="Copiloto de Cierre Personal"
            description="Tu asistente redacta las respuestas, te recuerda cuándo llamar y prepara los argumentos de venta por ti. Es como tener un socio experto 24/7."
            tag="Tu Aliado IA"
          />

          {/* NUEVO: 5. Mensajería Centralizada */}
          <ServiceCard 
            icon={<MessageSquareText className="text-white" size={28} />}
            title="Comunicación sin Esfuerzo"
            description="Desde recordatorios de renovación hasta felicitaciones de cumpleaños. Envía mensajes personalizados por SMS, email o WhatsApp desde tu CRM. Siempre conectado."
            tag="Flujos Automáticos"
            isPrimary={true} // Destacamos este como clave para la comunicación
          />

          {/* NUEVO: 6. Anuncios y Novedades */}
          <ServiceCard 
            icon={<Megaphone className="text-white" size={28} />}
            title="Centro de Anuncios y Novedades"
            description="Mantente al día con las últimas funcionalidades de Techguros, noticias del sector o comunicados internos. Información clave, siempre a tu alcance."
            tag="Información Centralizada"
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
            <h3 className="text-3xl font-bold mb-3 text-[#1a1a1a]">¿Sin experiencia en software? Perfecto.</h3>
            <p className="text-lg text-gray-500">
              Techguros está hecho para que lo domines en 15 minutos. Sin manuales pesados, sin tutoriales eternos. Es la plataforma más sencilla jamás creada para el sector.
            </p>
          </div>
          <div className="flex flex-col gap-3 shrink-0">
            <div className="flex items-center gap-2 text-sm font-bold text-(--accents)">
              <CheckCircle size={18} /> Configura en minutos
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-(--accents)">
              <CheckCircle size={18} /> Interfaz Limpia
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-(--accents)">
              <CheckCircle size={18} /> Soporte Humano
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