"use client"

import React, { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { supabaseClient } from "@/src/lib/supabase/client"
import { ArrowRight, Lock, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"

export default function UpdatePasswordPage() {
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const redirectToLogin = useMemo(() => "/login?message=Contraseña actualizada. Inicia sesión.", [])

  useEffect(() => {
    let mounted = true

    const run = async () => {
      try {
        // Con detectSessionInUrl: true, Supabase debería leer el token del link y crear sesión.
        const { data, error: sessionError } = await supabaseClient.auth.getSession()

        if (!mounted) return

        if (sessionError) {
          console.error(sessionError)
          setHasSession(false)
        } else {
          setHasSession(Boolean(data.session))
        }
      } finally {
        if (mounted) setChecking(false)
      }
    }

    run()
    return () => {
      mounted = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData(e.currentTarget)
      const password = String(formData.get("password") ?? "")
      const confirm = String(formData.get("confirm") ?? "")

      if (password.length < 8) {
        setError("Tu contraseña debe tener al menos 8 caracteres.")
        setLoading(false)
        return
      }
      if (password !== confirm) {
        setError("Las contraseñas no coinciden.")
        setLoading(false)
        return
      }

      const { error: updateError } = await supabaseClient.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      // Buen practice: cerrar la sesión temporal del reset.
      await supabaseClient.auth.signOut()

      setDone(true)
      setLoading(false)
    } catch (err) {
      console.error("Error inesperado:", err)
      setError("Error de conexión.")
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#ece7e2] flex overflow-hidden">
      <section className="w-full lg:w-[45%] flex flex-col justify-center px-8 md:px-20 bg-white z-10">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="max-w-md w-full mx-auto">
          <Link href="/" className="flex items-center gap-2 mb-12 group inline-block">
            <div className="w-10 h-10 bg-(--accents) rounded-xl flex items-center justify-center text-[#ece7e2] shadow-lg shadow-black/5 transition-transform group-hover:rotate-12">
              <Image src="/logo/logo.png" alt="logo" width={24} height={24} />
            </div>
            <span className="text-2xl font-bold tracking-tighter text-[#1a1a1a]">
              Asygurare<span className="text-[#4A7766]">.</span>
            </span>
          </Link>

          <h1 className="text-4xl text-black font-medium tracking-tight mb-2">Nueva contraseña</h1>
          <p className="text-gray-500 mb-8">Elige una contraseña segura para tu cuenta.</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl"
            >
              {error}
            </motion.div>
          )}

          {checking ? (
            <div className="rounded-3xl border border-black/5 p-6 text-sm text-gray-600 flex items-center gap-3">
              <Loader2 className="animate-spin" size={18} />
              Verificando enlace…
            </div>
          ) : done ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-black/5 p-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-(--accents)">
                  <CheckCircle2 size={20} />
                </div>
                <div className="text-sm">
                  <p className="font-bold text-[#1a1a1a]">Contraseña actualizada.</p>
                  <p className="text-gray-600 mt-1">Ya puedes iniciar sesión con tu nueva contraseña.</p>
                </div>
              </div>

              <Link
                href={redirectToLogin}
                className="mt-6 w-full bg-[#1a1a1a] text-white py-4 rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 group shadow-xl shadow-black/5"
              >
                Ir a iniciar sesión
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          ) : !hasSession ? (
            <div className="rounded-3xl border border-black/5 p-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-amber-600">
                  <AlertTriangle size={20} />
                </div>
                <div className="text-sm">
                  <p className="font-bold text-[#1a1a1a]">Enlace inválido o expirado.</p>
                  <p className="text-gray-600 mt-1">Solicita un nuevo correo para restablecer tu contraseña.</p>
                </div>
              </div>

              <Link
                href="/forget-password"
                className="mt-6 w-full bg-[#1a1a1a] text-white py-4 rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 group shadow-xl shadow-black/5"
              >
                Solicitar nuevo enlace
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Nueva contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    required
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-white text-black border border-black/5 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#4A7766]/20 focus:border-[#4A7766] transition-all"
                  />
                </div>
                <p className="text-xs text-gray-500 ml-1">Mínimo 8 caracteres.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Confirmar contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    required
                    name="confirm"
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-white text-black border border-black/5 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#4A7766]/20 focus:border-[#4A7766] transition-all"
                  />
                </div>
              </div>

              <button
                disabled={loading}
                className="w-full bg-[#1a1a1a] text-white py-4 rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 group shadow-xl shadow-black/5 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    Guardar contraseña
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-gray-500">
            ¿Necesitas volver?{" "}
            <Link href="/login" className="text-(--accents) font-bold hover:underline">
              Inicia sesión
            </Link>
          </p>
        </motion.div>
      </section>

      <section className="hidden lg:flex flex-1 relative bg-black items-center justify-center p-20">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ece7e2' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 text-center">
          <h2 className="text-[#ece7e2] text-5xl font-medium tracking-tight leading-tight">
            Seguridad <br />
            <span className="opacity-60 italic">primero.</span>
          </h2>
          <p className="mt-6 text-[#ece7e2]/60 text-sm max-w-sm mx-auto">
            Este enlace es de un solo uso y expira. Si necesitas otro, puedes solicitarlo en un minuto.
          </p>
        </motion.div>

        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-black/10 rounded-full blur-3xl" />
      </section>
    </main>
  )
}

