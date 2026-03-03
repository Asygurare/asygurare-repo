import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getAdminClient } from "@/src/lib/supabase/admin"
import { DATABASE } from "@/src/config"
import { getStripeServer, getStripeWebhookSecret } from "@/src/lib/stripe/server"
import { mapStripeSubscription } from "@/src/services/billing/subscription"

export const runtime = "nodejs"

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error interno"
}

async function resolveUserIdByCustomer(stripeCustomerId: string) {
  const admin = getAdminClient()
  const { data } = await admin
    .from(DATABASE.TABLES.WS_BILLING_CUSTOMERS)
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle<{ user_id: string }>()
  return data?.user_id ?? null
}

async function upsertCustomer(params: { userId: string; stripeCustomerId: string; email?: string | null }) {
  const admin = getAdminClient()
  await admin.from(DATABASE.TABLES.WS_BILLING_CUSTOMERS).upsert(
    [
      {
        user_id: params.userId,
        stripe_customer_id: params.stripeCustomerId,
        email: params.email ?? null,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "user_id" },
  )
}

async function upsertSubscriptionForUser(userId: string, stripeSubscription: Stripe.Subscription) {
  const admin = getAdminClient()
  const mapped = mapStripeSubscription(stripeSubscription)

  await admin.from(DATABASE.TABLES.WS_BILLING_SUBSCRIPTIONS).upsert(
    [
      {
        user_id: userId,
        ...mapped,
      },
    ],
    { onConflict: "user_id" },
  )
}

async function syncSubscriptionById(subscriptionId: string, explicitUserId?: string | null) {
  const stripe = getStripeServer()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const userId =
    explicitUserId ||
    subscription.metadata.user_id ||
    (await resolveUserIdByCustomer(String(subscription.customer)))

  if (!userId) return
  await upsertSubscriptionForUser(userId, subscription)
}

async function markEventAsProcessed(eventId: string, eventType: string) {
  const admin = getAdminClient()
  const { error } = await admin.from(DATABASE.TABLES.WS_BILLING_WEBHOOK_EVENTS).insert([
    {
      stripe_event_id: eventId,
      event_type: eventType,
      processed_at: new Date().toISOString(),
    },
  ])

  if (error && error.code === "23505") {
    return false
  }
  if (error) {
    throw new Error(error.message)
  }
  return true
}

export async function POST(request: Request) {
  try {
    const stripe = getStripeServer()
    const webhookSecret = getStripeWebhookSecret()
    const signature = request.headers.get("stripe-signature")
    if (!signature) {
      return NextResponse.json({ ok: false, error: "Missing stripe-signature" }, { status: 400 })
    }

    const payload = await request.text()
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    } catch (error: unknown) {
      return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 400 })
    }

    const shouldProcess = await markEventAsProcessed(event.id, event.type)
    if (!shouldProcess) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 })
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id ?? null
        const stripeCustomerId = session.customer ? String(session.customer) : null

        if (userId && stripeCustomerId) {
          await upsertCustomer({
            userId,
            stripeCustomerId,
            email: session.customer_details?.email ?? null,
          })
        }
        if (session.subscription) {
          await syncSubscriptionById(String(session.subscription), userId)
        }
        break
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const userId =
          subscription.metadata.user_id ||
          (await resolveUserIdByCustomer(String(subscription.customer)))
        if (userId) {
          await upsertSubscriptionForUser(userId, subscription)
        }
        break
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription ? String(invoice.subscription) : null
        const userId =
          invoice.parent?.subscription_details?.metadata?.user_id ||
          (invoice.customer ? await resolveUserIdByCustomer(String(invoice.customer)) : null)
        if (subscriptionId) {
          await syncSubscriptionById(subscriptionId, userId)
        }
        break
      }
      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription
        const userId =
          subscription.metadata.user_id ||
          (await resolveUserIdByCustomer(String(subscription.customer)))
        if (userId) {
          await upsertSubscriptionForUser(userId, subscription)
        }
        break
      }
      default:
        break
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 500 })
  }
}
