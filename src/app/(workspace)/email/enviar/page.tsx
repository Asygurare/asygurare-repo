import AutomatizacionesClient from "../AutomatizacionesClient"

export default async function EmailEnviarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const banner = typeof sp.gmail === "string" ? sp.gmail : null
  const reason = typeof sp.reason === "string" ? sp.reason : null

  return <AutomatizacionesClient banner={banner} reason={reason} initialSection="enviar" />
}
