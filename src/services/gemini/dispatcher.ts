import { SupabaseClient } from '@supabase/supabase-js';
import * as analysis from '@/src/lib/utils/functions';

type ToolContext = {
  supabase: SupabaseClient;
  archivoId?: string;
  userId?: string;
  conversationId?: string;
  tz?: string;
  nowIso?: string;
};

export async function executeAnalysis(
  name: string,
  args: any,
  ctx: ToolContext
) {
  

  // 1. Obtenemos los datos (Aprovechando el cache de functions.ts)
  const { supabase, archivoId } = ctx;
  const datos = archivoId ? await analysis.obtenerDatosConCache(supabase, archivoId) : null;

  let raw: any;
  let isWorkspaceTool = false;

  // 2. El Switch Maestro: Mapeo de la IA a tu Código Local
  switch (name) {
    // -------------------------
    // Workspace tools (RAG/queries)
    // -------------------------
    case "describirTabla": {
      raw = await analysis.describirTablaWorkspace(supabase, { table: String(args?.table || '') });
      isWorkspaceTool = true;
      break;
    }

    case "listarClientes": {
      raw = await analysis.listarClientesWorkspace(supabase, { limit: args?.limit });
      isWorkspaceTool = true;
      break;
    }

    case "calcularEdadPromedioClientes": {
      raw = await analysis.calcularEdadPromedioClientesWorkspace(supabase, { sampleLimit: args?.sampleLimit });
      isWorkspaceTool = true;
      break;
    }

    case "contarClientes": {
      raw = await analysis.contarClientesWorkspace(supabase);
      isWorkspaceTool = true;
      break;
    }

    case "consultarTabla": {
      raw = await analysis.consultarTablaWorkspace(supabase, {
        table: String(args?.table || ''),
        select: args?.select,
        filters: args?.filters,
        orderBy: args?.orderBy,
        orderDir: args?.orderDir,
        limit: args?.limit,
      });
      isWorkspaceTool = true;
      break;
    }

    case "contarRegistros": {
      raw = await analysis.contarRegistrosWorkspace(supabase, {
        table: String(args?.table || ''),
        filters: args?.filters,
      });
      isWorkspaceTool = true;
      break;
    }

    case "obtenerContextoOperativo": {
      const tz = typeof args?.tz === 'string' && args.tz.trim() ? args.tz.trim() : (ctx.tz || 'America/Mexico_City');
      const nowIso = typeof args?.nowIso === 'string' && args.nowIso.trim() ? args.nowIso.trim() : (ctx.nowIso || new Date().toISOString());
      raw = await analysis.obtenerContextoOperativoWorkspaceConCache(supabase, { tz, nowIso });
      isWorkspaceTool = true;
      break;
    }

    case "buscarProspectos": {
      const query = String(args?.query || '').trim();
      const limit = Number(args?.limit || 6);
      raw = await analysis.buscarProspectosWorkspace(supabase, { query, limit });
      isWorkspaceTool = true;
      break;
    }

    case "buscarClientes": {
      const query = String(args?.query || '').trim();
      const limit = Number(args?.limit || 6);
      raw = await analysis.buscarClientesWorkspace(supabase, { query, limit });
      isWorkspaceTool = true;
      break;
    }

    case "buscarPolizas": {
      const query = String(args?.query || '').trim();
      const limit = Number(args?.limit || 6);
      raw = await analysis.buscarPolizasWorkspace(supabase, { query, limit });
      isWorkspaceTool = true;
      break;
    }

    // -------------------------
    // Analysis tools (archivoId requerido)
    // -------------------------
    case "calcularRanking":
      if (!datos) throw new Error('Falta archivoId para ejecutar herramientas de análisis.');
      raw = analysis.calcularRanking(
        datos, 
        args.columnaAgrupar, 
        args.columnaMetrica, 
        args.orden || 'descendente', 
        args.limite || 10
      );
      break;
      case "agruparPorMultiplesColumnas":
    if (!datos) throw new Error('Falta archivoId para ejecutar herramientas de análisis.');
    // Si no tienes esta función exacta, usa calcularRanking como fallback 
    // o mapea la lógica de agrupación múltiple.
    raw = analysis.calcularRanking(
        datos, 
        args.columnasAgrupar[0], // Usamos la primera columna del array
        args.columnaCalcular, 
        'descendente'
    );
    break;

    case "filtrarPorCondicion": {
      if (!datos) throw new Error('Falta archivoId para ejecutar herramientas de análisis.');
      const { condicion, columnaMetrica } = args;
      // La IA suele enviar condiciones como "Sales > 1000" o "Category es Furniture"
      // Vamos a intentar parsear la intención o buscar palabras clave
      
      let filtrados = [];
      
      // Ejemplo de lógica flexible para segmentación
      if (condicion.includes('>') || condicion.includes('mayor')) {
          const valorReferencia = parseFloat(condicion.replace(/[^0-9.]/g, ''));
          const col = args.columna || columnaMetrica;
          filtrados = datos.filter((f: any) => parseFloat(f[col]) > valorReferencia);
      } 
      else if (condicion.includes('<') || condicion.includes('menor')) {
          const valorReferencia = parseFloat(condicion.replace(/[^0-9.]/g, ''));
          const col = args.columna || columnaMetrica;
          filtrados = datos.filter((f: any) => parseFloat(f[col]) < valorReferencia);
      }
      else {
          // Filtro por texto (Ej: "Segmento es Corporate")
          const col = args.columna || "Segment"; // Fallback si la IA no especifica columna
          const valorBusqueda = condicion.split(/es|en|igual a/i).pop()?.trim().toLowerCase();
          filtrados = datos.filter((f: any) => 
              String(f[col] || '').toLowerCase().includes(valorBusqueda || '')
          );
      }
  
      // Para que sea un insight útil, devolvemos un resumen del segmento
      raw = {
          valor: `Segmento: ${condicion}`,
          total: filtrados.reduce((acc: number, f: any) => acc + (Number(f[columnaMetrica]) || 0), 0),
          conteo: filtrados.length,
          columna: columnaMetrica
      };
      break;
  }

    case "calcularCorrelacion": {
      if (!datos) throw new Error('Falta archivoId para ejecutar herramientas de análisis.');
      const { columna1, columna2 } = args;
  
      // 1. Definimos la interfaz para los pares de datos
      interface DataPair {
          x: number;
          y: number;
      }
      
      // 2. Extraer y limpiar pares de datos (añadimos tipo al map y filter)
      const pares: DataPair[] = datos
          .map((f: any): DataPair => ({
              x: parseFloat(String(f[columna1] || '0').replace(/[$,]/g, '')),
              y: parseFloat(String(f[columna2] || '0').replace(/[$,]/g, ''))
          }))
          .filter((p: DataPair) => !isNaN(p.x) && !isNaN(p.y));
  
      if (pares.length < 2) { 
          raw = []; 
          break; 
      }
  
      // 3. Cálculo de Pearson con Tipado Estricto
      const n = pares.length;
      const sumX = pares.reduce((acc: number, val: DataPair) => acc + val.x, 0);
      const sumY = pares.reduce((acc: number, val: DataPair) => acc + val.y, 0);
      const sumXY = pares.reduce((acc: number, val: DataPair) => acc + (val.x * val.y), 0);
      const sumX2 = pares.reduce((acc: number, val: DataPair) => acc + (val.x * val.x), 0);
      const sumY2 = pares.reduce((acc: number, val: DataPair) => acc + (val.y * val.y), 0);
  
      const numerador = (n * sumXY) - (sumX * sumY);
      const denominador = Math.sqrt(((n * sumX2) - (sumX ** 2)) * ((n * sumY2) - (sumY ** 2)));
      
      const r = denominador === 0 ? 0 : numerador / denominador;
  
      raw = [{
          valor: `Correlación: ${columna1} vs ${columna2}`,
          metrica: Number(r.toFixed(4)),
          columnaMetrica: 'Coeficiente R de Pearson'
      }];
      break;
  }

    case "encontrarOutliers": {
      if (!datos) throw new Error('Falta archivoId para ejecutar herramientas de análisis.');
      const { columna } = args;
      // 1. Limpiar y obtener solo números de la columna
      const valores = datos
          .map((f: any) => parseFloat(String(f[columna] || '0').replace(/[$,]/g, '')))
          .filter((v: number) => !isNaN(v))
          .sort((a: number, b:number) => a - b);
  
      if (valores.length < 4) {
          raw = []; 
          break;
      }
  
      // 2. Lógica IQR (Rango Intercuartílico)
      const q1 = valores[Math.floor(valores.length * 0.25)];
      const q3 = valores[Math.floor(valores.length * 0.75)];
      const iqr = q3 - q1;
      const limiteInferior = q1 - 1.5 * iqr;
      const limiteSuperior = q3 + 1.5 * iqr;
  
      // 3. Filtrar los datos originales que son outliers
      raw = datos
          .filter((f: any) => {
              const v = parseFloat(String(f[columna] || '0').replace(/[$,]/g, ''));
              return v < limiteInferior || v > limiteSuperior;
          })
          .map((f: any) => ({
              valor: `ID: ${f.id || 'Ref'} - Outlier`, 
              metrica: parseFloat(String(f[columna] || '0').replace(/[$,]/g, '')),
              columnaMetrica: columna
          }))
          .slice(0, 10); // Solo mostramos los 10 más críticos
      break;
  }


    case "calcularParticipacionCategoria":
      if (!datos) throw new Error('Falta archivoId para ejecutar herramientas de análisis.');
      raw = analysis.calcularParticipacionCategoria(
        datos,
        args.columnaCategoria,
        args.valorObjetivo,
        args.columnaMetrica
      );
      break;

    case "calcularSumaTotal":
      if (!datos) throw new Error('Falta archivoId para ejecutar herramientas de análisis.');
      raw = { 
        total: datos.reduce((acc: number, f: any) => acc + (Number(f[args.columna]) || 0), 0),
        columna: args.columna 
      };
      break;

    case "calcularEstadisticas":
      // ESTA ERA LA QUE FALTABA
      if (!datos) throw new Error('Falta archivoId para ejecutar herramientas de análisis.');
      raw = analysis.calcularEstadisticas(datos, args.columna);
      break;

    case "obtenerValoresUnicos":
      if (!datos) throw new Error('Falta archivoId para ejecutar herramientas de análisis.');
      raw = {
        lista: [...new Set(datos.map((f: any) => f[args.columna]))].filter(Boolean),
        columna: args.columna
      };
      break;

    case "calcularEstadisticasCategoricas":
      if (!datos) throw new Error('Falta archivoId para ejecutar herramientas de análisis.');
      raw = analysis.calcularEstadisticasCategoricas(datos, args.columna);
      break;

    default:
      throw new Error(`La función técnica ${name} no ha sido vinculada en el servidor.`);
  }

  // Workspace tools: devolvemos el resultado tal cual (sin normalizar para UI analítica).
  if (isWorkspaceTool) return raw;

  // 3. NORMALIZACIÓN PARA LA UI (ResultadoData.tsx)
  return normalizarParaUI(raw, args, name);
}

