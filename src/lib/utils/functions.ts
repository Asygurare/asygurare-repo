import { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE } from '@/src/config';

const dataCache = new Map<string, { data: any[], timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 5;

const limpiarNumero = (val: any): number => {
  if (typeof val === 'number') return val;
  const num = parseFloat(String(val || '0').replace(/[$, ]/g, ''));
  return isNaN(num) ? 0 : num;
};

export async function obtenerDatosConCache(supabase: SupabaseClient, archivoId: string) {
  const cacheKey = `archivo_${archivoId}`;
  const cached = dataCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) return cached.data;

  const { data, error } = await supabase.from('WS_ARC_ARCHIVOS').select('datos').eq('id', archivoId).single();
  if (error) throw error;
  
  dataCache.set(cacheKey, { data: data.datos, timestamp: Date.now() });
  return data.datos;
}

// -------------------------
// Workspace: contexto operativo + RAG básico
// -------------------------

const workspaceCache = new Map<string, { data: any; timestamp: number }>();
const WORKSPACE_CACHE_DURATION = 1000 * 15; // 15s: baja latencia sin "stale" notable

function clampInt(n: any, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function normalizeQuery(q: string) {
  return String(q || '').trim().slice(0, 120);
}

export async function obtenerContextoOperativoWorkspaceConCache(
  supabase: SupabaseClient,
  { tz, nowIso }: { tz: string; nowIso: string }
) {
  const now = new Date(nowIso);
  const nowMs = Number.isNaN(now.getTime()) ? Date.now() : now.getTime();
  const cacheKey = `wsctx:${tz}:${Math.floor(nowMs / 10000)}`; // bucket 10s
  const cached = workspaceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < WORKSPACE_CACHE_DURATION) return cached.data;

  const nowDate = new Date(nowMs);
  const horizon7d = new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString();
  const horizon30d = new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString();

  const tasksQ = supabase
    .from(DATABASE.TABLES.WS_TASKS)
    .select('id,due_at,status,kind,priority,title,entity_type,entity_id')
    .neq('status', 'done')
    .not('due_at', 'is', null)
    .gte('due_at', nowDate.toISOString())
    .lt('due_at', horizon7d)
    .order('due_at', { ascending: true })
    .limit(24);

  const recentLeadsQ = supabase
    .from(DATABASE.TABLES.WS_LEADS)
    .select('id,name,last_name,full_name,stage,status,insurance_type,phone,email,updated_at')
    .order('updated_at', { ascending: false })
    .limit(8);

  const recentCustomersQ = supabase
    .from(DATABASE.TABLES.WS_CUSTOMERS_2)
    .select('id,name,last_name,status,insurance_type,phone,email,created_at')
    .order('created_at', { ascending: false })
    .limit(8);

  const recentPoliciesQ = supabase
    .from(DATABASE.TABLES.WS_POLICIES)
    .select('id,policy_number,insurance_company,category,expiry_date,total_premium,created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  const expiringPoliciesQ = supabase
    .from(DATABASE.TABLES.WS_POLICIES)
    .select('id,policy_number,insurance_company,category,expiry_date,total_premium')
    .not('expiry_date', 'is', null)
    .gte('expiry_date', nowDate.toISOString())
    .lt('expiry_date', horizon30d)
    .order('expiry_date', { ascending: true })
    .limit(8);

  // Conteos: en paralelo (son queries rápidas con head:true)
  const countLeadsQ = supabase.from(DATABASE.TABLES.WS_LEADS).select('id', { count: 'exact', head: true });
  const countPoliciesQ = supabase.from(DATABASE.TABLES.WS_POLICIES).select('id', { count: 'exact', head: true });

  const [
    { data: tasks, error: tasksErr },
    { data: recentLeads, error: leadsErr },
    { data: recentCustomers, error: customersErr },
    { data: recentPolicies, error: recentPoliciesErr },
    { data: expiringPolicies, error: expiringErr },
    { count: totalLeads, error: countLeadsErr },
    { count: totalPolicies, error: countPoliciesErr },
  ] = await Promise.all([
    tasksQ,
    recentLeadsQ,
    recentCustomersQ,
    recentPoliciesQ,
    expiringPoliciesQ,
    countLeadsQ,
    countPoliciesQ,
  ]);

  const safeTasks = (tasksErr ? [] : (tasks || [])) as any[];
  const safeLeads = (leadsErr ? [] : (recentLeads || [])) as any[];
  const safeCustomers = (customersErr ? [] : (recentCustomers || [])) as any[];
  const safeRecentPolicies = (recentPoliciesErr ? [] : (recentPolicies || [])) as any[];
  const safeExpiring = (expiringErr ? [] : (expiringPolicies || [])) as any[];

  const fmtKey = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const todayKey = fmtKey(nowDate);

  const tasksToday = safeTasks.filter((t) => {
    const due = t?.due_at ? new Date(t.due_at) : null;
    if (!due || Number.isNaN(due.getTime())) return false;
    return fmtKey(due) === todayKey;
  });

  const ctx = {
    tz,
    nowIso: nowDate.toISOString(),
    totals: {
      leads: countLeadsErr ? (safeLeads.length || 0) : (totalLeads || 0),
      policies: countPoliciesErr ? (safeRecentPolicies.length || 0) : (totalPolicies || 0),
    },
    tasksToday,
    tasksNext7Days: safeTasks,
    recentLeads: safeLeads,
    recentCustomers: safeCustomers,
    recentPolicies: safeRecentPolicies,
    policiesExpiringSoon: safeExpiring,
  };

  workspaceCache.set(cacheKey, { data: ctx, timestamp: Date.now() });
  return ctx;
}

export async function buscarProspectosWorkspace(
  supabase: SupabaseClient,
  { query, limit }: { query: string; limit?: number }
) {
  const q = normalizeQuery(query);
  const lim = clampInt(limit ?? 6, 1, 10);
  if (q.length < 3) return [];

  // Preferir RPC con índices (si existe). Fallback a ilike.
  try {
    const { data, error } = await supabase.rpc('ws_search_leads', { q, lim });
    if (!error && Array.isArray(data)) return data as any[];
  } catch {
    // ignore
  }

  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_LEADS)
    .select('id,name,last_name,full_name,stage,status,insurance_type,phone,email,updated_at')
    .or(
      [
        `name.ilike.%${q}%`,
        `last_name.ilike.%${q}%`,
        `full_name.ilike.%${q}%`,
        `phone.ilike.%${q}%`,
        `email.ilike.%${q}%`,
      ].join(',')
    )
    .order('updated_at', { ascending: false })
    .limit(lim);

  if (error) return [];
  return (data || []) as any[];
}

