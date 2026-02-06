"use client"

import React, { useMemo, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "@/lib/supabase/supabase"
import { ArrowRight, Mail, Loader2, CheckCircle2, ShieldCheck } from "lucide-react"

export default function ForgetPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return undefined
    return `${window.location.origin}/update-password`
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData(e.currentTarget)
      const email = String(formData.get("email") ?? "").trim().toLowerCase()

      if (!email) {
        setError("Por favor escribe tu correo.")
        setLoading(false)
        return
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (resetError) {
        setError(resetError.message)
        setLoading(false)
        return
      }

      setSent(true)
      setLoading(false)
    } catch (err) {
      console.error("Error inesperado:", err)
      setError("Error de conexión.")
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#ece7e2] flex overflow-hidden">
      {/* --- LADO IZQUIERDO: FORMULARIO --- */}
      <section className="w-full lg:w-[45%] flex flex-col justify-center px-8 md:px-20 bg-white z-10">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="max-w-md w-full mx-auto">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mb-12 group inline-block">
            <div className="w-10 h-10 bg-(--accents) rounded-xl flex items-center justify-center text-[#ece7e2] shadow-lg shadow-black/5 transition-transform group-hover:rotate-12">
              <Image src="/logo/logo.png" alt="logo" width={24} height={24} />
            </div>
            <span className="text-2xl font-bold tracking-tighter text-[#1a1a1a]">
              Asygurare<span className="text-[#4A7766]">.</span>
            </span>
          </Link>

          <h1 className="text-4xl text-black font-medium tracking-tight mb-2">¿Olvidaste tu contraseña?</h1>
          <p className="text-gray-500 mb-8">
            Escribe tu correo y te enviaremos un email con instrucciones para restablecerla.
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl"
            >
              {error}
            </motion.div>
          )}

          {sent ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-black/5 p-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-(--accents)">
                  <CheckCircle2 size={20} />
                </div>
                <div className="text-sm">
                  <p className="font-bold text-[#1a1a1a]">Listo.</p>
                  <p className="text-gray-600 mt-1">
                    Si existe una cuenta con ese correo, te llegará un email con el enlace para cambiar tu contraseña.
                    Revisa también spam/promociones.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/login"
                  className="w-full bg-[#1a1a1a] text-white py-4 rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 group shadow-xl shadow-black/5"
                >
                  Volver a iniciar sesión
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>

                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="w-full py-4 rounded-2xl font-bold border border-black/10 text-[#1a1a1a] hover:bg-black/5 transition-all"
                >
                  Enviar a otro correo
                </button>
              </div>
            </motion.div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    required
                    name="email"
                    type="email"
                    placeholder="nombre@correo.com"
                    className="w-full bg-white border border-black/5 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#4A7766]/20 focus:border-[#4A7766] text-black transition-all"
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
                    Enviar instrucciones
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <div className="rounded-2xl p-4 bg-black/5 border border-black/5 text-xs text-gray-600 flex items-start gap-2">
                <ShieldCheck size={16} className="mt-0.5 text-gray-500" />
                <p>
                  Por seguridad, no confirmamos si el correo existe. Si lo tienes registrado, te llegará un email con el enlace.
                </p>
              </div>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-gray-500">
            ¿Ya la recordaste?{" "}
            <Link href="/login" className="text-(--accents) font-bold hover:underline">
              Inicia sesión
            </Link>
          </p>
        </motion.div>
      </section>

      {/* --- LADO DERECHO: VISUAL IMPACT --- */}
      <section className="hidden lg:flex flex-1 relative bg-black items-center justify-center p-20">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ece7e2' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 text-center">
          <h2 className="text-[#ece7e2] text-5xl font-medium tracking-tight leading-tight">
            Recupera acceso <br />
            <span className="opacity-60 italic">en minutos.</span>
          </h2>
          <p className="mt-6 text-[#ece7e2]/60 text-sm max-w-sm mx-auto">
            Te enviaremos un enlace seguro para restablecer tu contraseña y volver a tu dashboard.
          </p>
        </motion.div>

        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-black/10 rounded-full blur-3xl" />
      </section>
    </main>
  )
}
