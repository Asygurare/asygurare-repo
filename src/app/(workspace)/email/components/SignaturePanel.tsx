type SignaturePanelProps = {
  connected: boolean
  includeSignature: boolean
  signatureName: string
  signaturePhone: string
  signatureLinksText: string
  signatureFooterText: string
  logoUploading: boolean
  signatureSaving: boolean
  signatureLoading: boolean
  signatureLogoUrl: string
  signatureResult: string
  onToggleIncludeSignature: (value: boolean) => void
  onChangeSignatureName: (value: string) => void
  onChangeSignaturePhone: (value: string) => void
  onChangeSignatureLinksText: (value: string) => void
  onChangeSignatureFooterText: (value: string) => void
  onUploadSignatureLogo: (file: File | null) => void
  onSaveSignature: () => void
}

export default function SignaturePanel({
  connected,
  includeSignature,
  signatureName,
  signaturePhone,
  signatureLinksText,
  signatureFooterText,
  logoUploading,
  signatureSaving,
  signatureLoading,
  signatureLogoUrl,
  signatureResult,
  onToggleIncludeSignature,
  onChangeSignatureName,
  onChangeSignaturePhone,
  onChangeSignatureLinksText,
  onChangeSignatureFooterText,
  onUploadSignatureLogo,
  onSaveSignature,
}: SignaturePanelProps) {
  return (
    <div className="rounded-2xl border border-black/10 bg-gray-50/70 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[10px] font-black uppercase tracking-widest text-black">Tu firma de correo</p>
        <label className="inline-flex items-center gap-2 text-[11px] font-bold text-black/70">
          <input
            type="checkbox"
            checked={includeSignature}
            onChange={(e) => onToggleIncludeSignature(e.target.checked)}
            disabled={!connected}
          />
          Agregar firma automaticamente
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input
          value={signatureName}
          onChange={(e) => onChangeSignatureName(e.target.value)}
          disabled={!connected}
          placeholder="Nombre de firma (ej. Tu firma de correo)"
          className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
        />
        <input
          value={signaturePhone}
          onChange={(e) => onChangeSignaturePhone(e.target.value)}
          disabled={!connected}
          placeholder="Telefono"
          className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
        />
      </div>

      <textarea
        value={signatureLinksText}
        onChange={(e) => onChangeSignatureLinksText(e.target.value)}
        rows={4}
        disabled={!connected}
        placeholder="Links (uno por linea): Nombre|https://tu-link.com"
        className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
      />

      <textarea
        value={signatureFooterText}
        onChange={(e) => onChangeSignatureFooterText(e.target.value)}
        rows={2}
        disabled={!connected}
        placeholder="Texto final de firma (ej. Asesoria personalizada en seguros)."
        className="w-full text-black px-4 py-3 rounded-2xl border border-black/10 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-(--accents)/40"
      />

      <div className="flex items-center gap-2 flex-wrap">
        <label className="inline-flex items-center justify-center px-4 py-3 rounded-2xl bg-white border border-black/10 text-black font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-gray-50">
          {logoUploading ? "Subiendo logo..." : "Subir logo (bucket tu-logo)"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            disabled={!connected || logoUploading}
            onChange={(e) => onUploadSignatureLogo(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="button"
          onClick={onSaveSignature}
          disabled={!connected || signatureSaving}
          className="px-4 py-3 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-black/85 disabled:opacity-60"
        >
          {signatureSaving ? "Guardando firma..." : "Guardar tu firma de correo"}
        </button>
        {signatureLoading ? <span className="text-[11px] font-bold text-black/50">Cargando firma...</span> : null}
      </div>

      {signatureLogoUrl ? (
        <div className="rounded-2xl border border-black/10 bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">Logo actual</p>
          <img src={signatureLogoUrl} alt="Logo de firma" className="max-h-[70px] max-w-[220px] object-contain" />
        </div>
      ) : null}

      <p className="text-[11px] font-bold text-black/45">
        Formato de links: <span className="font-black">Nombre|https://url.com</span> (uno por linea).
      </p>
      {signatureResult ? <div className="text-[11px] font-bold text-black/60 whitespace-pre-wrap">{signatureResult}</div> : null}
    </div>
  )
}
