import { Pencil, Plus, Trash2 } from "lucide-react"

type TemplateCategory = "temporal" | "asesor" | "seguimiento" | "propuesta" | "otro"
type TemplateTag = "prospectos" | "clientes" | "polizas" | "cumpleanos" | "eventos" | "personalizar"

type TemplateOption = {
  id: string
  name: string
  category: TemplateCategory
  tag_label?: TemplateTag | null
  tag_color?: string | null
  tag_custom_label?: string | null
  is_system: boolean
}

type TemplatesPanelProps = {
  showPrimaryActions?: boolean
  showOnlyPrimaryActions?: boolean
  connected: boolean
  templatesLoading: boolean
  templatesSaving: boolean
  templatesAIWorking: boolean
  templatesResult: string
  templates: TemplateOption[]
  selectedTemplateId: string
  selectedTemplateIsSystem: boolean
  hasSelectedTemplate: boolean
  templateName: string
  templateCategory: TemplateCategory
  templateTagLabel: TemplateTag
  templateTagColor: string
  templateTagCustomLabel: string
  templatePrompt: string
  onChangeSelectedTemplate: (value: string) => void
  onApplyTemplate: () => void
  onStartNewTemplate: () => void
  onDeleteTemplate: () => void
  onChangeTemplateName: (value: string) => void
  onChangeTemplateCategory: (value: TemplateCategory) => void
  onChangeTemplateTagLabel: (value: TemplateTag) => void
  onChangeTemplateTagColor: (value: string) => void
  onChangeTemplateTagCustomLabel: (value: string) => void
  onSaveCurrentAsTemplate: () => void
  onChangeTemplatePrompt: (value: string) => void
  onCreateTemplateWithAI: () => void
  onImproveTemplateWithAI: () => void
}

