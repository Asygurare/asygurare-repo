import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { getAdminClient } from "@/src/lib/supabase/admin"
import { DATABASE } from "@/src/config"
import { getStripeServer } from "@/src/lib/stripe/server"
import { isSubscriptionHealthy, mapStripeSubscription } from "@/src/services/billing/subscription"

export const runtime = "nodejs"

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error interno"
}

async function resolveExpandedSubscription(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  if (!session.subscription) return null
  if (typeof session.subscription === "string") {
    return stripe.subscriptions.retrieve(session.subscription)
  }
  return session.subscription
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get("session_id")
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "session_id es requerido" }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
    }

    const stripe = getStripeServer()
    const admin = getAdminClient()

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    })
    if (!session || session.mode !== "subscription" || !session.customer) {
      return NextResponse.json({ ok: false, error: "Sesión de checkout inválida" }, { status: 400 })
    }
    if (session.status !== "complete") {
      return NextResponse.json({ ok: false, error: "Checkout aún no está completo" }, { status: 409 })
    }

    // Protección anti-session-hijacking: la sesión debe estar ligada al usuario actual.
    const metadataUserId = session.metadata?.user_id ?? null
    if (metadataUserId && metadataUserId !== user.id) {
      return NextResponse.json({ ok: false, error: "La sesión no pertenece al usuario autenticado" }, { status: 403 })
    }

    const stripeCustomerId = String(session.customer)
    const { data: existingCustomer } = await admin
      .from(DATABASE.TABLES.WS_BILLING_CUSTOMERS)
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle()

    const currentStripeCustomerId = (existingCustomer as { stripe_customer_id?: string } | null)?.stripe_customer_id

    if (currentStripeCustomerId && currentStripeCustomerId !== stripeCustomerId) {
      return NextResponse.json({ ok: false, error: "Sesión no corresponde al usuario autenticado" }, { status: 403 })
    }

    await admin.from(DATABASE.TABLES.WS_BILLING_CUSTOMERS).upsert(
      [
        {
          user_id: user.id,
          stripe_customer_id: stripeCustomerId,
          email: user.email ?? null,
          updated_at: new Date().toISOString(),
        },
      ] as unknown as never,
      { onConflict: "user_id" },
    )

    const subscription = await resolveExpandedSubscription(stripe, session)
    if (subscription) {
      await admin.from(DATABASE.TABLES.WS_BILLING_SUBSCRIPTIONS).upsert(
        [
          {
            user_id: user.id,
            ...mapStripeSubscription(subscription),
          },
        ] as unknown as never,
        { onConflict: "user_id" },
      )

      if (!isSubscriptionHealthy(subscription.status)) {
        return NextResponse.json(
          { ok: false, error: `Suscripción no activa todavía (${subscription.status})` },
          { status: 409 },
        )
      }
    }

    await admin.from(DATABASE.TABLES.WS_BILLING_CHECKOUT_SESSIONS).upsert(
      [
        {
          user_id: user.id,
          stripe_checkout_session_id: session.id,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: session.subscription
            ? typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id
            : null,
          checkout_status: session.status ?? "complete",
          payment_status: session.payment_status ?? null,
          completed_at: new Date().toISOString(),
          consumed_at: new Date().toISOString(),
        },
      ] as unknown as never,
      { onConflict: "stripe_checkout_session_id" },
    )

    const currentMetadata = (user.user_metadata || {}) as Record<string, unknown>
    if (currentMetadata.trial_checkout_required) {
      const mergedMetadata = {
        ...currentMetadata,
        trial_checkout_required: false,
      }
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: mergedMetadata,
      })
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: { "Cache-Control": "no-store" } })
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 500 })
  }
}
