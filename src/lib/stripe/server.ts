import Stripe from "stripe"

let stripeClient: Stripe | null = null

export function getStripeServer() {
  if (stripeClient) return stripeClient

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY")
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: "2026-02-25.clover",
    appInfo: {
      name: "asygurare",
    },
  })

  return stripeClient
}

export function getStripePriceId() {
  const priceId = process.env.STRIPE_PRICE_PRO_MONTHLY_USD
  if (!priceId) {
    throw new Error("Missing STRIPE_PRICE_PRO_MONTHLY_USD")
  }
  return priceId
}

export function getStripeWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET")
  }
  return webhookSecret
}

export function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL")
  }
  return appUrl.replace(/\/$/, "")
}
