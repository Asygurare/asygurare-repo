export const AUTOMATION_KEYS = [
  'birthday_prospects_email',
  'birthday_customers_email',
  'policy_renewal_notice_email',
  'birthday_prospects_notify',
  'birthday_customers_notify',
  'policy_renewal_notice_notify',
] as const

export type AutomationKey = (typeof AUTOMATION_KEYS)[number]

export type AutomationRecord = {
  key: AutomationKey
  enabled: boolean
  config: {
    days_before?: number
    timezone?: string
    template_id?: string
  }
}

export const DEFAULT_AUTOMATIONS: AutomationRecord[] = [
  { key: 'birthday_prospects_email', enabled: false, config: { timezone: 'America/Mexico_City' } },
  { key: 'birthday_customers_email', enabled: false, config: { timezone: 'America/Mexico_City' } },
  { key: 'policy_renewal_notice_email', enabled: false, config: { days_before: 30, timezone: 'America/Mexico_City' } },
  { key: 'birthday_prospects_notify', enabled: true, config: { timezone: 'America/Mexico_City' } },
  { key: 'birthday_customers_notify', enabled: true, config: { timezone: 'America/Mexico_City' } },
  { key: 'policy_renewal_notice_notify', enabled: true, config: { days_before: 30, timezone: 'America/Mexico_City' } },
]

export function isAutomationKey(value: string): value is AutomationKey {
  return (AUTOMATION_KEYS as readonly string[]).includes(value)
}