export async function buscarClientesWorkspace(
  supabase: SupabaseClient,
  { query, limit }: { query: string; limit?: number }
) {
  const q = normalizeQuery(query);
  const lim = clampInt(limit ?? 6, 1, 10);
  if (q.length < 3) return [];

  // Preferir RPC con índices (si existe). Fallback a ilike.
  try {
    const { data, error } = await supabase.rpc('ws_search_customers', { q, lim });
    if (!error && Array.isArray(data)) return data as any[];
  } catch {
    // ignore
  }

  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_CUSTOMERS_2)
    .select('id,name,last_name,status,insurance_type,phone,email,created_at')
    .or([`name.ilike.%${q}%`, `last_name.ilike.%${q}%`, `phone.ilike.%${q}%`, `email.ilike.%${q}%`].join(','))
    .order('created_at', { ascending: false })
    .limit(lim);

  if (error) return [];
  return (data || []) as any[];
}

export async function buscarPolizasWorkspace(
  supabase: SupabaseClient,
  { query, limit }: { query: string; limit?: number }
) {
  const q = normalizeQuery(query);
  const lim = clampInt(limit ?? 6, 1, 10);
  if (q.length < 2) return [];

  // Preferir RPC con índices (si existe). Fallback a ilike.
  try {
    const { data, error } = await supabase.rpc('ws_search_policies', { q, lim });
    if (!error && Array.isArray(data)) return data as any[];
  } catch {
    // ignore
  }

  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_POLICIES)
    .select('id,policy_number,insurance_company,category,expiry_date,total_premium,created_at')
    .or([`policy_number.ilike.%${q}%`, `insurance_company.ilike.%${q}%`, `category.ilike.%${q}%`].join(','))
    .order('created_at', { ascending: false })
    .limit(lim);

  if (error) return [];
  return (data || []) as any[];
}