function normalizarParaUI(raw: any, args: any, name: string) {
  // Caso 1: Array de resultados (Ranking, Listas)
  if (Array.isArray(raw)) {
    return raw.map((item, i) => ({
      valor: item.valor || "Otros",
      metrica: item.metrica || 0,
      ranking: i + 1,
      columnaMetrica: args.columnaMetrica || args.columna || "Valor"
    }));
  }

  // Caso 2: Estadísticas Descriptivas (Media, Max, Min)
  if (raw.media !== undefined) {
    return {
      valor: `Promedio de ${args.columna}`,
      metrica: raw.media,
      columnaMetrica: "Promedio",
      detalles: [
        { etiqueta: "Máximo", valor: raw.max },
        { etiqueta: "Mínimo", valor: raw.min },
        { etiqueta: "Total Sumado", valor: raw.total }
      ]
    };
  }

  if (raw.conteo !== undefined) {
    return {
      valor: raw.valor,
      metrica: raw.total,
      columnaMetrica: args.columnaMetrica || "Total Segmento",
      detalles: [
        { etiqueta: "Registros encontrados", valor: raw.conteo },
        { etiqueta: "Condición aplicada", valor: args.condicion }
      ]
    };
  }

  // Caso 3: Participación o Objetos Únicos
  return {
    valor: raw.valorObjetivo || raw.columna || "Resultado",
    metrica: raw.sumaObjetivo !== undefined ? raw.sumaObjetivo : (raw.total || 0),
    porcentaje: raw.porcentaje,
    columnaMetrica: args.columnaMetrica || args.columna || "Monto"
  };
  // ... dentro de normalizarParaUI

// Si es el resultado de calcularSumaTotal (objeto simple con 'total')
if (raw.total !== undefined && raw.conteo === undefined && raw.media === undefined) {
  return {
    valor: `Total de ${raw.columna || args.columna}`,
    metrica: raw.total,
    columnaMetrica: "Suma Total"
  };
}
}
