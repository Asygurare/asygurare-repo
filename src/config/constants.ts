export const ROUTES = {

}

export type CustomerStatus = 'nuevo' | 'en seguimiento' | 'activo' | 'otro'
export type PolicyStatus = 'vigente' | 'vencida' | 'cancelada' | 'renovada' | 'otro'
export type PolicyCategory = 'Autos' | 'Vida' | 'GMM' | 'Hogar' | 'Otro'
export type PolicyFrequency = 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'otro'
export type PolicyType = 'Vida' | 'Autos' | 'Hogar' | 'GMM' | 'Otro'
export type PolicyPaymentMethod = 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'otro'
export type PolicyPaymentStatus = 'pendiente' | 'pagado' | 'vencido' | 'otro'
export type PolicyPaymentType = 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'otro'

export enum InsuranceType {
    Vida = 'Vida',
    Autos = 'Auto',
    Salud = 'SGMM',
    Hogar = 'Hogar',
    Retiro = 'Retiro',
    Accidentes = 'Accidentes personales',
    Otro = 'Otro'
}

export enum Gender {
    Masculino = 'Masculino',
    Femenino = 'Femenino',
    NoBinario = 'No binario',
    Otro = 'Otro',
    PrefieroNoDecir = 'Prefiero no decir'
}

export enum MaritalStatus {
    Soltero = 'Soltero/a',
    Casado = 'Casado/a',
    UniónLibre = 'Unión libre',
    Divorciado = 'Divorciado/a',
    Viudo = 'Viudo/a',
    Otro = 'Otro'
}
