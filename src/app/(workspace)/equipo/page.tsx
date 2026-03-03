"use client"

import React, { useCallback, useEffect, useState } from "react"
import { toast, Toaster } from "sonner"
import { UserPlus, Trash2, X, Loader2, Mail, Shield, ChevronDown, BarChart3, Users, Target } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import {
  type SectionPermissions,
  type PermissionLevel,
  DEFAULT_PERMISSIONS,
  SECTION_LABELS,
} from "@/src/services/team/permissions"
import { SectionTutorial, type SectionTutorialStep } from "@/src/components/workspace/tutorial/SectionTutorial"

type TeamMember = {
  id: string
  user_id: string
  role: string
  permissions: SectionPermissions
  joined_at: string
  first_name: string | null
  last_name: string | null
}

type TeamInvitation = {
  id: string
  email: string
  permissions: SectionPermissions
  status: string
  expires_at: string
  created_at: string
}

type TeamData = {
  role: "owner" | "member"
  team: { id: string; name: string; created_at?: string } | null
  members: TeamMember[]
  invitations: TeamInvitation[]
  permissions: SectionPermissions
}

const PERM_OPTIONS: { value: PermissionLevel; label: string; color: string }[] = [
  { value: "none", label: "Sin acceso", color: "bg-gray-100 text-gray-500 border-gray-200" },
  { value: "view", label: "Solo ver", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "edit", label: "Ver y editar", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
]

const EQUIPO_TUTORIAL_STEPS: SectionTutorialStep[] = [
  {
    id: "equipo-header",
    title: "Gestion de equipo",
    description: "Aqui administras miembros, invitaciones y accesos por seccion.",
    selector: '[data-tutorial="equipo-header"]',
  },
  {
    id: "equipo-members",
    title: "Miembros activos",
    description: "Consulta integrantes, permisos y datos operativos de cada miembro.",
    selector: '[data-tutorial="equipo-members"]',
  },
  {
    id: "equipo-invitations",
    title: "Invitaciones pendientes",
    description: "Revisa invitaciones enviadas y cancelalas si es necesario.",
    selector: '[data-tutorial="equipo-invitations"]',
  },
  {
    id: "equipo-invite-modal",
    title: "Invitar miembro",
    description: "Define correo y permisos por seccion antes de enviar la invitacion.",
    selector: '[data-tutorial="equipo-invite-modal"]',
  },
]

function PermissionBadge({ level }: { level: PermissionLevel }) {
  const opt = PERM_OPTIONS.find((o) => o.value === level) || PERM_OPTIONS[0]
  return (
    <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${opt.color}`}>
      {opt.label}
    </span>
  )
}

function PermissionSelector({
  permissions,
  onChange,
}: {
  permissions: SectionPermissions
  onChange: (perms: SectionPermissions) => void
}) {
  const sections = Object.keys(SECTION_LABELS) as (keyof SectionPermissions)[]

  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <div key={section} className="flex items-center justify-between gap-4">
          <span className="text-sm font-bold text-black/70 min-w-[120px]">{SECTION_LABELS[section]}</span>
          <div className="flex gap-1.5">
            {PERM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...permissions, [section]: opt.value })}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                  permissions[section] === opt.value
                    ? opt.color + " ring-2 ring-black/10"
                    : "bg-white text-black/30 border-black/5 hover:border-black/20"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="flex gap-2 pt-2 border-t border-black/5">
        <button
          type="button"
          onClick={() => {
            const all: SectionPermissions = {} as SectionPermissions
            for (const s of sections) all[s] = "edit"
            onChange(all)
          }}
          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all"
        >
          Todo acceso
        </button>
        <button
          type="button"
          onClick={() => {
            const all: SectionPermissions = {} as SectionPermissions
            for (const s of sections) all[s] = "view"
            onChange(all)
          }}
          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all"
        >
          Solo ver todo
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_PERMISSIONS })}
          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 transition-all"
        >
          Sin acceso
        </button>
      </div>
    </div>
  )
}

export default function EquipoPage() {
  const [loading, setLoading] = useState(true)
  const [teamData, setTeamData] = useState<TeamData | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [invitePermissions, setInvitePermissions] = useState<SectionPermissions>({ ...DEFAULT_PERMISSIONS })
  const [inviting, setInviting] = useState(false)
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [editPermissions, setEditPermissions] = useState<SectionPermissions>({ ...DEFAULT_PERMISSIONS })
  const [savingPerms, setSavingPerms] = useState(false)
  const [viewingDataFor, setViewingDataFor] = useState<string | null>(null)
  const [memberData, setMemberData] = useState<Record<string, { profile: any; stats: any }>>({})
  const [loadingData, setLoadingData] = useState<string | null>(null)

  const fetchTeam = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/team/status", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Error cargando equipo")
      setTeamData(json as TeamData)
    } catch (e: any) {
      toast.error(e?.message || "Error cargando equipo")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast.error("Ingresa un email válido")
      return
    }
    setInviting(true)
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), permissions: invitePermissions }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "No se pudo invitar")
      toast.success(json?.note || `Invitación enviada a ${inviteEmail}`)
      setShowInviteModal(false)
      setInviteEmail("")
      setInvitePermissions({ ...DEFAULT_PERMISSIONS })
      await fetchTeam()
    } catch (e: any) {
      toast.error(e?.message || "Error al invitar")
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string, name: string) => {
    if (!confirm(`¿Eliminar a ${name} del equipo?`)) return
    try {
      const res = await fetch("/api/team/members/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "No se pudo eliminar")
      toast.success(`${name} eliminado del equipo`)
      await fetchTeam()
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar")
    }
  }

  const handleCancelInvite = async (invitationId: string) => {
    try {
      const res = await fetch("/api/team/invite/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_id: invitationId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "No se pudo cancelar")
      toast.success("Invitación cancelada")
      await fetchTeam()
    } catch (e: any) {
      toast.error(e?.message || "Error al cancelar")
    }
  }

  const handleSavePermissions = async (memberId: string) => {
    setSavingPerms(true)
    try {
      const res = await fetch("/api/team/members/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, permissions: editPermissions }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "No se pudo actualizar")
      toast.success("Permisos actualizados")
      setEditingMember(null)
      await fetchTeam()
    } catch (e: any) {
      toast.error(e?.message || "Error al actualizar permisos")
    } finally {
      setSavingPerms(false)
    }
  }

  const handleViewData = async (userId: string) => {
    if (viewingDataFor === userId) {
      setViewingDataFor(null)
      return
    }
    setViewingDataFor(userId)
    if (memberData[userId]) return
    setLoadingData(userId)
    try {
      const res = await fetch(`/api/team/members/data?user_id=${userId}`, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Error cargando datos")
      setMemberData((prev) => ({ ...prev, [userId]: { profile: json.profile, stats: json.stats } }))
    } catch (e: any) {
      toast.error(e?.message || "Error cargando datos del miembro")
      setViewingDataFor(null)
    } finally {
      setLoadingData(null)
    }
  }

  const isOwner = teamData?.role === "owner"

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-40">
        <Loader2 className="animate-spin text-black/30" size={40} />
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-40 text-center px-6">
        <Shield size={48} className="text-black/10 mb-4" />
        <h2 className="text-xl font-black text-black mb-2">Eres miembro de un equipo</h2>
        <p className="text-sm text-black/50 max-w-md">
          Tu cuenta está vinculada al equipo <strong>{teamData?.team?.name || "—"}</strong>.
          Contacta al administrador para cambios en tus permisos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-4 sm:p-8 max-w-5xl mx-auto">
      <Toaster position="top-right" richColors />

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" data-tutorial="equipo-header">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Equipo</p>
          <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
            {teamData?.team?.name || "Mi equipo"}
          </h1>
          <p className="text-sm text-black/50 mt-1">
            {teamData?.members.length || 0} miembro{(teamData?.members.length || 0) !== 1 ? "s" : ""}
            {" · "}
            {teamData?.invitations.length || 0} invitación{(teamData?.invitations.length || 0) !== 1 ? "es" : ""} pendiente{(teamData?.invitations.length || 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <SectionTutorial
            steps={EQUIPO_TUTORIAL_STEPS}
            ariaLabel="Tutorial de la seccion equipo"
            triggerClassName="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:bg-black hover:text-white"
          />
          <button
            onClick={() => setShowInviteModal(true)}
            className="bg-black text-white px-6 py-4 rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-(--accents) transition-all shadow-lg active:scale-95 shrink-0"
          >
            <UserPlus size={18} />
            Invitar miembro
          </button>
        </div>
      </div>

      {/* MIEMBROS ACTIVOS */}
      <section className="bg-white rounded-[2rem] border border-black/5 shadow-sm overflow-hidden" data-tutorial="equipo-members">
        <div className="p-6 border-b border-black/5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Miembros activos</p>
        </div>

        {(teamData?.members || []).length === 0 ? (
          <div className="p-10 text-center">
            <UserPlus size={40} className="text-black/10 mx-auto mb-3" />
            <p className="text-sm text-black/40 font-bold">Aún no hay miembros en tu equipo</p>
            <p className="text-xs text-black/30 mt-1">Invita a alguien para comenzar</p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {(teamData?.members || []).map((member) => {
              const fullName = [member.first_name, member.last_name].filter(Boolean).join(" ") || "Sin nombre"
              const isEditing = editingMember === member.id

              return (
                <div key={member.id} className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-black text-black truncate">{fullName}</p>
                      <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest mt-0.5">
                        Miembro desde {new Date(member.joined_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          if (isEditing) {
                            setEditingMember(null)
                          } else {
                            setEditingMember(member.id)
                            setEditPermissions({ ...member.permissions })
                          }
                        }}
                        className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gray-50 text-black/60 border border-black/5 hover:bg-black hover:text-white transition-all flex items-center gap-2"
                      >
                        <Shield size={12} />
                        Permisos
                        <ChevronDown size={12} className={`transition-transform ${isEditing ? "rotate-180" : ""}`} />
                      </button>
                      <button
                        onClick={() => handleViewData(member.user_id)}
                        className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${
                          viewingDataFor === member.user_id
                            ? "bg-black text-white border-black"
                            : "bg-gray-50 text-black/60 border-black/5 hover:bg-black hover:text-white"
                        }`}
                      >
                        <BarChart3 size={12} />
                        Datos
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.id, fullName)}
                        className="p-2.5 rounded-xl bg-red-50 text-red-500 border border-red-100 hover:bg-red-600 hover:text-white transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Permissions summary */}
                  {!isEditing && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {(Object.keys(SECTION_LABELS) as (keyof SectionPermissions)[]).map((section) => (
                        member.permissions[section] !== "none" ? (
                          <span key={section} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-gray-50 text-black/50 border border-black/5">
                            {SECTION_LABELS[section]}
                            <span className={member.permissions[section] === "edit" ? "text-emerald-600" : "text-amber-600"}>
                              {member.permissions[section] === "edit" ? "✓" : "👁"}
                            </span>
                          </span>
                        ) : null
                      ))}
                    </div>
                  )}

                  {/* Edit permissions panel */}
                  <AnimatePresence>
                    {isEditing && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 p-5 rounded-2xl bg-gray-50/80 border border-black/5 space-y-4">
                          <PermissionSelector permissions={editPermissions} onChange={setEditPermissions} />
                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              onClick={() => setEditingMember(null)}
                              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-black/40 hover:text-black transition-all"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleSavePermissions(member.id)}
                              disabled={savingPerms}
                              className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-black text-white hover:bg-(--accents) transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                              {savingPerms && <Loader2 className="animate-spin" size={12} />}
                              Guardar
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Member data panel */}
                  <AnimatePresence>
                    {viewingDataFor === member.user_id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 p-5 rounded-2xl bg-gray-50/80 border border-black/5">
                          {loadingData === member.user_id ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="animate-spin text-black/30" size={24} />
                            </div>
                          ) : memberData[member.user_id] ? (
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                              {[
                                { label: "Clientes", value: memberData[member.user_id].stats.customers, icon: Users },
                                { label: "Prospectos", value: memberData[member.user_id].stats.leads, icon: Target },
                                { label: "Pólizas", value: memberData[member.user_id].stats.policies, icon: Shield },
                                { label: "Tareas abiertas", value: memberData[member.user_id].stats.tasks_open, icon: BarChart3 },
                                { label: "Tareas completadas", value: memberData[member.user_id].stats.tasks_done, icon: BarChart3 },
                              ].map((stat) => (
                                <div key={stat.label} className="bg-white rounded-xl p-4 border border-black/5 text-center">
                                  <stat.icon size={16} className="mx-auto text-black/20 mb-1" />
                                  <p className="text-2xl font-black text-black">{stat.value}</p>
                                  <p className="text-[9px] font-black text-black/40 uppercase tracking-widest mt-0.5">{stat.label}</p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* INVITACIONES PENDIENTES */}
      {(teamData?.invitations || []).length > 0 && (
        <section className="bg-white rounded-[2rem] border border-black/5 shadow-sm overflow-hidden" data-tutorial="equipo-invitations">
          <div className="p-6 border-b border-black/5">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Invitaciones pendientes</p>
          </div>
          <div className="divide-y divide-black/5">
            {(teamData?.invitations || []).map((inv) => (
              <div key={inv.id} className="p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-black/30 shrink-0" />
                    <p className="font-black text-black truncate">{inv.email}</p>
                  </div>
                  <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest mt-0.5">
                    Enviada {new Date(inv.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                    {" · Expira "}
                    {new Date(inv.expires_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(Object.keys(SECTION_LABELS) as (keyof SectionPermissions)[]).map((section) => (
                      inv.permissions[section] !== "none" ? (
                        <PermissionBadge key={section} level={inv.permissions[section]} />
                      ) : null
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleCancelInvite(inv.id)}
                  className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-500 border border-red-100 hover:bg-red-600 hover:text-white transition-all shrink-0"
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MODAL INVITAR */}
      <AnimatePresence>
        {showInviteModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !inviting && setShowInviteModal(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-[10%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg bg-(--bg) rounded-[2rem] shadow-2xl z-50 overflow-hidden max-h-[80vh] flex flex-col"
              data-tutorial="equipo-invite-modal"
            >
              <div className="p-6 border-b border-black/5 flex items-center justify-between shrink-0">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nuevo miembro</p>
                  <h2 className="text-lg font-black text-black">Invitar al equipo</h2>
                </div>
                <button
                  onClick={() => !inviting && setShowInviteModal(false)}
                  className="p-2 rounded-xl hover:bg-black/5 transition-all"
                >
                  <X size={20} className="text-black/40" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                <div>
                  <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block mb-2">
                    Email del miembro
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="empleado@ejemplo.com"
                    className="w-full bg-white text-black font-bold py-3.5 px-5 rounded-xl outline-none border-2 border-black/5 focus:border-black/20 transition-all placeholder:text-gray-300"
                    disabled={inviting}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block mb-3">
                    Permisos por sección
                  </label>
                  <PermissionSelector permissions={invitePermissions} onChange={setInvitePermissions} />
                </div>
              </div>

              <div className="p-6 border-t border-black/5 shrink-0">
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="w-full bg-black text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-(--accents) transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {inviting ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
                  {inviting ? "Enviando invitación..." : "Enviar invitación"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
