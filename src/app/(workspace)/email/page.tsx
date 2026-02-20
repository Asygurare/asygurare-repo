import { redirect } from "next/navigation"

export default async function AutomatizacionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const qs = new URLSearchParams()
  if (typeof sp.gmail === "string") qs.set("gmail", sp.gmail)
  if (typeof sp.reason === "string") qs.set("reason", sp.reason)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""

  redirect(`/email/conecta-tu-email${suffix}`)
}

