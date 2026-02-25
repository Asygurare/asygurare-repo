export const ROUTES = {

}

export type PolicyStatus = 'vigente' | 'vencida' | 'cancelada' | 'renovada' | 'otro'
export type PolicyCategory = 'Autos' | 'Vida' | 'GMM' | 'Hogar' | 'Otro'
export type PolicyFrequency = 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'otro'
export type PolicyType = 'Vida' | 'Autos' | 'Hogar' | 'GMM' | 'Otro'
export type PolicyPaymentMethod = 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'otro'
export type PolicyPaymentStatus = 'pendiente' | 'pagado' | 'vencido' | 'otro'
export type PolicyPaymentType = 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'otro'

/** Prima mínima (MXN) para considerar una póliza como "Cliente VIP". Valor por defecto si no está configurado en PROFILES.vip_premium_min. */
export const VIP_PREMIUM_MIN_DEFAULT = 50000

export enum InsuranceType {
    Vida = 'Vida',
    Autos = 'Auto',
    SGMM = 'SGMM',
    Hogar = 'Hogar',
    Retiro = 'Retiro',
    Accidentes = 'Accidentes personales',
    Otro = 'Otro'
}

export enum Gender {
    Masculino = 'Masculino',
    Femenino = 'Femenino',
    Otro = 'Otro',
}

export enum MaritalStatus {
    Soltero = 'Soltero/a',
    Casado = 'Casado/a',
    UniónLibre = 'Unión libre',
    Divorciado = 'Divorciado/a',
    Viudo = 'Viudo/a',
    Otro = 'Otro'
}

/** Origen del prospecto/cliente (campo source). Compartido entre leads y customers. */
export enum OriginSource {
    Referido = 'Referido',
    RedesSociales = 'Redes Sociales',
    LlamadaEnFrio = 'Llamada en Frío',
    CampanaWeb = 'Campaña Web',
    CarteraAntigua = 'Cartera Antigua',
    Familiar = 'Familiar',
    CirculoSocial = 'Círculo social (Amigos)',
    Personalizado = 'Personalizado',
}

// ——— Prospectos (leads) only ———
/** Columnas del pipeline de prospectos. */
export enum PipelineStage {
    PrimerContacto = 'Primer contacto',
    CitaAgendada = 'Cita agendada',
    PropuestaEnviada = 'Propuesta enviada',
    EnNegociacion = 'En negociación',
    Ganado = 'Ganado',
    Descartado = 'Descartado',
}

/** Etapa editable en formulario de prospecto (pipeline activo + Otro). */
export enum LeadFormStage {
    PrimerContacto = 'Primer contacto',
    CitaAgendada = 'Cita agendada',
    PropuestaEnviada = 'Propuesta enviada',
    EnNegociacion = 'En negociación',
    Otro = 'Otro',
}

/** Estatus de prospecto (campo status en WS_LEADS). */
export enum LeadStatus {
    Nuevo = 'Nuevo',
    EnSeguimiento = 'En seguimiento',
    Descartado = 'Descartado',
    Ganado = 'Ganado',
    Otro = 'Otro',
}

/** Nivel de estudios (campos adicionales de prospectos). */
export enum EducationLevel {
    Primaria = 'Primaria',
    Secundaria = 'Secundaria',
    Preparatoria = 'Preparatoria',
    Licenciatura = 'Licenciatura',
    Posgrado = 'Posgrado',
    Otro = 'Otro',
}

/** Monedas para montos estimados (prospectos). */
export enum Currency {
    MXN = 'MXN',
    USD = 'USD',
    EUR = 'EUR',
}

/** Método de pago para pólizas (campo payment_method en WS_POLICIES). */
export enum PolicyMetodoPago {
  TarjetaCredito = 'Tarjeta de Crédito',
  Debito = 'Débito',
  ContadoEfectivo = 'Contado (efectivo)',
}

// ——— Clientes only ———
/** Estatus de cliente (campo status en WS_CUSTOMERS_2). */
export enum CustomerStatus {
    Activo = 'Activo',
    EnRenovacion = 'En Renovación',
    Descartado = 'Descartado',
}
