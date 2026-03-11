/**
 * Field schemas for WS_LEADS and WS_CUSTOMERS_2.
 *
 * Each FieldDescriptor carries aliases (Spanish & English variations) so the
 * auto-mapper can suggest column → field matches heuristically.
 *
 * The schemas mirror the payloads that prospectos/page.tsx and clientes/page.tsx
 * already send to Supabase, so the import produces 1:1 compatible rows.
 */

import type { FieldDescriptor, ImportEntity } from '@/src/types/import'

// ─── Leads (WS_LEADS) ─────────────────────────────────────────────────────────

export const LEAD_FIELDS: FieldDescriptor[] = [
  { key: 'name',             label: 'Nombre',              type: 'string',  required: true,  aliases: ['nombre', 'first name', 'first_name', 'nombre de pila'] },
  { key: 'last_name',        label: 'Apellido',            type: 'string',  aliases: ['apellido', 'apellidos', 'surname', 'last name', 'lastname'] },
  { key: 'email',            label: 'Email',               type: 'string',  aliases: ['correo', 'correo electrónico', 'correo electronico', 'e-mail', 'mail'] },
  { key: 'phone',            label: 'Teléfono',            type: 'string',  aliases: ['telefono', 'teléfono', 'tel', 'celular', 'whatsapp', 'móvil', 'movil', 'phone number'] },
  { key: 'source',           label: 'Origen',              type: 'string',  aliases: ['origen', 'fuente', 'referencia', 'canal'] },
  { key: 'status',           label: 'Estatus',             type: 'string',  aliases: ['estatus', 'estado del prospecto', 'lead status'] },
  { key: 'stage',            label: 'Etapa',               type: 'string',  aliases: ['etapa', 'pipeline', 'fase', 'stage'] },
  { key: 'insurance_type',   label: 'Tipo de seguro',      type: 'string',  aliases: ['tipo de seguro', 'seguro', 'ramo', 'insurance', 'insurance type'] },
  { key: 'estimated_value',  label: 'Prima estimada',      type: 'number',  aliases: ['prima', 'prima estimada', 'monto', 'valor estimado', 'estimated value', 'premium'] },
  { key: 'birthday',         label: 'Fecha de nacimiento', type: 'date',    aliases: ['cumpleaños', 'fecha de nacimiento', 'nacimiento', 'birthday', 'birth date', 'fecha nacimiento', 'birthdate'] },
  { key: 'age',              label: 'Edad',                type: 'number',  aliases: ['edad', 'age', 'años'] },
  { key: 'gender',           label: 'Género',              type: 'string',  aliases: ['genero', 'género', 'sexo', 'gender', 'sex'] },
  { key: 'marital_status',   label: 'Estado civil',        type: 'string',  aliases: ['estado civil', 'marital status', 'civil'] },
  { key: 'smoking',          label: 'Fuma',                type: 'boolean', aliases: ['fuma', 'fumador', 'smoking', 'smoker'] },
  { key: 'drinking',         label: 'Toma',                type: 'boolean', aliases: ['toma', 'bebe', 'drinking', 'alcohol'] },
  { key: 'ocupation',        label: 'Ocupación',           type: 'string',  aliases: ['ocupacion', 'ocupación', 'profesion', 'profesión', 'occupation', 'trabajo', 'empleo', 'job'] },
  { key: 'country',          label: 'País',                type: 'string',  aliases: ['pais', 'país', 'country'] },
  { key: 'city',             label: 'Ciudad',              type: 'string',  aliases: ['ciudad', 'city', 'localidad'] },
  { key: 'state',            label: 'Estado',              type: 'string',  aliases: ['estado', 'state', 'provincia', 'entidad'] },
  { key: 'address',          label: 'Dirección',           type: 'string',  aliases: ['direccion', 'dirección', 'domicilio', 'address', 'calle'] },
  { key: 'postal_code',      label: 'Código postal',       type: 'string',  aliases: ['codigo postal', 'código postal', 'cp', 'zip', 'zip code', 'postal code', 'postal'] },
  { key: 'client_interests', label: 'Intereses',           type: 'string',  aliases: ['intereses', 'interests', 'hobbies', 'client interests'] },
  { key: 'notes',            label: 'Notas',               type: 'string',  aliases: ['notas', 'notes', 'comentarios', 'observaciones', 'bitácora', 'bitacora'] },

  // additional_fields (JSONB)
  { key: 'contact_date',              label: 'Fecha de contacto',     type: 'date',    isAdditionalField: true, aliases: ['fecha de contacto', 'contact date', 'primer contacto'] },
  { key: 'economic_dependents',       label: 'Dependientes económicos', type: 'number', isAdditionalField: true, aliases: ['dependientes', 'dependientes económicos', 'dependientes economicos', 'economic dependents'] },
  { key: 'education_level',           label: 'Nivel de estudios',     type: 'string',  isAdditionalField: true, aliases: ['escolaridad', 'nivel de estudios', 'educacion', 'educación', 'education', 'education level'] },
  { key: 'sector',                    label: 'Sector',                type: 'string',  isAdditionalField: true, aliases: ['sector', 'industria', 'giro', 'industry'] },
  { key: 'monthly_income_estimated',  label: 'Ingreso mensual',       type: 'number',  isAdditionalField: true, aliases: ['ingreso', 'ingreso mensual', 'sueldo', 'salario', 'income', 'monthly income'] },
  { key: 'currency',                  label: 'Moneda',                type: 'string',  isAdditionalField: true, aliases: ['moneda', 'divisa', 'currency'] },
  { key: 'financial_goals',           label: 'Metas financieras',     type: 'string',  isAdditionalField: true, aliases: ['metas financieras', 'objetivos financieros', 'financial goals'] },
]

