"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import {
  CircleHelp,
  Headset,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  User2Icon,
} from "lucide-react"
import { supabaseClient } from "@/src/lib/supabase/client"
import { toast, Toaster } from "sonner"

const channels = [
  {
    title: "Chat por WhatsApp",
    description: "Habla con soporte para dudas rápidas sobre uso de la plataforma.",
    cta: "Abrir chat",
    href: "https://wa.me/34607441986",
    icon: MessageCircle,
  },
  {
    title: "Correo de soporte",
    description: "Envía evidencia y detalles técnicos para seguimiento por ticket.",
    cta: "Enviar correo",
    href: "mailto:admin@asygurare.com",
    icon: Mail,
  },
  {
    title: "Agenda una reunión",
    description: "Agenda una llamada para implementación, onboarding o capacitación.",
    cta: "Solicitar reunión",
    href: "https://cal.com/asygurare/30min",
    icon: User2Icon,
  },
]

const faqs = [

  {
    q: "¿Cómo recupero una oportunidad eliminada?",
    a: "Por ahora no hay papelera publica en prospectos. Escríbenos con nombre del prospecto y fecha aproximada para revisar respaldo.",
  },
  {
    q: "¿Cuánto tarda una respuesta de soporte?",
    a: "Chat: 5-20 min en horario laboral. Correo: menos de 24 horas habiles. Incidencias criticas: seguimiento prioritario.",
  },
  {
    q: "¿Puedo pedir un tutorial?",
    a: "Claro, agenda una reunión y nuestro equipo técnico te guiará para sacar el 100% de Asygurare.",
  },
]

export default function SoportePage() {
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return

    const form = e.currentTarget
    const formData = new FormData(form)
    const name = String(formData.get("nombre") || "").trim()
    const email = String(formData.get("correo") || "").trim()
    const message = String(formData.get("mensaje") || "").trim()

    if (!name || !email || !message) {
      toast.error("Completa todos los campos obligatorios.")
      return
    }

    setSubmitting(true)
    try {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser()

      if (!user) {
        toast.error("Tu sesión expiró. Inicia sesión de nuevo.")
        return
      }

      const { error } = await supabaseClient.from("WS_SUPPORT").insert([
        {
          user_id: user.id,
          name,
          email,
          message,
          status: "new",
          source: "workspace_soporte",
        },
      ])

      if (error) throw error

      toast.success("Mensaje enviado. Te responderemos pronto.")
      form.reset()
    } catch (error: any) {
      toast.error(`No se pudo enviar el mensaje: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-8 pb-8">
      <Toaster richColors position="top-center" />
      <div className="rounded-[2.2rem] border border-black/5 bg-white p-6 shadow-sm sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-(--accents)/20 bg-(--accents)/10 px-4 py-1">
          <Headset className="h-4 w-4 text-(--accents)" />
          <span className="text-[11px] font-black uppercase tracking-widest text-(--accents)">
            Soporte Asygurare
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-black tracking-tight text-black sm:text-4xl">
          Te ayudamos a resolverlo rapido.
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-bold leading-relaxed text-black/50 sm:text-base">
          Estamos aqui para ayudarte con problemas tecnicos, dudas de uso y configuraciones
          de tu workspace. Elige el canal que prefieras y te damos seguimiento.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {channels.map((channel) => (
          <Link
            key={channel.title}
            href={channel.href}
            target={channel.href.startsWith("http") ? "_blank" : undefined}
            rel={channel.href.startsWith("http") ? "noreferrer" : undefined}
            className="group rounded-[2rem] border border-black/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-(--accents)/30 hover:shadow-md"
          >
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-(--accents)/10 text-(--accents)">
              <channel.icon className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-black">{channel.title}</h2>
            <p className="mt-2 text-sm font-bold leading-relaxed text-black/45">
              {channel.description}
            </p>
            <p className="mt-5 inline-flex text-xs font-black uppercase tracking-widest text-(--accents)">
              {channel.cta}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="rounded-[2rem] border border-black/5 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-5 flex items-center gap-2">
            <CircleHelp className="h-5 w-5 text-(--accents)" />
            <p className="text-xs font-black uppercase tracking-widest text-black/40">
              Preguntas frecuentes
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="rounded-2xl border border-black/5 bg-(--bg) p-4 open:border-(--accents)/25"
              >
                <summary className="cursor-pointer list-none text-sm font-black text-black sm:text-base">
                  {faq.q}
                </summary>
                <p className="mt-3 text-sm font-bold leading-relaxed text-black/50">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-black/5 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-2">
            <Send className="h-5 w-5 text-(--accents)" />
            <p className="text-xs font-black uppercase tracking-widest text-black/40">
              Envíanos un mensaje
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="support-name" className="mb-2 block text-xs font-black uppercase tracking-widest text-black/45">
                Nombre
              </label>
              <input
                id="support-name"
                name="nombre"
                type="text"
                required
                className="w-full rounded-2xl border border-black/10 bg-(--bg) px-4 py-3 text-sm font-bold text-black outline-none transition-all focus:border-(--accents)/40"
                placeholder="Tu nombre completo"
              />
            </div>

            <div>
              <label htmlFor="support-email" className="mb-2 block text-xs font-black uppercase tracking-widest text-black/45">
                Correo
              </label>
              <input
                id="support-email"
                name="correo"
                type="email"
                required
                className="w-full rounded-2xl border border-black/10 bg-(--bg) px-4 py-3 text-sm font-bold text-black outline-none transition-all focus:border-(--accents)/40"
                placeholder="tu@correo.com"
              />
            </div>

            <div>
              <label htmlFor="support-message" className="mb-2 block text-xs font-black uppercase tracking-widest text-black/45">
                Mensaje
              </label>
              <textarea
                id="support-message"
                name="mensaje"
                required
                rows={5}
                className="w-full resize-none rounded-2xl border border-black/10 bg-(--bg) px-4 py-3 text-sm font-bold text-black outline-none transition-all focus:border-(--accents)/40"
                placeholder="Cuéntanos qué necesitas y te respondemos lo antes posible."
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-(--accents) px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? "Enviando..." : "Enviar mensaje"}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}