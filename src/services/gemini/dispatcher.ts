import { SupabaseClient } from '@supabase/supabase-js';
import * as analysis from '@/src/lib/utils/functions';

export async function executeAnalysis(
  name: string, 
  args: any, 
  supabase: SupabaseClient, 
  archivoId: string
) {
  

  // 1. Obtenemos los datos (Aprovechando el cache de functions.ts)
  const datos = await analysis.obtenerDatosConCache(supabase, archivoId);

  let raw: any;

  // 2. El Switch Maestro: Mapeo de la IA a tu Código Local
  switch (name) {
    case "calcularRanking":
      raw = analysis.calcularRanking(
        datos, 
        args.columnaAgrupar, 
        args.columnaMetrica, 
        args.orden || 'descendente', 
        args.limite || 10
      );
      break;
      case "agruparPorMultiplesColumnas":
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
      raw = analysis.calcularParticipacionCategoria(
        datos,
        args.columnaCategoria,
        args.valorObjetivo,
        args.columnaMetrica
      );
      break;

    case "calcularSumaTotal":
      raw = { 
        total: datos.reduce((acc: number, f: any) => acc + (Number(f[args.columna]) || 0), 0),
        columna: args.columna 
      };
      break;

    case "calcularEstadisticas":
      // ESTA ERA LA QUE FALTABA
      raw = analysis.calcularEstadisticas(datos, args.columna);
      break;

    case "obtenerValoresUnicos":
      raw = {
        lista: [...new Set(datos.map((f: any) => f[args.columna]))].filter(Boolean),
        columna: args.columna
      };
      break;

    case "calcularEstadisticasCategoricas":
      raw = analysis.calcularEstadisticasCategoricas(datos, args.columna);
      break;

    default:
      throw new Error(`La función técnica ${name} no ha sido vinculada en el servidor.`);
  }

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
