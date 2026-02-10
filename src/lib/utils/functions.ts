import { SupabaseClient } from '@supabase/supabase-js';

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