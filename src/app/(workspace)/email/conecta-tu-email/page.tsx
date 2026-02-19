import ConectaEmailClient from "../components/ConectaEmailClient"

export default async function EmailConectaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const banner = typeof sp.gmail === "string" ? sp.gmail : null
  const reason = typeof sp.reason === "string" ? sp.reason : null

  return <ConectaEmailClient banner={banner} reason={reason} />
}
