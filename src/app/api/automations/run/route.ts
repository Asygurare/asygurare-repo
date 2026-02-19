import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { DATABASE } from "@/src/config"
import { getGmailAccessTokenForUser } from "@/src/services/gmail/accessToken"
import { buildRawMessage } from "@/src/services/gmail/message"
import { type AutomationKey } from "@/src/services/automations/config"

export const runtime = "edge"

type AutomationRow = {
  user_id: string
  key: AutomationKey
  enabled: boolean
  config?: { days_before?: number; timezone?: string; template_id?: string } | null
}

type LeadRow = { id: string; name?: string | null; last_name?: string | null; email?: string | null; birthday?: string | null }
type CustomerRow = { id: string; name?: string | null; last_name?: string | null; email?: string | null; birthday?: string | null; full_name?: string | null }
type PolicyRow = { id: string; policy_number?: string | null; expiry_date?: string | null; customer_id?: string | null }
type TemplateRow = { id: string; subject?: string | null; text?: string | null; html?: string | null }

function isSchedulerAuthorized(request: Request, secret: string) {
  const incomingSecret = request.headers.get("x-scheduler-secret")
  if (incomingSecret && incomingSecret === secret) return true

  const authHeader = request.headers.get("authorization") || ""
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
  return bearer === secret
}

function normalizeEmail(raw: string | null | undefined) {
  const value = String(raw || "").trim()
  const angleMatch = value.match(/<([^>]+)>/)
  const email = angleMatch?.[1] ?? value
  return email.trim().toLowerCase()
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function applyRecipientPlaceholders(template: string, recipientName: string) {
  return template
    .replace(/\bclient_name\b/gi, recipientName)
    .replace(/\bnombre_cliente\b/gi, recipientName)
    .replace(/\bnombre_prospecto\b/gi, recipientName)
    .replace(/\[\s*nombre del cliente\s*\]/gi, recipientName)
    .replace(/\bnombre del cliente\b/gi, recipientName)
}

function getMonthDay(dateLike: string | null | undefined) {
  const raw = String(dateLike || "")
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return `${m[2]}-${m[3]}`
}

function getDateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const year = parts.find((p) => p.type === "year")?.value || "1970"
  const month = parts.find((p) => p.type === "month")?.value || "01"
  const day = parts.find((p) => p.type === "day")?.value || "01"
  return `${year}-${month}-${day}`
}

