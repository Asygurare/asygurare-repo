import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"
import { canAccessPro } from "@/src/services/billing/subscription"

export const runtime = "nodejs"

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error interno"
}

type BillingSubscriptionRow = {
  status: string
  trial_ends_at: string | null
  current_period_ends_at: string | null
  cancel_at_period_end: boolean
  updated_at?: string | null
}

export async function GET() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
    }

    const trialCheckoutRequired = Boolean((user.user_metadata || {})?.trial_checkout_required)

    const { data: subscription } = await supabase
      .from(DATABASE.TABLES.WS_BILLING_SUBSCRIPTIONS)
      .select("status, trial_ends_at, current_period_ends_at, cancel_at_period_end, updated_at")
      .eq("user_id", user.id)
      .maybeSingle<BillingSubscriptionRow>()

    if (!subscription) {
      return NextResponse.json(
        {
          ok: true,
          billing: {
            status: "free",
            has_pro_access: false,
            trial_ends_at: null,
            current_period_ends_at: null,
            cancel_at_period_end: false,
            trial_checkout_required: trialCheckoutRequired,
            updated_at: null,
          },
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      )
    }

    return NextResponse.json(
      {
        ok: true,
        billing: {
          status: subscription.status,
          has_pro_access: canAccessPro(subscription.status),
          trial_ends_at: subscription.trial_ends_at,
          current_period_ends_at: subscription.current_period_ends_at,
          cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
          trial_checkout_required: trialCheckoutRequired,
          updated_at: subscription.updated_at ?? null,
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    )
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 500 })
  }
}
