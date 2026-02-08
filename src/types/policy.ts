// types/policy.ts
export interface Customer {
  id: string
  name?: string | null
  last_name?: string | null
  full_name?: string | null
  email: string | null
  phone?: string | null
  age?: number | null
}

export interface Policy {
  id: string
  policy_number: string
  insurance_company: string
  category: string
  total_premium: number
  frecuencia_pago: string
  expiry_date: string
  effective_date: string
  status: string
  customer_id: string
}

// 3. Tipo extendido para la UI (GRID)
// Supabase devuelve la póliza + el objeto WS_CUSTOMERS unido
export interface PolicyWithCustomer extends Policy {
    WS_CUSTOMERS_2?: Customer | null
}

// 4. Tipo para el Formulario (MODAL)
// A veces los formularios necesitan que los campos sean opcionales o nulos al iniciar
// Omitimos campos de auditoría que el usuario no edita (created_at, status, etc)
export type PolicyFormData = Partial<Omit<Policy, 'created_at' | 'status'>> & {
  id?: string // El ID es opcional al crear, obligatorio al editar
}