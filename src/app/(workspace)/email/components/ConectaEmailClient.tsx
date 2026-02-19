"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Link2Off, RefreshCw } from "lucide-react"

type GmailStatus =
  | { connected: false; error?: string }
  | {
      connected: true
      email: string | null
      scope: string | null
      updated_at: string | null
      created_at: string | null
    }

export default function ConectaEmailClient({
  banner,
  reason,
}: {
  banner: string | null
  reason: string | null
}) {
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [status, setStatus] = useState<GmailStatus>({ connected: false })
  const hasSendScope =
    status.connected && typeof status.scope === "string"
      ? status.scope.includes("gmail.send")
      : false

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/gmail/status", { cache: "no-store" })
      const json = (await res.json()) as GmailStatus
      setStatus(json)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onDisconnect = async () => {
    setDisconnecting(true)
    try {
      await fetch("/api/gmail/disconnect", { method: "POST" })
      await load()
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[2rem] border border-black/5 bg-white p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white rounded-2xl border border-black/5">
              <Image src="/logo_integrations/logo_gmail.png" alt="Logo de Gmail" width={58} height={18} />
            </div>
            <div>
              <p className="text-[11px] font-black text-black uppercase tracking-widest">Conecta tu email</p>
              <p className="text-[11px] font-bold text-black/40">
                Paso 1: conecta Google para enviar, usar plantillas y firma electronica.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refrescar
            </button>
            {status.connected ? (
              <button
                type="button"
                onClick={onDisconnect}
                disabled={disconnecting}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 disabled:opacity-60"
              >
                <Link2Off size={14} />
                {disconnecting ? "Desconectando..." : "Desconectar"}
              </button>
            ) : (
              <a
                href="/api/gmail/oauth/start"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/85"
              >
                <Image src="/logo_integrations/logo_gmail.png" alt="Logo de Gmail" width={14} height={14} />
                Conectar Google
              </a>
            )}
          </div>
        </div>

        {banner === "connected" ? (
          <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-[1.2rem] p-4">
            <p className="text-sm font-black text-emerald-800">Gmail conectado correctamente.</p>
          </div>
        ) : null}

        {banner === "error" ? (
          <div className="mt-5 bg-red-50 border border-red-200 rounded-[1.2rem] p-4">
            <p className="text-sm font-black text-red-700">
              Error conectando Gmail{reason ? `: ${reason}` : "."}
            </p>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-gray-50/70 border border-black/5 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Cuenta</p>
            <p className="text-sm font-black text-black mt-1">{status.connected ? status.email ?? "—" : "—"}</p>
          </div>
          <div className="rounded-2xl bg-gray-50/70 border border-black/5 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Permisos</p>
            <p className={`text-sm font-black mt-1 ${hasSendScope ? "text-emerald-700" : "text-red-700"}`}>
              {status.connected ? (hasSendScope ? "Puede enviar" : "No puede enviar") : "—"}
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50/70 border border-black/5 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Estado</p>
            <p className="text-sm font-black text-black/60 mt-1">
              {loading ? "Cargando..." : status.connected ? "Conectado" : "No conectado"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Link
          href="/email/enviar"
          className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-[2rem] bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/85"
        >
          Continuar a enviar
        </Link>
      </div>
    </div>
  )
}
