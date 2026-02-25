"use client"

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseClient } from '@/src/lib/supabase/client'
import { ArrowRight, Mail, Lock, Eye, EyeOff, Loader2, Info, MailCheck, X } from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { validatePassword } from '@/src/lib/utils/auth/auth-service'
import { SITE_CONFIG } from '@/src/config/site'

function LoginFallback() {
  return (
    <main className="min-h-screen bg-[#ece7e2] flex overflow-hidden">
      <section className="w-full lg:w-[45%] flex flex-col justify-center py-10 px-8 md:px-20 bg-white z-10">
        <div className="max-w-md w-full mx-auto animate-pulse">
          <div className="h-10 w-32 bg-gray-200 rounded-xl mb-12" />
          <div className="h-10 w-3/4 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-1/2 bg-gray-100 rounded mb-10" />
          <div className="h-14 bg-gray-100 rounded-2xl mb-4" />
          <div className="h-14 bg-gray-100 rounded-2xl mb-6" />
          <div className="h-14 bg-gray-200 rounded-2xl" />
        </div>
      </section>
      <section className="hidden lg:flex flex-1 bg-black" />
    </main>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeParam = searchParams.get('code')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (codeParam === 'auth_error') {
      setError('No se pudo iniciar sesión con Google. Inténtalo de nuevo.')
      router.replace('/login', { scroll: false })
    } else if (codeParam === 'confirm_email') {
      setShowConfirmModal(true)
      // Limpiar la URL para que al recargar no se vuelva a mostrar el modal
      router.replace('/login', { scroll: false })
    } else if (codeParam === 'email_confirmed') {
      toast.success('Cuenta verificada', {
        description: 'Tu correo ha sido confirmado. Ya puedes iniciar sesión.',
      })
      router.replace('/login', { scroll: false })
    } else if (codeParam === 'password_updated') {
      toast.success('Contraseña actualizada', {
        description: 'Tu contraseña ha sido actualizada. Ya puedes iniciar sesión.',
      })
      router.replace('/login', { scroll: false })
    } else if (codeParam === 'account_deleted') {
      toast.success('Cuenta eliminada', {
        description: 'Tu cuenta ha sido eliminada correctamente',
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

      if (!validatePassword(password).isValid) {
        setError(validatePassword(password).message ?? SITE_CONFIG.PASSWORD_RULES_TEXT)
        setLoading(false)
        return
      }

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

  const handleGoogleSignIn = useCallback(async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/api/auth/callback?next=/dashboard`,
      },
    })
  }, [])

  const handleResendConfirmation = useCallback(async () => {
    const email = emailInputRef.current?.value?.trim().toLowerCase()
    if (!email) {
      toast.error('Introduce tu email arriba y vuelve a hacer clic para reenviar el correo.')
      return
    }
    setResendLoading(true)
    try {
      const { error: resendError } = await supabaseClient.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login?code=email_confirmed`,
        },
      })
      if (resendError) {
        toast.error(resendError.message)
        return
      }
      toast.success('Correo de confirmación reenviado', {
        description: 'Revisa tu bandeja de entrada (y spam) y haz clic en el enlace.',
      })
    } catch (err) {
      console.error('Error al reenviar:', err)
      toast.error('Error al reenviar el correo.')
    } finally {
      setResendLoading(false)
    }
  }, []);

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
                  ref={emailInputRef}
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

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-black/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-3 text-gray-500">o continúa con</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full bg-white border border-black/10 text-gray-700 py-4 rounded-2xl font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-3 shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continuar con Google
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
              Si no te ha llegado este correo,{' '}
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resendLoading}
                className="text-(--accents) font-bold hover:underline inline-flex items-center gap-1 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {resendLoading ? (
                  <>
                    <Loader2 className="animate-spin shrink-0" size={14} />
                    Reenviando…
                  </>
                ) : (
                  'haz clic aquí'
                )}
              </button>
              .
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

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  )
}