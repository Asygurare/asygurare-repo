"use client"

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseClient } from '@/src/lib/supabase/client'
import { ArrowRight, Mail, Lock, Eye, EyeOff, Loader2, Info, MailCheck, X } from 'lucide-react'
import { toast, Toaster } from 'sonner'

const transition = { duration: 0.8, ease: [0.76, 0, 0.24, 1] }

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeParam = searchParams.get('code')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (codeParam === 'confirm_email') {
      setShowConfirmModal(true)
      // Limpiar la URL para que al recargar no se vuelva a mostrar el modal
      router.replace('/login', { scroll: false })
    } else if (codeParam === 'email_confirmed') {
      toast.success('Cuenta verificada', {
        description: 'Tu correo ha sido confirmado. Ya puedes iniciar sesión.',
      })
      router.replace('/login', { scroll: false })
    }
  }, [codeParam, router])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;

      // 1. Una sola llamada a Supabase
      const { data, error: authError } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.code === "email_not_confirmed") {
          setError("Tu correo no ha sido confirmado. Por favor, verifica tu correo y vuelve a intentarlo.");
        }
        else {
          setError(authError.message === "Invalid login credentials"
            ? "Correo o contraseña incorrectos."
            : authError.message
          );
        }
        setLoading(false);
        return;
      }

      // 2. Si hay usuario, redirigimos en la misma pestaña
      if (data?.user) {
        console.log("LOGIN EXITOSO:", data.user);

        // window.location.replace es mejor que .href para logins 
        // porque no deja la página de login en el historial (el botón "atrás" no te regresa al login)
        window.location.replace('/dashboard');
      }
    } catch (err) {
      console.error("Error inesperado:", err);
      setError("Error de conexión.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#ece7e2] flex overflow-hidden">
      <Toaster richColors position="top-center" />

      {/* Modal: confirmar email */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowConfirmModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative border border-black/5"
            >
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
              <div className="flex flex-col items-center text-center pt-2">
                <div className="w-14 h-14 rounded-full bg-[#4A7766]/10 flex items-center justify-center mb-4">
                  <MailCheck className="text-[#4A7766]" size={28} />
                </div>
                <h3 className="text-xl font-bold text-[#1a1a1a] mb-2">Revisa tu correo</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Te hemos enviado un correo electrónico. Por favor, confirma tu cuenta haciendo clic en el enlace que te enviamos y luego inicia sesión aquí.
                </p>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="mt-6 w-full bg-[#1a1a1a] text-white py-3 rounded-2xl font-bold hover:bg-black transition-all"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- LADO IZQUIERDO: FORMULARIO --- */}
      <section className="w-full lg:w-[45%] flex flex-col justify-center py-10 px-8 md:px-20 bg-white z-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-md w-full mx-auto"
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mb-12 group inline-block">
            <div className="w-10 h-10 bg-(--accents) rounded-xl flex items-center justify-center text-[#ece7e2] shadow-lg shadow-[#4A7766]/20 transition-transform group-hover:rotate-12">
              <Image src="/logo/logo.png" alt='logo' width={24} height={24} />
            </div>
            <span className="text-2xl font-bold tracking-tighter text-[#1a1a1a]">
              Asygurare<span className="text-[#4A7766]">.</span>
            </span>
          </Link>

          <h1 className="text-4xl text-black font-medium tracking-tight mb-2">Bienvenido de nuevo.</h1>
          <p className="text-gray-500 mb-10">Tu copiloto está listo para cerrar más operaciones hoy.</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl"
            >
              {error}
            </motion.div>
          )}

          <form className="space-y-6" onSubmit={handleLogin}>
            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Email </label>
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

            {/* Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-sm font-bold text-gray-700">Contraseña</label>
                <Link href="/forget-password" className="text-xs font-bold text-(--accents) hover:underline">
                  ¿La olvidaste?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  required
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full bg-white text-black border border-black/5 rounded-2xl py-4 pl-12 pr-12 outline-none focus:ring-2 focus:ring-[#4A7766]/20 focus:border-[#4A7766] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#4A7766]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
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
                  Entrar al Dashboard
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            ¿Aún no tienes cuenta?{' '}
            <Link href="/signup" className="text-(--accents) font-bold hover:underline">
              Empieza tu prueba de 15 días
            </Link>
          </p>

          <div className="mt-6 flex items-start gap-3 p-4 rounded-2xl bg-[#4A7766]/5 border border-[#4A7766]/20">
            <Info className="shrink-0 text-[#4A7766] mt-0.5" size={18} />
            <p className="text-sm text-gray-700 leading-relaxed">
              Recuerda: Al crear tu cuenta por primera vez te enviaremos un correo para que la verifiques.
            </p>
          </div>
          
        </motion.div>
      </section>

      {/* --- LADO DERECHO: VISUAL IMPACT --- */}
      <section className="hidden lg:flex flex-1 relative bg-black items-center justify-center p-20">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ece7e2' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center"
        >
          {/* Testimonial Card */}
          <div className="mb-8 inline-block p-4 bg-white/10 backdrop-blur-lg rounded-[2.5rem] border border-white/20">
            <div className="bg-white rounded-2xl p-6 shadow-2xl">
              <p className="text-(--accents) font-bold text-lg mb-2 italic">"Asygurare ha duplicado mi capacidad de respuesta. Es, literalmente, mi socio silencioso."</p>
              <div className="flex items-center justify-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200" />
                <div className="text-left">
                  <p className="text-[10px] font-bold text-gray-900 leading-none">Marta Rodríguez</p>
                  <p className="text-[8px] text-gray-400 uppercase">Asesora Senior</p>
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-[#ece7e2] text-5xl font-medium tracking-tight leading-tight">
            La herramienta que <br />
            <span className="opacity-60 italic">realmente te escucha.</span>
          </h2>
        </motion.div>

        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-black/10 rounded-full blur-3xl" />
      </section>
    </main>
  )
}