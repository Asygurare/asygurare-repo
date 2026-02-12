"use client"

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabaseClient } from '@/src/lib/supabase/client'
import { validatePassword } from '@/src/lib/utils/auth/auth-service'
import { SITE_CONFIG } from '@/src/config/site'
import { ArrowRight, Mail, Lock, Building2, Loader2 } from 'lucide-react'
import Image from 'next/image'

export default function SignUpPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!acceptedTerms) {
      setError("Debes aceptar los Términos y Condiciones para continuar.")
      return
    }

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const validation = validatePassword(password ?? "")
    if (!validation.isValid) {
      setError(validation.message ?? "Contraseña no válida")
      return
    }

    setLoading(true)
    const firstName = formData.get('firstName') as string
    const lastName = formData.get('lastName') as string
    const agencyName = formData.get('agencyName') as string
    const city = formData.get('city') as string
    const country = formData.get('country') as string

    const { error: signUpError } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        // A dónde vuelve el usuario después de confirmar el correo
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login?code=email_confirmed`,
        // Estos datos son los que el trigger de SQL leerá para la tabla profiles
        data: {
          first_name: firstName,
          last_name: lastName,
          agency_name: agencyName,
          city:city,
          country:country,
          email: email,         
        }
      }
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
    } else {
      // Éxito: Redirigir o mostrar mensaje de confirmación
      router.push('/login?code=confirm_email')
    }
  }

  return (
    <main className="min-h-screen bg-(--bg) flex overflow-hidden">
      <section className="w-full lg:w-[50%] flex flex-col justify-center px-8 md:px-24 bg-white z-10 py-12 overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full mx-auto">
          
          <Link href="/" className="flex items-center gap-2 mb-8 group inline-block">
            <div className="w-10 h-10 bg-(--accents) rounded-xl flex items-center justify-center text-[#ece7e2] shadow-lg">
            <Image src="/logo/logo.png" alt='logo' width={24} height={24} />
            </div>
            <span className="text-2xl font-bold tracking-tighter text-(--text)">Asygurare<span className="text-[#4A7766]">.</span></span>
          </Link>

          <h1 className="text-4xl text-(--text) font-medium tracking-tight mb-8">Crea tu cuenta.</h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Nombre</label>
                <input name="firstName" required type="text" placeholder="Juan" className="w-full text-black bg-white border border-black/5 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#4A7766]/20 transition-all text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Apellido</label>
                <input name="lastName" required type="text" placeholder="Pérez" className="w-full text-black  bg-white border border-black/5 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#4A7766]/20 transition-all text-sm" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Nombre de tu Agencia</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input name="agencyName" required type="text" placeholder="Seguros Elite" className="text-black w-full bg-white border border-black/5 rounded-2xl py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-[#4A7766]/20 transition-all text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Ciudad</label>
                <input name="city" required type="text" placeholder="Ciudad de México" className="w-full text-black bg-white border border-black/5 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#4A7766]/20 transition-all text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">País</label>
                <input name="country" required type="text" placeholder="México" className="w-full text-black bg-white border border-black/5 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#4A7766]/20 transition-all text-sm" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input name="email" required type="email" placeholder="juan@agencia.com" className="text-black w-full bg-white border border-black/5 rounded-2xl py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-[#4A7766]/20 transition-all text-sm" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input name="password" required type="password" placeholder="••••••••" className="text-black  w-full bg-white border border-black/5 rounded-2xl py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-[#4A7766]/20 transition-all text-sm" />
              </div>
              <p className="text-[11px] font-bold text-black/40 leading-relaxed mt-1">{SITE_CONFIG.PASSWORD_RULES_TEXT}</p>
            </div>

            <label className="flex items-start gap-3 pt-2 select-none">
              <input
                name="acceptTerms"
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-black/20 accent-[#4A7766]"
                aria-required="true"
              />
              <span className="text-sm text-gray-600 leading-relaxed">
                Acepto los{" "}
                <Link href="/terms" className="underline text-[#1a1a1a] font-semibold">
                  Términos y Condiciones
                </Link>{" "}
                y la{" "}
                <Link href="/privacy" className="underline text-[#1a1a1a] font-semibold">
                  Política de Privacidad
                </Link>
                .
              </span>
            </label>

            <button 
              disabled={loading || !acceptedTerms}
              className="w-full bg-(--accents) text-white py-4 rounded-2xl font-bold hover:bg-blue-500 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Crear mi cuenta gratis"}
              {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            ¿Ya eres parte? <Link href="/login" className="text-[#1a1a1a] font-bold hover:underline">Inicia Sesión</Link>
          </p>
        </motion.div>
      </section>

      {/* Lado derecho decorativo (puedes reutilizar el diseño anterior) */}
      <section className="hidden lg:flex flex-1 bg-[#1a1a1a] items-center justify-center p-20">
          <div className="max-w-xs">
            <h2 className="text-[#ece7e2] text-4xl font-medium mb-6">Tu nueva era comienza <span className="text-(--accents) italic">ahora.</span></h2>
            <p className="text-[#ece7e2]/50 text-sm">Al registrarte, obtienes acceso inmediato a todas las herramientas Pro por 15 días.</p>
          </div>
      </section>
    </main>
  )
}