// ─── Customers (WS_CUSTOMERS_2) ────────────────────────────────────────────────

export const CUSTOMER_FIELDS: FieldDescriptor[] = [
  { key: 'name',             label: 'Nombre',              type: 'string',  required: true,  aliases: ['nombre', 'first name', 'first_name', 'nombre de pila'] },
  { key: 'last_name',        label: 'Apellido',            type: 'string',  aliases: ['apellido', 'apellidos', 'surname', 'last name', 'lastname'] },
  { key: 'email',            label: 'Email',               type: 'string',  aliases: ['correo', 'correo electrónico', 'correo electronico', 'e-mail', 'mail'] },
  { key: 'phone',            label: 'Teléfono',            type: 'string',  aliases: ['telefono', 'teléfono', 'tel', 'celular', 'whatsapp', 'móvil', 'movil', 'phone number'] },
  { key: 'source',           label: 'Origen',              type: 'string',  aliases: ['origen', 'fuente', 'referencia', 'canal'] },
  { key: 'status',           label: 'Estatus',             type: 'string',  aliases: ['estatus', 'estado del cliente', 'customer status'] },
  { key: 'insurance_type',   label: 'Tipo de seguro',      type: 'string',  aliases: ['tipo de seguro', 'seguro', 'ramo', 'insurance', 'insurance type'] },
  { key: 'estimated_value',  label: 'Prima estimada',      type: 'number',  aliases: ['prima', 'prima estimada', 'monto', 'valor estimado', 'estimated value', 'premium'] },
  { key: 'birthday',         label: 'Fecha de nacimiento', type: 'date',    aliases: ['cumpleaños', 'fecha de nacimiento', 'nacimiento', 'birthday', 'birth date', 'fecha nacimiento', 'birthdate'] },
  { key: 'age',              label: 'Edad',                type: 'number',  aliases: ['edad', 'age', 'años'] },
  { key: 'gender',           label: 'Género',              type: 'string',  aliases: ['genero', 'género', 'sexo', 'gender', 'sex'] },
  { key: 'marital_status',   label: 'Estado civil',        type: 'string',  aliases: ['estado civil', 'marital status', 'civil'] },
  { key: 'smoking',          label: 'Fuma',                type: 'boolean', aliases: ['fuma', 'fumador', 'smoking', 'smoker'] },
  { key: 'drinking',         label: 'Toma',                type: 'boolean', aliases: ['toma', 'bebe', 'drinking', 'alcohol'] },
  { key: 'ocupation',        label: 'Ocupación',           type: 'string',  aliases: ['ocupacion', 'ocupación', 'profesion', 'profesión', 'occupation', 'trabajo', 'empleo', 'job'] },
  { key: 'client_interests', label: 'Intereses',           type: 'string',  aliases: ['intereses', 'interests', 'hobbies', 'client interests'] },
  { key: 'notes',            label: 'Notas',               type: 'string',  aliases: ['notas', 'notes', 'comentarios', 'observaciones', 'bitácora', 'bitacora'] },
]

// ─── Helper to pick the right schema ───────────────────────────────────────────

export function getFieldsForEntity(entity: ImportEntity): FieldDescriptor[] {
  return entity === 'leads' ? LEAD_FIELDS : CUSTOMER_FIELDS
}
