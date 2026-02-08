"use client"
import { TrendingUp, AlertTriangle, Wallet } from 'lucide-react'

export const PolicyStats = ({ policies }: { policies: any[] }) => {
  // 1. Dinero en riesgo (Vence en < 30 días)
  const riskAmount = policies
    .filter(p => {
       const diff = new Date(p.expiry_date).getTime() - new Date().getTime();
       return diff > 0 && diff < (30 * 24 * 3600 * 1000);
    })
    .reduce((acc, curr) => acc + (curr.total_premium || 0), 0);

  // 2. Cartera Total
  const totalPortfolio = policies.reduce((acc, curr) => acc + (curr.total_premium || 0), 0);

  // 3. Oportunidad de Cross-Sell (Clientes con solo 1 póliza)
  // (Lógica simplificada para el ejemplo)
  const uniqueCustomers = new Set(policies.map(p => p.customer_id)).size;
  const avgPolicies = uniqueCustomers ? (policies.length / uniqueCustomers).toFixed(1) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {/* TARJETA 1: URGENCIA DE COBRO */}
      <div className="bg-orange-500 rounded-[2rem] p-6 text-white shadow-xl shadow-orange-500/20 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <AlertTriangle size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Renovaciones (30d)</span>
          </div>
          <h3 className="text-3xl font-black tracking-tighter">${riskAmount.toLocaleString()}</h3>
          <p className="text-xs font-medium opacity-80 mt-1">Ingreso en riesgo este mes</p>
        </div>
        <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
           <AlertTriangle size={120} />
        </div>
      </div>

      {/* TARJETA 2: SALUD DE CARTERA */}
      <div className="bg-black rounded-[2rem] p-6 text-white relative overflow-hidden">
         <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 text-(--accents)">
            <Wallet size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Valor de Cartera</span>
          </div>
          <h3 className="text-3xl font-black tracking-tighter">${totalPortfolio.toLocaleString()}</h3>
          <p className="text-xs font-medium text-gray-400 mt-1">Primas anuales activas</p>
        </div>
      </div>

      {/* TARJETA 3: INSIGHT DE NEGOCIO */}
      <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-blue-600">
            <TrendingUp size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Densidad de Venta</span>
          </div>
          <h3 className="text-3xl font-black tracking-tighter text-gray-900">{avgPolicies} <span className="text-lg text-gray-400 font-bold">x Cliente</span></h3>
          <p className="text-xs font-medium text-gray-500 mt-1">Objetivo ideal: 2.5 pólizas/cliente</p>
      </div>
    </div>
  )
}