function daysUntilInTimeZone(targetDateLike: string | null | undefined, now: Date, timeZone: string) {
  const raw = String(targetDateLike || "")
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const today = getDateInTimeZone(now, timeZone)
  const todayDate = new Date(`${today}T00:00:00.000Z`)
  const target = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`)
  const diff = Math.round((target.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000))
  return diff
}

async function insertLogOnce(
  admin: ReturnType<typeof createClient>,
  row: {
    user_id: string
    automation_key: AutomationKey
    target_table: string
    target_id: string
    status: "ok" | "skipped" | "error"
    message: string
    run_date: string
    metadata?: Record<string, unknown>
  },
) {
  const { error } = await admin.from(DATABASE.TABLES.WS_AUTOMATION_LOGS).upsert(
    [
      {
        user_id: row.user_id,
        automation_key: row.automation_key,
        target_table: row.target_table,
        target_id: row.target_id,
        status: row.status,
        message: row.message,
        run_date: row.run_date,
        metadata: row.metadata || {},
      },
    ],
    { onConflict: "user_id,automation_key,target_table,target_id,run_date", ignoreDuplicates: true },
  )
  return !error
}

async function sendEmailNow(
  accessToken: string,
  from: string | null,
  to: string,
  subject: string,
  text?: string,
  html?: string,
) {
  const raw = buildRawMessage({ from, to, subject, text, html })
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(detail.slice(0, 400) || "gmail_send_failed")
  }
}

async function run(request: Request) {
  const secret = process.env.GMAIL_SCHEDULER_SECRET || process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: "Missing CRON secret" }, { status: 500 })
  if (!isSchedulerAuthorized(request, secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized scheduler" }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: automations, error: autoErr } = await admin
    .from(DATABASE.TABLES.WS_AUTOMATIONS)
    .select("user_id,key,enabled,config")
    .eq("enabled", true)

  if (autoErr) return NextResponse.json({ ok: false, error: autoErr.message }, { status: 500 })
  if (!automations || automations.length === 0) return NextResponse.json({ ok: true, processed: 0, users: 0 })

  const byUser = new Map<string, AutomationRow[]>()
  ;(automations as AutomationRow[]).forEach((row) => {
    const arr = byUser.get(row.user_id) || []
    arr.push(row)
    byUser.set(row.user_id, arr)
  })

  const now = new Date()
  let processed = 0

  for (const [userId, rules] of byUser.entries()) {
    const timeZone = String(rules.find((r) => r.config?.timezone)?.config?.timezone || "America/Mexico_City")
    const today = getDateInTimeZone(now, timeZone)
    const todayMonthDay = today.slice(5)
    const runDate = today

    const needsLeads = rules.some((r) => r.key.includes("prospects"))
    const needsCustomers = rules.some((r) => r.key.includes("customers") || r.key.includes("policy"))
    const needsPolicies = rules.some((r) => r.key.includes("policy"))

    const [leadsRes, customersRes, policiesRes] = await Promise.all([
      needsLeads
        ? admin.from(DATABASE.TABLES.WS_LEADS).select("id,name,last_name,email,birthday").eq("user_id", userId).limit(5000)
        : Promise.resolve({ data: [] as LeadRow[], error: null } as any),
      needsCustomers
        ? admin
            .from(DATABASE.TABLES.WS_CUSTOMERS_2)
            .select("id,name,last_name,full_name,email,birthday")
            .eq("user_id", userId)
            .limit(5000)
        : Promise.resolve({ data: [] as CustomerRow[], error: null } as any),
      needsPolicies
        ? admin.from(DATABASE.TABLES.WS_POLICIES).select("id,policy_number,expiry_date,customer_id").eq("user_id", userId).limit(5000)
        : Promise.resolve({ data: [] as PolicyRow[], error: null } as any),
    ])

    const leads = (leadsRes.data || []) as LeadRow[]
    const customers = (customersRes.data || []) as CustomerRow[]
    const policies = (policiesRes.data || []) as PolicyRow[]
    const customerById = new Map<string, CustomerRow>(customers.map((c) => [String(c.id), c]))
    const templateIds = Array.from(
      new Set(
        rules
          .map((r) => String(r.config?.template_id || '').trim())
          .filter((x) => !!x),
      ),
    )
    const templateById = new Map<string, TemplateRow>()
    if (templateIds.length > 0) {
      const { data: templatesData } = await admin
        .from(DATABASE.TABLES.WS_EMAIL_TEMPLATES)
        .select('id,subject,text,html')
        .eq('user_id', userId)
        .in('id', templateIds)
      ;((templatesData || []) as TemplateRow[]).forEach((tpl) => templateById.set(String(tpl.id), tpl))
    }

    let token: { accessToken: string; providerEmail: string | null } | null = null
    const emailRulesEnabled = rules.some((r) => r.key.endsWith("_email"))
    if (emailRulesEnabled) {
      try {
        token = await getGmailAccessTokenForUser(admin as any, userId)
      } catch {
        token = null
      }
    }

    for (const rule of rules) {
      if (!rule.enabled) continue

      if (rule.key === "birthday_prospects_email" || rule.key === "birthday_prospects_notify") {
        for (const lead of leads) {
          if (getMonthDay(lead.birthday) !== todayMonthDay) continue
          const displayName = `${lead.name || ""} ${lead.last_name || ""}`.trim() || "Prospecto"
          const targetId = String(lead.id)

          if (rule.key.endsWith("_notify")) {
            const inserted = await insertLogOnce(admin, {
              user_id: userId,
              automation_key: rule.key,
              target_table: DATABASE.TABLES.WS_LEADS,
              target_id: targetId,
              status: "ok",
              message: `Cumpleaños de prospecto: ${displayName}`,
              run_date: runDate,
            })
            if (inserted) processed += 1
            continue
          }

          const to = normalizeEmail(lead.email)
          if (!token || !isValidEmail(to)) {
            const inserted = await insertLogOnce(admin, {
              user_id: userId,
              automation_key: rule.key,
              target_table: DATABASE.TABLES.WS_LEADS,
              target_id: targetId,
              status: "skipped",
              message: !token ? "Gmail no conectado" : "Prospecto sin email válido",
              run_date: runDate,
            })
            if (inserted) processed += 1
            continue
          }

          try {
            const template = rule.config?.template_id ? templateById.get(String(rule.config.template_id)) : null
            const subject = template?.subject
              ? applyRecipientPlaceholders(String(template.subject), displayName)
              : `Feliz cumpleaños, ${displayName}`
            const bodyText = template?.text
              ? applyRecipientPlaceholders(String(template.text), displayName)
              : `Hola ${displayName},\n\n¡Te deseamos un feliz cumpleaños!\n\nSaludos,\nAsygurare`
            const bodyHtml = template?.html
              ? applyRecipientPlaceholders(String(template.html), displayName)
              : undefined
            await sendEmailNow(
              token.accessToken,
              token.providerEmail ?? null,
              to,
              subject,
              bodyText,
              bodyHtml,
            )
            const inserted = await insertLogOnce(admin, {
              user_id: userId,
              automation_key: rule.key,
              target_table: DATABASE.TABLES.WS_LEADS,
              target_id: targetId,
              status: "ok",
              message: `Email de cumpleaños enviado a ${displayName}`,
              run_date: runDate,
              metadata: { to },
            })
            if (inserted) processed += 1
          } catch (e) {
            const inserted = await insertLogOnce(admin, {
              user_id: userId,
              automation_key: rule.key,
              target_table: DATABASE.TABLES.WS_LEADS,
              target_id: targetId,
              status: "error",
              message: e instanceof Error ? e.message : "Error al enviar",
              run_date: runDate,
              metadata: { to },
            })
            if (inserted) processed += 1
          }
        }
      }

      if (rule.key === "birthday_customers_email" || rule.key === "birthday_customers_notify") {
        for (const customer of customers) {
          if (getMonthDay(customer.birthday) !== todayMonthDay) continue
          const displayName =
            String(customer.full_name || "").trim() ||
            `${customer.name || ""} ${customer.last_name || ""}`.trim() ||
            "Cliente"
          const targetId = String(customer.id)

          if (rule.key.endsWith("_notify")) {
            const inserted = await insertLogOnce(admin, {
              user_id: userId,
              automation_key: rule.key,
              target_table: DATABASE.TABLES.WS_CUSTOMERS_2,
              target_id: targetId,
              status: "ok",
              message: `Cumpleaños de cliente: ${displayName}`,
              run_date: runDate,
            })
            if (inserted) processed += 1
            continue
          }

          const to = normalizeEmail(customer.email)
          if (!token || !isValidEmail(to)) {
            const inserted = await insertLogOnce(admin, {
              user_id: userId,
              automation_key: rule.key,
              target_table: DATABASE.TABLES.WS_CUSTOMERS_2,
              target_id: targetId,
              status: "skipped",
              message: !token ? "Gmail no conectado" : "Cliente sin email válido",
              run_date: runDate,
            })
            if (inserted) processed += 1
            continue
          }

          try {
            const template = rule.config?.template_id ? templateById.get(String(rule.config.template_id)) : null
            const subject = template?.subject
              ? applyRecipientPlaceholders(String(template.subject), displayName)
              : `Feliz cumpleaños, ${displayName}`
            const bodyText = template?.text
              ? applyRecipientPlaceholders(String(template.text), displayName)
              : `Hola ${displayName},\n\n¡Te deseamos un feliz cumpleaños!\n\nSaludos,\nAsygurare`
            const bodyHtml = template?.html
              ? applyRecipientPlaceholders(String(template.html), displayName)
              : undefined
            await sendEmailNow(
              token.accessToken,
              token.providerEmail ?? null,
              to,
              subject,
              bodyText,
              bodyHtml,
            )
            const inserted = await insertLogOnce(admin, {
              user_id: userId,
              automation_key: rule.key,
              target_table: DATABASE.TABLES.WS_CUSTOMERS_2,
              target_id: targetId,
              status: "ok",
              message: `Email de cumpleaños enviado a ${displayName}`,
              run_date: runDate,
              metadata: { to },
            })
            if (inserted) processed += 1
          } catch (e) {
            const inserted = await insertLogOnce(admin, {
              user_id: userId,
              automation_key: rule.key,
              target_table: DATABASE.TABLES.WS_CUSTOMERS_2,
              target_id: targetId,
              status: "error",
              message: e instanceof Error ? e.message : "Error al enviar",
              run_date: runDate,
              metadata: { to },
            })
            if (inserted) processed += 1
          }
        }
      }

      if (rule.key === "policy_renewal_notice_email" || rule.key === "policy_renewal_notice_notify") {
        const daysBefore = Math.max(1, Number(rule.config?.days_before || 30))
        for (const policy of policies) {
          const daysToExpiry = daysUntilInTimeZone(policy.expiry_date, now, timeZone)
          if (daysToExpiry === null || daysToExpiry !== daysBefore) continue
          const customer = customerById.get(String(policy.customer_id || ""))
          const displayName =
            String(customer?.full_name || "").trim() ||
            `${customer?.name || ""} ${customer?.last_name || ""}`.trim() ||
            "Cliente"
          const policyNumber = String(policy.policy_number || "N/A")
          const targetId = String(policy.id)

          if (rule.key.endsWith("_notify")) {
            const inserted = await insertLogOnce(admin, {
              user_id: userId,
              automation_key: rule.key,
              target_table: DATABASE.TABLES.WS_POLICIES,
              target_id: targetId,
              status: "ok",
              message: `Póliza ${policyNumber} de ${displayName} vence en ${daysBefore} días`,
              run_date: runDate,
              metadata: { days_before: daysBefore },
            })
            if (inserted) processed += 1
            continue
          }

          const to = normalizeEmail(customer?.email)
          if (!token || !isValidEmail(to)) {
            const inserted = await insertLogOnce(admin, {
              user_id: userId,
              automation_key: rule.key,
              target_table: DATABASE.TABLES.WS_POLICIES,
              target_id: targetId,
              status: "skipped",
              message: !token ? "Gmail no conectado" : "Cliente sin email válido para aviso de renovación",
              run_date: runDate,
            })
            if (inserted) processed += 1
            continue
          }

          try {
            const template = rule.config?.template_id ? templateById.get(String(rule.config.template_id)) : null
            const subject = template?.subject
              ? applyRecipientPlaceholders(String(template.subject), displayName)
              : `Tu póliza ${policyNumber} está por vencer`
            const bodyText = template?.text
              ? applyRecipientPlaceholders(String(template.text), displayName)
              : `Hola ${displayName},\n\nTe recordamos que tu póliza ${policyNumber} vence en ${daysBefore} días.\n\nSi quieres renovarla, responde este correo y te ayudamos.\n\nSaludos,\nAsygurare`
            const bodyHtml = template?.html
              ? applyRecipientPlaceholders(String(template.html), displayName)
              : undefined
            await sendEmailNow(
              token.accessToken,
              token.providerEmail ?? null,
              to,
              subject,
              bodyText,
              bodyHtml,
            )
            const inserted = await insertLogOnce(admin, {
              user_id: userId,
              automation_key: rule.key,
              target_table: DATABASE.TABLES.WS_POLICIES,
              target_id: targetId,
              status: "ok",
              message: `Aviso de renovación enviado para póliza ${policyNumber}`,
              run_date: runDate,
              metadata: { to, days_before: daysBefore },
            })
            if (inserted) processed += 1
          } catch (e) {
            const inserted = await insertLogOnce(admin, {
              user_id: userId,
              automation_key: rule.key,
              target_table: DATABASE.TABLES.WS_POLICIES,
              target_id: targetId,
              status: "error",
              message: e instanceof Error ? e.message : "Error al enviar aviso de renovación",
              run_date: runDate,
              metadata: { to, days_before: daysBefore },
            })
            if (inserted) processed += 1
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, users: byUser.size, processed }, { status: 200 })
}

export async function POST(request: Request) {
  return run(request)
}

export async function GET(request: Request) {
  return run(request)
}
