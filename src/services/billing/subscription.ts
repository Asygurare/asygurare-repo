import type Stripe from "stripe"

export type BillingSubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused"

export function fromUnixToIso(value: number | null | undefined) {
  if (!value) return null
  return new Date(value * 1000).toISOString()
}

export function canAccessPro(status: string | null | undefined) {
  return status === "active" || status === "trialing"
}

export function mapStripeSubscription(stripeSubscription: Stripe.Subscription) {
  const subscriptionItem = stripeSubscription.items.data[0]
  return {
    stripe_customer_id: String(stripeSubscription.customer),
    stripe_subscription_id: stripeSubscription.id,
    stripe_price_id: subscriptionItem?.price?.id ?? null,
    status: stripeSubscription.status,
    trial_ends_at: fromUnixToIso(stripeSubscription.trial_end),
    current_period_starts_at: fromUnixToIso(stripeSubscription.current_period_start),
    current_period_ends_at: fromUnixToIso(stripeSubscription.current_period_end),
    cancel_at_period_end: Boolean(stripeSubscription.cancel_at_period_end),
    canceled_at: fromUnixToIso(stripeSubscription.canceled_at),
    updated_at: new Date().toISOString(),
  }
}
