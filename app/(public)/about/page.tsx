"use client"

import React from 'react'
import { motion } from 'framer-motion'
import { Heart, Target, Eye, MessageSquare, ArrowDown } from 'lucide-react'

const transition = { duration: 1, ease: [0.76, 0, 0.24, 1] }

export default function AboutPage() {
  return (
    <main className="bg-(--bg) text-[#1a1a1a] min-h-screen">
      
      {/* --- HERO: LA FILOSOFÍA --- */}
      <section className="pt-40 pb-20 px-7">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-5xl md:text-[7rem] font-medium leading-[0.85] tracking-tighter mb-12">
              Nacimos para <br />
              <span className="text-(--main) italic">escucharte.</span>
            </h1>
            
            <div className="grid md:grid-cols-2 gap-12 items-end">
              <p className="text-xl md:text-2xl text-gray-600 leading-relaxed">
                El mercado está lleno de CRMs genéricos. Asygurare nace de una verdad incómoda: el asesor de seguros ha sido ignorado por la tecnología. Construimos el primer software que no solo organiza datos, sino que entiende tu oficio.
              </p>
              <div className="flex justify-end">
                <motion.div 
                  animate={{ y: [0, 15, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="w-20 h-20 rounded-full border border-[#4A7766] flex items-center justify-center text-[#4A7766]"
                >
                  <ArrowDown size={32} />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- EL MANIFIESTO (TIPO BENTO) --- */}
      <section className="py-24 px-7">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Card 1: El Origen */}
          <motion.div 
            whileInView={{ opacity: 1, scale: 1 }}
            initial={{ opacity: 0, scale: 0.95 }}
            className="md:col-span-8 bg-(--accents) rounded-[3rem] p-12 text-[#ece7e2] flex flex-col justify-between min-h-[400px]"
          >
            <MessageSquare size={40} className="opacity-50" />
            <div>
              <h2 className="text-4xl font-medium mb-4">"Nadie nos preguntó qué necesitábamos."</h2>
              <p className="text-xl opacity-80 max-w-xl">
                Esa fue la frase que detonó Asygurare. Hablamos con cientos de asesores cansados de herramientas complejas. Nuestra misión es simple: que tu única preocupación sea la relación con tu cliente.
              </p>
            </div>
          </motion.div>

          {/* Card 2: El Objetivo */}
          <motion.div 
            whileInView={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            className="md:col-span-4 bg-white rounded-[3rem] p-12 flex flex-col border border-black/5"
          >
            <Target size={40} className="text-(--main) mb-8" />
            <h3 className="text-2xl font-bold mb-4">Vender más <br/>es la consecuencia.</h3>
            <p className="text-gray-500">
              No diseñamos para que llenes tablas; diseñamos para que cierres pólizas. Si el software no te hace ganar más dinero, no es Asygurare.
            </p>
          </motion.div>

          {/* Card 3: Especialización */}
          <motion.div 
            whileInView={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            className="md:col-span-5 bg-(--text-light) rounded-[3rem] p-12 flex flex-col justify-center"
          >
            <div className="text-[5rem] font-bold text-white leading-none mb-4">01.</div>
            <h3 className="text-2xl text-white font-bold mb-2">Especialización Total</h3>
            <p className="text-gray-600">
              Somos el primer software en el mercado enfocado 100% en el sector asegurador. Nada de adaptaciones: nativo para seguros.
            </p>
          </motion.div>

          {/* Card 4: El Factor Humano (IA) */}
          <motion.div 
            whileInView={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            className="md:col-span-7 bg-(--bg) rounded-[3rem] p-12 text-white overflow-hidden relative"
          >
            <div className="relative z-10">
              <Heart size={40} className="text-(--accents) mb-8" />
              <h3 className="text-3xl text-(--text) font-medium mb-4">Tecnología con empatía</h3>
              <p className="opacity-70 max-w-md text-(--accents)">
                Nuestra IA no reemplaza al asesor; lo potencia. Es el copiloto que te avisa cuando alguien te necesita, antes incluso de que ellos lo sepan.
              </p>
            </div>
            {/* Decoración abstracta */}
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-[#4A7766] blur-[100px] opacity-20" />
          </motion.div>

        </div>
      </section>

      {/* --- VISIÓN DE FUTURO --- */}
      <section className="py-32 px-7 text-center bg-(--text-light)">
        <div className="max-w-4xl mx-auto bg-white p-4 rounded-xl">
          <motion.span 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="text-(--accents) font-bold tracking-[0.2em] uppercase text-sm"
          >
            Nuestra Visión
          </motion.span>
          <h2 className="text-4xl md:text-6xl font-medium mt-6 mb-12 tracking-tight">
            Queremos que seas el asesor más eficiente del planeta.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <h4 className="text-3xl font-bold">+40%</h4>
              <p className="text-sm text-gray-500 uppercase tracking-widest">Efectividad en Cierres</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-3xl font-bold">-60%</h4>
              <p className="text-sm text-gray-500 uppercase tracking-widest">Carga Administrativa</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-3xl font-bold">100%</h4>
              <p className="text-sm text-gray-500 uppercase tracking-widest">Enfoque Humano</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- CTA FINAL --- */}
      <section className="pb-32 px-7">
        <div className="max-w-7xl mx-auto bg-white rounded-[4rem] p-16 md:p-24 text-center shadow-sm border border-black/5">
          <h2 className="text-4xl md:text-6xl font-medium mb-10">¿Listo para sentirte escuchado?</h2>
          <button className="bg-(--accents) text-white px-12 py-6 rounded-2xl text-xl font-bold hover:shadow-2xl hover:scale-105 transition-all">
            Únete a la nueva era de Asygurare
          </button>
        </div>
      </section>

    </main>
  )
}