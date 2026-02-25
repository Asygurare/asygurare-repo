"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { supabaseClient } from "@/src/lib/supabase/client"
import { DATABASE } from "@/src/config/database"

export default function CompleteProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [agencyName, setAgencyName] = useState("")
  const [city, setCity] = useState("")
  const [country, setCountry] = useState("")

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true)
      setError(null)
      const { data: authData, error: authError } = await supabaseClient.auth.getUser()
      if (authError || !authData.user) {
        router.replace("/login")
        return
      }

      const metadata = (authData.user.user_metadata || {}) as Record<string, unknown>
      const fullName = String(metadata.full_name ?? "").trim()
      const fullParts = fullName ? fullName.split(" ").filter(Boolean) : []
      const metaFirst = String(metadata.first_name ?? fullParts[0] ?? "").trim()
      const metaLast = String(metadata.last_name ?? fullParts.slice(1).join(" ") ?? "").trim()
      const metaAgency = String(metadata.agency_name ?? "").trim()
      const metaCity = String(metadata.city ?? "").trim()
      const metaCountry = String(metadata.country ?? "").trim()

      const { data: profile } = await supabaseClient
        .from(DATABASE.TABLES.PROFILES)
        .select("first_name, last_name, agency_name, city, country")
        .eq("id", authData.user.id)
        .maybeSingle<{
          first_name: string | null
          last_name: string | null
          agency_name: string | null
          city: string | null
          country: string | null
        }>()

      const nextFirst = String(profile?.first_name ?? metaFirst).trim()
      const nextLast = String(profile?.last_name ?? metaLast).trim()
      const nextAgency = String(profile?.agency_name ?? metaAgency).trim()
      const nextCity = String(profile?.city ?? metaCity).trim()
      const nextCountry = String(profile?.country ?? metaCountry).trim()

      setFirstName(nextFirst)
      setLastName(nextLast)
      setAgencyName(nextAgency)
      setCity(nextCity)
      setCountry(nextCountry)

      const hasRequired =
        !!nextAgency &&
        !!nextCity &&
        !!nextCountry

      if (hasRequired) {
        router.replace("/dashboard")
        return
      }

      setLoading(false)
    }

    loadProfile()
  }, [router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const agency = agencyName.trim()
    const cityVal = city.trim()
    const countryVal = country.trim()

    if (!agency || !cityVal || !countryVal) {
      setError("Completa agencia, ciudad y país para continuar.")
      return
    }

    setSaving(true)
    const { data: authData, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !authData.user) {
      setSaving(false)
      router.replace("/login")
      return
    }

    const user = authData.user
    const metadata = (user.user_metadata || {}) as Record<string, unknown>

    const nextMeta = {
      ...metadata,
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
      agency_name: agency,
      city: cityVal,
      country: countryVal,
      onboarding_completed: true,
    }

    const { error: metaError } = await supabaseClient.auth.updateUser({ data: nextMeta })
    if (metaError) {
      setSaving(false)
      setError(metaError.message)
      return
    }

    const { error: profileError } = await supabaseClient
      .from(DATABASE.TABLES.PROFILES)
      .update({
        first_name: firstName.trim() || "Usuario",
        last_name: lastName.trim() || null,
        agency_name: agency,
        city: cityVal,
        country: countryVal,
      })
      .eq("id", user.id)

    if (profileError) {
      setSaving(false)
      setError(profileError.message)
      return
    }

    setSaving(false)
    router.replace("/dashboard")
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#ece7e2] flex items-center justify-center px-6">
        <div className="flex items-center gap-3 text-[#1a1a1a]">
          <Loader2 className="animate-spin" size={20} />
          <span className="font-medium">Preparando tu cuenta...</span>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#ece7e2] flex items-center justify-center px-6 py-10">
      <section className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-black/5 p-8">
        <h1 className="text-3xl font-semibold text-[#1a1a1a] tracking-tight mb-2">Completa tu perfil</h1>
        <p className="text-gray-600 mb-8">
          Para terminar tu registro con Google, necesitamos estos datos de tu agencia.
        </p>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Nombre"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full text-black bg-white border border-black/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#4A7766]/20"
            />
            <input
              type="text"
              placeholder="Apellido"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full text-black bg-white border border-black/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#4A7766]/20"
            />
          </div>

          <input
            type="text"
            placeholder="Nombre de la agencia"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            required
            className="w-full text-black bg-white border border-black/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#4A7766]/20"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Ciudad"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              className="w-full text-black bg-white border border-black/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#4A7766]/20"
            />
            <input
              type="text"
              placeholder="País"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
              className="w-full text-black bg-white border border-black/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#4A7766]/20"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#1a1a1a] text-white py-3 rounded-xl font-semibold hover:bg-black transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : "Guardar y continuar"}
          </button>
        </form>

        <p className="mt-5 text-xs text-gray-500 text-center">
          ¿Te equivocaste de cuenta? <Link href="/login" className="underline">Volver a login</Link>
        </p>
      </section>
    </main>
  )
}
