import { Facebook, Globe, Instagram, Linkedin, MessageCircle, Youtube } from "lucide-react"

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
  signatureBackgroundColor: string
  signatureBorderColor: string
  signatureBorderRadius: number
  logoBackgroundColor: string
  logoBorderColor: string
  logoBorderRadius: number
  signaturePreviewHtml: string
  onToggleIncludeSignature: (value: boolean) => void
  onChangeSignatureName: (value: string) => void
  onChangeSignaturePhone: (value: string) => void
  onChangeSignatureLinksText: (value: string) => void
  onChangeSignatureFooterText: (value: string) => void
  onChangeSignatureBackgroundColor: (value: string) => void
  onChangeSignatureBorderColor: (value: string) => void
  onChangeSignatureBorderRadius: (value: number) => void
  onChangeLogoBackgroundColor: (value: string) => void
  onChangeLogoBorderColor: (value: string) => void
  onChangeLogoBorderRadius: (value: number) => void
  onAddSocialLink: (label: string, url: string) => void
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
  signatureBackgroundColor,
  signatureBorderColor,
  signatureBorderRadius,
  logoBackgroundColor,
  logoBorderColor,
  logoBorderRadius,
  signaturePreviewHtml,
  onToggleIncludeSignature,
  onChangeSignatureName,
  onChangeSignaturePhone,
  onChangeSignatureLinksText,
  onChangeSignatureFooterText,
  onChangeSignatureBackgroundColor,
  onChangeSignatureBorderColor,
  onChangeSignatureBorderRadius,
  onChangeLogoBackgroundColor,
  onChangeLogoBorderColor,
  onChangeLogoBorderRadius,
  onAddSocialLink,
  onUploadSignatureLogo,
  onSaveSignature,
}: SignaturePanelProps) {
  const socialOptions = [
    { label: "Sitio web", icon: Globe, url: "https://tu-sitio.com" },
    { label: "Instagram", icon: Instagram, url: "https://instagram.com/tu_usuario" },
    { label: "Facebook", icon: Facebook, url: "https://facebook.com/tu_pagina" },
    { label: "LinkedIn", icon: Linkedin, url: "https://linkedin.com/in/tu_usuario" },
    { label: "WhatsApp", icon: MessageCircle, url: "https://wa.me/5210000000000" },
    { label: "YouTube", icon: Youtube, url: "https://youtube.com/@tu_canal" },
  ] as const

  return (
    <div className="rounded-2xl border border-black/10 bg-gray-50/70 p-4 space-y-4">
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

      <div className="rounded-2xl border border-black/10 bg-white p-3 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-black/50">Redes e iconos</p>
        <div className="flex flex-wrap gap-2">
          {socialOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => onAddSocialLink(option.label, option.url)}
                disabled={!connected}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 bg-white text-[10px] font-black uppercase tracking-widest text-black hover:bg-gray-50 disabled:opacity-60"
              >
                <Icon size={13} />
                {option.label}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] font-bold text-black/45">
          Usa los botones para agregar enlaces con estructura lista para editar.
        </p>
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

      <div className="rounded-2xl border border-black/10 bg-white p-3 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-black/50">Estilo tipo Canva</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-black/50">Fondo firma</span>
            <input
              type="color"
              value={signatureBackgroundColor}
              disabled={!connected}
              onChange={(e) => onChangeSignatureBackgroundColor(e.target.value)}
              className="w-full h-10 rounded-xl border border-black/10 bg-white p-1 cursor-pointer"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-black/50">Borde firma</span>
            <input
              type="color"
              value={signatureBorderColor}
              disabled={!connected}
              onChange={(e) => onChangeSignatureBorderColor(e.target.value)}
              className="w-full h-10 rounded-xl border border-black/10 bg-white p-1 cursor-pointer"
            />
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-black/50">
              Radio firma ({signatureBorderRadius}px)
            </span>
            <input
              type="range"
              min={0}
              max={28}
              step={1}
              value={signatureBorderRadius}
              disabled={!connected}
              onChange={(e) => onChangeSignatureBorderRadius(Number(e.target.value))}
              className="w-full accent-black"
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[10px] font-black uppercase tracking-widest text-black/50">Logo y marco</p>
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-black/50">Fondo logo</span>
            <input
              type="color"
              value={logoBackgroundColor}
              disabled={!connected}
              onChange={(e) => onChangeLogoBackgroundColor(e.target.value)}
              className="w-full h-10 rounded-xl border border-black/10 bg-white p-1 cursor-pointer"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-black/50">Borde logo</span>
            <input
              type="color"
              value={logoBorderColor}
              disabled={!connected}
              onChange={(e) => onChangeLogoBorderColor(e.target.value)}
              className="w-full h-10 rounded-xl border border-black/10 bg-white p-1 cursor-pointer"
            />
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-black/50">
              Radio logo ({logoBorderRadius}px)
            </span>
            <input
              type="range"
              min={0}
              max={28}
              step={1}
              value={logoBorderRadius}
              disabled={!connected}
              onChange={(e) => onChangeLogoBorderRadius(Number(e.target.value))}
              className="w-full accent-black"
            />
          </label>
        </div>

        {signatureLogoUrl ? (
          <div
            className="p-3 inline-flex rounded-2xl border"
            style={{
              backgroundColor: logoBackgroundColor,
              borderColor: logoBorderColor,
              borderRadius: `${logoBorderRadius}px`,
            }}
          >
            <img src={signatureLogoUrl} alt="Logo de firma" className="max-h-[70px] max-w-[220px] object-contain" />
          </div>
        ) : (
          <p className="text-[11px] font-bold text-black/45">Sube un logo para ver su marco personalizado.</p>
        )}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">Vista previa</p>
        <div className="rounded-2xl border border-black/10 bg-gray-50 p-4">
          {signaturePreviewHtml ? (
            <div dangerouslySetInnerHTML={{ __html: signaturePreviewHtml }} />
          ) : (
            <p className="text-[11px] font-bold text-black/45">
              Activa la firma y agrega contenido para ver la previsualizacion.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
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

      <p className="text-[11px] font-bold text-black/45">
        Formato de links: <span className="font-black">Nombre|https://url.com</span> (uno por linea).
      </p>
      {signatureResult ? <div className="text-[11px] font-bold text-black/60 whitespace-pre-wrap">{signatureResult}</div> : null}
    </div>
  )
}
