import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { getAdminClient } from "@/src/lib/supabase/admin"
import { DATABASE } from "@/src/config"
import { getAppUrl, getStripeServer } from "@/src/lib/stripe/server"

export const runtime = "nodejs"

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error interno"
}

export async function POST() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
    }

    const admin = getAdminClient()
    const stripe = getStripeServer()
    const appUrl = getAppUrl()

    const { data: billingCustomer } = await admin
      .from(DATABASE.TABLES.WS_BILLING_CUSTOMERS)
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle<{ stripe_customer_id: string }>()

    if (!billingCustomer?.stripe_customer_id) {
      return NextResponse.json(
        { ok: false, error: "No se encontró cliente de facturación" },
        { status: 404 },
      )
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: billingCustomer.stripe_customer_id,
      locale: "es",
      return_url: `${appUrl}/settings`,
    })

    return NextResponse.json(
      { ok: true, url: portalSession.url },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    )
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 500 })
  }
}