// -------------------------
// Workspace: introspección + clientes
// -------------------------

function pickTableFromLogicalName(table: string) {
  switch (String(table || '').toLowerCase()) {
    case 'clientes':
    case 'customers':
    case 'ws_customers_2':
      return DATABASE.TABLES.WS_CUSTOMERS_2;
    case 'leads':
    case 'prospectos':
    case 'ws_leads':
      return DATABASE.TABLES.WS_LEADS;
    case 'polizas':
    case 'pólizas':
    case 'policies':
    case 'ws_policies':
      return DATABASE.TABLES.WS_POLICIES;
    case 'tareas':
    case 'tasks':
    case 'ws_tasks':
      return DATABASE.TABLES.WS_TASKS;
    default:
      return null;
  }
}

function recommendedSelectForLogicalTable(table: string, columns: string[]) {
  const t = String(table || '').toLowerCase();
  const pick = (wanted: string[]) => wanted.filter((c) => columns.includes(c));
  if (t === 'clientes') {
    return pick(['id', 'name', 'last_name', 'phone', 'email', 'age', 'birthday', 'status', 'insurance_type', 'created_at', 'updated_at']);
  }
  if (t === 'leads' || t === 'prospectos') {
    return pick(['id', 'name', 'last_name', 'phone', 'email', 'stage', 'status', 'insurance_type', 'estimated_value', 'updated_at', 'created_at']);
  }
  if (t === 'polizas' || t === 'pólizas') {
    return pick(['id', 'policy_number', 'insurance_company', 'category', 'status', 'total_premium', 'effective_date', 'expiry_date', 'customer_id', 'created_at']);
  }
  if (t === 'tareas') {
    return pick(['id', 'title', 'due_at', 'status', 'kind', 'priority', 'entity_type', 'entity_id', 'created_at', 'updated_at']);
  }
  return pick(['id', 'created_at', 'updated_at']);
}

