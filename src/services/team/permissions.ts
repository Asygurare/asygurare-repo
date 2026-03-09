import type { SupabaseClient } from "@supabase/supabase-js"
import { DATABASE } from "@/src/config"

export type PermissionLevel = "none" | "view" | "edit"

export type SectionPermissions = {
  dashboard: PermissionLevel
  metas: PermissionLevel
  prospectos: PermissionLevel
  clientes: PermissionLevel
  polizas: PermissionLevel
  calendario: PermissionLevel
  automatizar: PermissionLevel
  email: PermissionLevel
  ia: PermissionLevel
  analytics: PermissionLevel
}

export type TeamRole = "owner" | "member"

export type TeamContext = {
  role: TeamRole
  teamId: string | null
  permissions: SectionPermissions
}

export const DEFAULT_PERMISSIONS: SectionPermissions = {
  dashboard: "none",
  metas: "none",
  prospectos: "none",
  clientes: "none",
  polizas: "none",
  calendario: "none",
  automatizar: "none",
  email: "none",
  ia: "none",
  analytics: "none",
}

export const FULL_PERMISSIONS: SectionPermissions = {
  dashboard: "edit",
  metas: "edit",
  prospectos: "edit",
  clientes: "edit",
  polizas: "edit",
  calendario: "edit",
  automatizar: "edit",
  email: "edit",
  ia: "edit",
  analytics: "edit",
}

const SECTION_KEYS = Object.keys(DEFAULT_PERMISSIONS) as (keyof SectionPermissions)[]

export function parsePermissions(raw: unknown): SectionPermissions {
  const perms = { ...DEFAULT_PERMISSIONS }
  if (!raw || typeof raw !== "object") return perms
  const obj = raw as Record<string, unknown>
  for (const key of SECTION_KEYS) {
    const val = obj[key]
    if (val === "view" || val === "edit" || val === "none") {
      perms[key] = val
    }
  }
  return perms
}

export const SECTION_LABELS: Record<keyof SectionPermissions, string> = {
  dashboard: "Dashboard",
  metas: "Mis metas",
  prospectos: "Prospectos",
  clientes: "Clientes",
  polizas: "Pólizas",
  calendario: "Calendario",
  automatizar: "Automatizar",
  email: "Email",
  ia: "Guros IA",
  analytics: "Análisis",
}

export const HREF_TO_SECTION: Record<string, keyof SectionPermissions> = {
  "/dashboard": "dashboard",
  "/metas": "metas",
  "/prospectos": "prospectos",
  "/clientes": "clientes",
  "/polizas": "polizas",
  "/calendario": "calendario",
  "/automatizar": "automatizar",
  "/email": "email",
  "/ia": "ia",
  "/analytics": "analytics",
}

export async function getTeamContext(supabase: SupabaseClient, userId: string): Promise<TeamContext> {
  const { data: ownedTeam } = await supabase
    .from(DATABASE.TABLES.WS_TEAMS)
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle<{ id: string }>()

  if (ownedTeam) {
    return { role: "owner", teamId: ownedTeam.id, permissions: FULL_PERMISSIONS }
  }

  const { data: membership } = await supabase
    .from(DATABASE.TABLES.WS_TEAM_MEMBERS)
    .select("team_id, permissions")
    .eq("user_id", userId)
    .maybeSingle<{ team_id: string; permissions: unknown }>()

  if (membership) {
    return {
      role: "member",
      teamId: membership.team_id,
      permissions: parsePermissions(membership.permissions),
    }
  }

  return { role: "owner", teamId: null, permissions: FULL_PERMISSIONS }
}

export function canAccess(permissions: SectionPermissions, section: keyof SectionPermissions): boolean {
  return permissions[section] !== "none"
}

export function canEdit(permissions: SectionPermissions, section: keyof SectionPermissions): boolean {
  return permissions[section] === "edit"
}
