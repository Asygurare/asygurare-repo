"use client"
import React from 'react'
import { motion } from 'framer-motion'
import { 
  Shield, Car, Heart, Home, AlertCircle, 
  Calendar, ArrowUpRight, Smartphone 
} from 'lucide-react'
import { Policy, PolicyWithCustomer } from '@/src/types/policy'
import { getFullName } from '@/src/lib/utils/utils'

// Helper para iconos según ramo
const getCategoryIcon = (cat: string) => {
  const c = cat?.toLowerCase() || ''
  if (c.includes('auto')) return <Car size={20} />
  if (c.includes('vida') || c.includes('med')) return <Heart size={20} />
  if (c.includes('hogar') || c.includes('dañ')) return <Home size={20} />
  return <Shield size={20} />
}

// Helper para días restantes
const getDaysRemaining = (dateStr: string) => {
  const diff = new Date(dateStr).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 3600 * 24))
}

export const PolicyCard = ({ policy, onClick }: { policy: PolicyWithCustomer; onClick: () => void }) => {
  const daysLeft = getDaysRemaining(policy.expiry_date)
  const customerName = getFullName(policy.WS_CUSTOMERS_2 || {})
  // Lógica de Semáforo
  let statusColor = "bg-gray-100 text-gray-600"
  let borderColor = "border-transparent"

  if (daysLeft < 0) {
    statusColor = "bg-red-100 text-red-600"
    borderColor = "border-red-500" // Vencida
  } else if (daysLeft <= 30) {
    statusColor = "bg-orange-100 text-orange-600"
    borderColor = "border-orange-400" // Urgente
  } else {
    statusColor = "bg-green-100 text-green-600" // Saludable
  }

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
      onClick={onClick}
      className={`bg-white rounded-[2rem] p-6 cursor-pointer border-2 ${borderColor} transition-all shadow-sm group relative overflow-hidden`}
    >
      {/* HEADER: Cliente & Ramo */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center">
            <span className="font-bold text-xs">{customerName.substring(0, 2).toUpperCase()}</span>
          </div>
          <div>
            <h4 className="font-black text-sm text-gray-900 leading-tight">
              {customerName}
            </h4>
            <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">
              {policy.insurance_company} • {policy.policy_number}
            </p>
          </div>
        </div>
        <div className="p-2 bg-[#ece7e2] rounded-xl text-black">
          {getCategoryIcon(policy.category)}
        </div>
      </div>

      {/* BODY: El Dinero y la Vigencia */}
      <div className="mb-6 space-y-1">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Prima Anual</p>
        <h3 className="text-2xl font-black text-gray-900 tracking-tight">
          ${policy.total_premium.toLocaleString('es-MX')}
          <span className="text-xs font-medium text-gray-400 ml-1 line-through decoration-transparent">MXN</span>
        </h3>
        <div className="flex items-center gap-2 mt-2">
            <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase ${statusColor}`}>
              {daysLeft < 0 ? 'Vencida hace ' + Math.abs(daysLeft) + ' días' : 
               daysLeft === 0 ? 'Vence Hoy' : 
               `Vence en ${daysLeft} días`}
            </span>
            <span className="text-[9px] font-bold bg-gray-50 text-gray-500 px-2 py-1 rounded-md uppercase">
              {policy.frecuencia_pago}
            </span>
        </div>
      </div>

      {/* FOOTER: Insight / Acción */}
      <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
        <div className="flex items-center gap-1 text-gray-400 text-xs">
          <Calendar size={14} />
          <span className="font-medium">{new Date(policy.expiry_date).toLocaleDateString()}</span>
        </div>
        
        {/* Hover Action */}
        <button className="bg-black text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
          <ArrowUpRight size={16} />
        </button>
      </div>

      {/* Warning Visual si es urgente */}
      {daysLeft <= 30 && daysLeft >= 0 && (
         <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-orange-400/20 to-transparent pointer-events-none rounded-tr-[2rem]" />
      )}
    </motion.div>
  )
}