function applySafeFilters(q: any, filters: any[], allowedColumns: string[]) {
  const list = Array.isArray(filters) ? filters : [];
  for (const f of list) {
    const col = String(f?.column || '').trim();
    const op = String(f?.op || '').trim();
    const valueRaw = f?.value;
    if (!col || !op) continue;
    if (!allowedColumns.includes(col)) continue;

    const v = valueRaw == null ? null : String(valueRaw);
    switch (op) {
      case 'eq':
        q = q.eq(col, v);
        break;
      case 'neq':
        q = q.neq(col, v);
        break;
      case 'ilike':
        q = q.ilike(col, v ?? '');
        break;
      case 'gt':
        q = q.gt(col, v);
        break;
      case 'gte':
        q = q.gte(col, v);
        break;
      case 'lt':
        q = q.lt(col, v);
        break;
      case 'lte':
        q = q.lte(col, v);
        break;
      case 'isnull':
        q = q.is(col, null);
        break;
      case 'notnull':
        q = q.not(col, 'is', null);
        break;
      case 'in': {
        const arr = String(v || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (arr.length) q = q.in(col, arr);
        break;
      }
      default:
        break;
    }
  }
  return q;
}

export async function describirTablaWorkspace(
  supabase: SupabaseClient,
  { table }: { table: string }
) {
  const realTable = pickTableFromLogicalName(table);
  if (!realTable) {
    return {
      ok: false,
      error: `Tabla desconocida: ${table}. Opciones: clientes, leads, polizas, tareas.`,
    };
  }

  // Muestra mínima para detectar keys sin traer dataset completo
  const { data, error } = await supabase.from(realTable).select('*').limit(1);
  if (error) return { ok: false, error: error.message };

  const row = (data && data[0]) ? data[0] : null;
  const columns = row && typeof row === 'object' ? Object.keys(row).sort() : [];
  return { ok: true, table: realTable, logicalTable: table, columns };
}

export async function consultarTablaWorkspace(
  supabase: SupabaseClient,
  args: {
    table: string;
    select?: string[];
    filters?: any[];
    orderBy?: string;
    orderDir?: 'asc' | 'desc';
    limit?: number;
  }
) {
  const logical = String(args?.table || '').toLowerCase();
  const realTable = pickTableFromLogicalName(logical);
  if (!realTable) return { ok: false, error: `Tabla desconocida: ${args?.table}` };

  const meta = await describirTablaWorkspace(supabase, { table: logical });
  if (!meta.ok) return { ok: false, error: meta.error };
  const allowedColumns = (meta.columns || []) as string[];

  const lim = clampInt(args?.limit ?? 10, 1, 50);
  const requestedSelect = Array.isArray(args?.select) ? args.select.map((s) => String(s).trim()).filter(Boolean) : null;
  const safeSelect = requestedSelect
    ? requestedSelect.filter((c) => allowedColumns.includes(c))
    : recommendedSelectForLogicalTable(logical, allowedColumns);
  const select = safeSelect.length ? safeSelect.join(',') : '*';

  let q = supabase.from(realTable).select(select).limit(lim);
  q = applySafeFilters(q, args?.filters || [], allowedColumns);

  const orderBy = String(args?.orderBy || '').trim();
  if (orderBy && allowedColumns.includes(orderBy)) {
    q = q.order(orderBy, { ascending: (args?.orderDir || 'desc') === 'asc' });
  } else if (allowedColumns.includes('created_at')) {
    q = q.order('created_at', { ascending: false });
  }

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, table: realTable, rows: (data || []) as any[], select: safeSelect };
}

export async function contarRegistrosWorkspace(
  supabase: SupabaseClient,
  args: { table: string; filters?: any[] }
) {
  const logical = String(args?.table || '').toLowerCase();
  const realTable = pickTableFromLogicalName(logical);
  if (!realTable) return { ok: false, error: `Tabla desconocida: ${args?.table}` };

  const meta = await describirTablaWorkspace(supabase, { table: logical });
  if (!meta.ok) return { ok: false, error: meta.error };
  const allowedColumns = (meta.columns || []) as string[];

  let q = supabase.from(realTable).select('id', { count: 'exact', head: true });
  q = applySafeFilters(q, args?.filters || [], allowedColumns);

  const { count, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, table: realTable, count: count || 0 };
}

export async function listarClientesWorkspace(
  supabase: SupabaseClient,
  { limit }: { limit?: number }
) {
  const lim = clampInt(limit ?? 12, 1, 50);

  // Intentamos traer campos comunes; si alguno no existe, PostgREST puede fallar.
  // Para evitar eso, hacemos una detección rápida de columnas y construimos select dinámico.
  const meta = await describirTablaWorkspace(supabase, { table: 'clientes' });
  if (!meta.ok) return { ok: false, error: meta.error, customers: [] };

  const wanted = [
    'id',
    'name',
    'last_name',
    'full_name',
    'phone',
    'email',
    'status',
    'insurance_type',
    'created_at',
    'updated_at',
  ];
  const cols = (meta.columns || []) as string[];
  const selectCols = wanted.filter((c) => cols.includes(c));
  // Si no encontramos ninguno, caemos a "*", pero limitamos.
  const select = selectCols.length ? selectCols.join(',') : '*';

  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_CUSTOMERS_2)
    .select(select)
    .order('created_at', { ascending: false })
    .limit(lim);

  if (error) return { ok: false, error: error.message, customers: [] };
  return { ok: true, customers: (data || []) as any[] };
}