export default function TemplatesPanel({
  showPrimaryActions = false,
  showOnlyPrimaryActions = false,
  connected,
  templatesLoading,
  templatesSaving,
  templatesAIWorking,
  templatesResult,
  templates,
  selectedTemplateId,
  selectedTemplateIsSystem,
  hasSelectedTemplate,
  templateName,
  templateCategory,
  templateTagLabel,
  templateTagColor,
  templateTagCustomLabel,
  templatePrompt,
  onChangeSelectedTemplate,
  onApplyTemplate,
  onStartNewTemplate,
  onDeleteTemplate,
  onChangeTemplateName,
  onChangeTemplateCategory,
  onChangeTemplateTagLabel,
  onChangeTemplateTagColor,
  onChangeTemplateTagCustomLabel,
  onSaveCurrentAsTemplate,
  onChangeTemplatePrompt,
  onCreateTemplateWithAI,
  onImproveTemplateWithAI,
}: TemplatesPanelProps) {
  return (
    <div className="rounded-2xl border border-black/10 bg-gray-50/70 p-4 space-y-3">
      {showPrimaryActions ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onStartNewTemplate}
            disabled={!connected}
            className={showOnlyPrimaryActions
              ? "md:col-span-3 w-full inline-flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-black text-white font-black text-[11px] uppercase tracking-widest hover:bg-black/85 disabled:opacity-60"
              : "w-full inline-flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-black text-white font-black text-[11px] uppercase tracking-widest hover:bg-black/85 disabled:opacity-60"}
          >
            <Plus size={16} />
            Nueva Plantilla
          </button>
          {!showOnlyPrimaryActions ? (
            <>
              <button
                type="button"
                onClick={onApplyTemplate}
                disabled={!connected || !hasSelectedTemplate}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-white border border-black/10 text-black font-black text-[11px] uppercase tracking-widest hover:bg-gray-50 disabled:opacity-60"
              >
                <Pencil size={16} />
                Editar Plantilla
              </button>
              <button
                type="button"
                onClick={onDeleteTemplate}
                disabled={!connected || !hasSelectedTemplate || selectedTemplateIsSystem || templatesSaving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-white border border-black/10 text-black font-black text-[11px] uppercase tracking-widest hover:bg-gray-50 disabled:opacity-60"
              >
                <Trash2 size={16} />
                Borrar Plantilla
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {!showOnlyPrimaryActions ? (
        <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[10px] font-black uppercase tracking-widest text-black">Templates de correo</p>
        {templatesLoading ? <span className="text-[11px] font-bold text-black/50">Cargando templates...</span> : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
        <select
          value={selectedTemplateId}
          onChange={(e) => onChangeSelectedTemplate(e.target.value)}
          disabled={!connected}
          className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
        >
          <option value="">Seleccionar template...</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.is_system ? "Default" : "Personal"} · {template.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onApplyTemplate}
          disabled={!connected}
          className="px-4 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/85 disabled:opacity-60"
        >
          Usar template
        </button>
        <button
          type="button"
          onClick={onDeleteTemplate}
          disabled={!connected || !hasSelectedTemplate || selectedTemplateIsSystem || templatesSaving}
          className="px-4 py-3 rounded-2xl bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 disabled:opacity-60"
        >
          Borrar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-2">
        <input
          value={templateName}
          onChange={(e) => onChangeTemplateName(e.target.value)}
          disabled={!connected}
          placeholder="Nombre de template (ej. Primer contacto)"
          className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
        />
        <select
          value={templateCategory}
          onChange={(e) => onChangeTemplateCategory(e.target.value as TemplateCategory)}
          disabled={!connected}
          className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
        >
          <option value="asesor">Asesor</option>
          <option value="seguimiento">Seguimiento</option>
          <option value="propuesta">Propuesta</option>
          <option value="temporal">Temporal</option>
          <option value="otro">Otro</option>
        </select>
        <button
          type="button"
          onClick={onSaveCurrentAsTemplate}
          disabled={!connected || templatesSaving}
          className="px-4 py-3 rounded-2xl bg-(--accents) text-white font-black text-[10px] uppercase tracking-widest hover:opacity-90 disabled:opacity-60"
        >
          {templatesSaving ? "Guardando..." : "Guardar template"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-black/45 mb-1">Etiqueta</p>
          <select
            value={templateTagLabel}
            onChange={(e) => onChangeTemplateTagLabel(e.target.value as TemplateTag)}
            disabled={!connected}
            className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
          >
            <option value="prospectos">Prospectos</option>
            <option value="clientes">Clientes</option>
            <option value="polizas">Polizas</option>
            <option value="cumpleanos">Cumpleanos</option>
            <option value="eventos">Eventos</option>
            <option value="personalizar">Personalizar</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <div
            className="h-11 px-4 rounded-2xl border border-black/10 text-black font-black text-[10px] uppercase tracking-widest inline-flex items-center"
            style={{ backgroundColor: templateTagColor }}
          >
            {templateTagLabel === "personalizar" ? templateTagCustomLabel || "Personalizada" : "Vista etiqueta"}
          </div>
          {templateTagLabel === "personalizar" ? (
            <div className="flex items-center gap-2">
              <input
                value={templateTagCustomLabel}
                onChange={(e) => onChangeTemplateTagCustomLabel(e.target.value)}
                placeholder="Que significa la etiqueta"
                className="w-[220px] text-black px-3 py-3 rounded-xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
              />
              <input
                type="color"
                value={templateTagColor}
                onChange={(e) => onChangeTemplateTagColor(e.target.value)}
                className="w-11 h-11 p-1 rounded-xl border border-black/10 bg-white"
                title="Color de etiqueta personalizada"
              />
            </div>
          ) : null}
        </div>
      </div>

      <textarea
        value={templatePrompt}
        onChange={(e) => onChangeTemplatePrompt(e.target.value)}
        rows={2}
        disabled={!connected}
        placeholder="Instrucciones para IA: crea o mejora el template..."
        className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onCreateTemplateWithAI}
          disabled={!connected || templatesAIWorking}
          className="px-4 py-3 rounded-2xl bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 disabled:opacity-60"
        >
          {templatesAIWorking ? "IA trabajando..." : "Crear template con IA"}
        </button>
        <button
          type="button"
          onClick={onImproveTemplateWithAI}
          disabled={!connected || templatesAIWorking}
          className="px-4 py-3 rounded-2xl bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 disabled:opacity-60"
        >
          {templatesAIWorking ? "IA trabajando..." : "Mejorar template con IA"}
        </button>
      </div>

      {templatesResult ? <div className="text-[11px] font-bold text-black/60 whitespace-pre-wrap">{templatesResult}</div> : null}
        </>
      ) : null}
    </div>
  )
}
