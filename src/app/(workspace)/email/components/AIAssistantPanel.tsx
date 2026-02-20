import { Sparkles } from "lucide-react"

type AIAssistantPanelProps = {
  senderDisplayName: string
  draftInstructions: string
  drafting: boolean
  draftResult: string
  onChangeDraftInstructions: (value: string) => void
  onDraft: () => void
}

export default function AIAssistantPanel({
  senderDisplayName,
  draftInstructions,
  drafting,
  draftResult,
  onChangeDraftInstructions,
  onDraft,
}: AIAssistantPanelProps) {
  return (
    <div className="rounded-2xl border border-(--accents)/30 bg-(--accents)/10 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-black/60 mb-2">
        GUROS AI puede escribir por ti
      </p>
      <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Significados</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest">
            client_name
          </span>
          <span className="text-[11px] font-bold text-indigo-800/90">= Nombre del cliente</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-widest">
            {senderDisplayName}
          </span>
          <span className="text-[11px] font-bold text-indigo-800/90">= Tu nombre al enviar</span>
        </div>
      </div>
      <textarea
        value={draftInstructions}
        onChange={(e) => onChangeDraftInstructions(e.target.value)}
        rows={3}
        className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
      />
      <button
        onClick={onDraft}
        disabled={drafting}
        className="mt-3 inline-flex items-center justify-center gap-2 w-full px-6 py-4 rounded-[2rem] bg-(--accents) text-white font-black text-[10px] uppercase tracking-widest hover:opacity-90 transition-all active:scale-[0.99] disabled:opacity-60 shadow-lg shadow-(--accents)/20"
      >
        <Sparkles size={14} />
        {drafting ? "Redactando…" : "Redactar con GUROS AI"}
      </button>
      {draftResult ? <div className="mt-2 text-[11px] font-bold text-black/60 whitespace-pre-wrap">{draftResult}</div> : null}
    </div>
  )
}