function computeAgeFromBirthdate(birth: any, now = new Date()) {
  if (!birth) return null;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

export async function calcularEdadPromedioClientesWorkspace(
  supabase: SupabaseClient,
  { sampleLimit }: { sampleLimit?: number }
) {
  // Preferir RPC exacta (si existe). Fallback a cálculo local paginado.
  try {
    const { data, error } = await supabase.rpc('ws_avg_customers_age');
    if (!error && Array.isArray(data) && data[0]?.average_age != null) {
      return {
        ok: true,
        averageAge: Number(data[0].average_age),
        sampleSize: Number(data[0].sample_size || 0),
        used: { rpc: 'ws_avg_customers_age' },
      };
    }
  } catch {
    // ignore
  }

  const lim = clampInt(sampleLimit ?? 200, 10, 1000);
  const meta = await describirTablaWorkspace(supabase, { table: 'clientes' });
  if (!meta.ok) return { ok: false, error: meta.error };

  const cols = (meta.columns || []) as string[];

  // Prioridad: edad directa numérica
  const ageColumns = ['edad', 'age'];
  const birthColumns = ['birth_date', 'birthdate', 'date_of_birth', 'dob', 'fecha_nacimiento', 'birthday'];

  const ageCol = ageColumns.find((c) => cols.includes(c)) || null;
  const birthCol = birthColumns.find((c) => cols.includes(c)) || null;

  if (!ageCol && !birthCol) {
    return {
      ok: false,
      error:
        "No encontré una columna de edad ni de fecha de nacimiento en la tabla de clientes.",
      detectedColumnsSample: cols.slice(0, 40),
    };
  }

  const selectCols = ['id'];
  if (ageCol) selectCols.push(ageCol);
  if (birthCol) selectCols.push(birthCol);

  // Cálculo exacto (paginado) para no traer columnas innecesarias.
  // Nota: si la tabla es enorme, esto puede tardar; se limita para proteger latencia.
  const { count: totalCount } = await supabase
    .from(DATABASE.TABLES.WS_CUSTOMERS_2)
    .select('id', { count: 'exact', head: true });

  const total = totalCount || 0;
  const MAX_EXACT = 5000;
  const target = Math.min(total || lim, MAX_EXACT);
  const pageSize = 1000;

  const now = new Date();
  const ages: number[] = [];

  for (let from = 0; from < target; from += pageSize) {
    const to = Math.min(target - 1, from + pageSize - 1);
    const { data, error } = await supabase
      .from(DATABASE.TABLES.WS_CUSTOMERS_2)
      .select(selectCols.join(','))
      .range(from, to);
    if (error) return { ok: false, error: error.message, used: { ageCol, birthCol } };

    for (const row of (data || []) as any[]) {
      if (ageCol) {
        const v = limpiarNumero(row?.[ageCol]);
        if (v > 0 && v < 130) ages.push(v);
        continue;
      }
      if (birthCol) {
        const a = computeAgeFromBirthdate(row?.[birthCol], now);
        if (a != null) ages.push(a);
      }
    }
  }

  if (!ages.length) {
    return {
      ok: false,
      error:
        "Encontré la columna, pero no pude calcular edades válidas con la muestra actual.",
      used: { ageCol, birthCol, sampleLimit: lim },
    };
  }

  const avg = ages.reduce((acc, n) => acc + n, 0) / ages.length;
  return {
    ok: true,
    averageAge: Number(avg.toFixed(1)),
    sampleSize: ages.length,
    used: { ageCol, birthCol, scanned: target, totalCustomers: total },
    note: total > MAX_EXACT ? `Promedio calculado sobre los primeros ${MAX_EXACT} registros por performance.` : undefined,
  };
}

export async function contarClientesWorkspace(supabase: SupabaseClient) {
  // Preferir RPC (si existe). Fallback a count exact head.
  try {
    const { data, error } = await supabase.rpc('ws_count_customers');
    if (!error && Array.isArray(data) && typeof data[0]?.count === 'number') {
      return { ok: true, count: data[0].count };
    }
  } catch {
    // ignore
  }

  const { count, error } = await supabase
    .from(DATABASE.TABLES.WS_CUSTOMERS_2)
    .select('id', { count: 'exact', head: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, count: count || 0 };
}

export function calcularRanking(
  datos: any[],
  columnaAgrupar: string,
  columnaMetrica: string,
  orden: 'ascendente' | 'descendente' = 'descendente',
  limite?: number // Lo hacemos opcional
) {
  if (!datos || datos.length === 0) return [];

  // 1. PROCESAMOS TODAS LAS FILAS SIN EXCEPCIÓN
  const acumulado = datos.reduce((acc: Record<string, number>, fila) => {
    const clave = String(fila[columnaAgrupar] || 'Otros').trim();
    const valor = typeof fila[columnaMetrica] === 'number' 
      ? fila[columnaMetrica] 
      : parseFloat(String(fila[columnaMetrica] || '0').replace(/[$,]/g, ''));
    
    acc[clave] = (acc[clave] || 0) + (isNaN(valor) ? 0 : valor);
    return acc;
  }, {});

  // 2. CONVERTIMOS A ARRAY Y ORDENAMOS
  let resultado = Object.entries(acumulado)
    .map(([valor, metrica]) => ({
      valor,
      metrica: Number(Number(metrica).toFixed(2)),
      columnaMetrica
    }))
    .sort((a, b) => orden === 'ascendente' ? a.metrica - b.metrica : b.metrica - a.metrica);

  // 3. SOLO LIMITAMOS SI LA IA LO PIDIÓ EXPLÍCITAMENTE
  // Si no, devolvemos todo el análisis
  if (limite) {
    return resultado.slice(0, limite);
  }

  return resultado; 
}
export function calcularParticipacionCategoria(datos: any[], colCat: string, valorObj: string, colMet: string) {
  let sumaObjetivo = 0, sumaTotal = 0;
  const target = valorObj.toLowerCase().trim();

  datos.forEach(fila => {
    const monto = limpiarNumero(fila[colMet]);
    if (String(fila[colCat] || '').toLowerCase().includes(target)) sumaObjetivo += monto;
    sumaTotal += monto;
  });

  return { valorObjetivo: valorObj, sumaObjetivo, sumaTotal, porcentaje: sumaTotal > 0 ? (sumaObjetivo / sumaTotal) * 100 : 0 };
}

/**
 * Calcula estadísticas descriptivas básicas sobre un array de datos.
 */
export function calcularEstadisticas(datos: any[], columna: string) {
  // Extraemos y limpiamos los valores asegurando que sean números
  const valores = datos
    .map(f => {
      const v = f[columna];
      const num = typeof v === 'number' ? v : parseFloat(String(v || '0').replace(/[$, ]/g, ''));
      return isNaN(num) ? null : num;
    })
    .filter((v): v is number => v !== null);

  if (valores.length === 0) {
    return { total: 0, media: 0, max: 0, min: 0, conteo: 0 };
  }

  const total = valores.reduce((acc, v) => acc + v, 0);
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const media = total / valores.length;

  return {
    total,
    media,
    max,
    min,
    conteo: valores.length
  };
}

/**
 * Analiza columnas no numéricas (categorías).
 * Útil para: "¿Cuál es el producto más común?" o "¿Cuántos tipos de pago hay?"
 */
export function calcularEstadisticasCategoricas(datos: any[], columna: string) {
  if (!datos || datos.length === 0) return { moda: null, unico: 0, frecuencias: {} };

  const conteo: Record<string, number> = {};
  
  datos.forEach(fila => {
    const valor = String(fila[columna] || 'Sin valor');
    conteo[valor] = (conteo[valor] || 0) + 1;
  });

  // Encontrar la moda (el valor que más se repite)
  const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
  const moda = ordenado[0];

  return {
    moda: { valor: moda[0], frecuencia: moda[1] },
    unicos: ordenado.length,
    totalRegistros: datos.length,
    // Devolvemos el Top 5 de frecuencias para la UI
    topFrecuencias: ordenado.slice(0, 5).map(([valor, metrica]) => ({ valor, metrica }))
  };
}