import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { getAdminClient } from "@/src/lib/supabase/admin"
import { DATABASE } from "@/src/config"
import { getAppUrl, getStripePriceId, getStripeServer } from "@/src/lib/stripe/server"

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
    const priceId = getStripePriceId()
    const appUrl = getAppUrl()

    const { data: billingCustomer } = await admin
      .from(DATABASE.TABLES.WS_BILLING_CUSTOMERS)
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle<{ stripe_customer_id: string }>()

    let stripeCustomerId = billingCustomer?.stripe_customer_id ?? null
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { user_id: user.id },
      })
      stripeCustomerId = customer.id

      await admin.from(DATABASE.TABLES.WS_BILLING_CUSTOMERS).upsert(
        [
          {
            user_id: user.id,
            stripe_customer_id: stripeCustomerId,
            email: user.email ?? null,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "user_id" },
      )
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      locale: "es",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: "always",
      allow_promotion_codes: true,
      success_url: `${appUrl}/dashboard?billing=success`,
      cancel_url: `${appUrl}/pricing?billing=cancel`,
      metadata: {
        user_id: user.id,
        plan: "pro",
      },
      subscription_data: {
        trial_period_days: 15,
        metadata: {
          user_id: user.id,
          plan: "pro",
        },
      },
    })

    return NextResponse.json(
      { ok: true, url: checkoutSession.url, sessionId: checkoutSession.id },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    )
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 500 })
  }
}
