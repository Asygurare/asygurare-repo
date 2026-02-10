import { FunctionDeclaration, SchemaType } from "@google/generative-ai";

export const analysisTools: FunctionDeclaration[] = [
  {
    name: "calcularCorrelacion",
    description: "Calcula el coeficiente de correlación de Pearson entre dos columnas numéricas.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        columna1: { type: SchemaType.STRING, description: "Nombre de la primera columna numérica." },
        columna2: { type: SchemaType.STRING, description: "Nombre de la segunda columna numérica." },
      },
      required: ["columna1", "columna2"],
    },
  },
  {
    name: "encontrarOutliers",
    description: "Identifica valores atípicos o anomalías en una columna numérica específica.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        columna: { type: SchemaType.STRING, description: "Columna numérica a analizar." },
        metodo: { 
          type: SchemaType.STRING, 
          enum: ["zscore", "iqr"], 
          description: "Método estadístico para detectar outliers.",
          format: "enum" // <--- Aquí estaba el secreto: debe ser "enum"
        },
      },
      required: ["columna", "metodo"],
    },
  },
  {
    name: "calcularDistribucion",
    description: "Calcula la distribución de frecuencias (histograma) de una columna numérica.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        columna: { type: SchemaType.STRING, description: "Columna numérica." },
        bins: { type: SchemaType.NUMBER, description: "Número de intervalos para agrupar los datos." },
      },
      required: ["columna", "bins"],
    },
  },
  {
    name: "filtrarPorRango",
    description: "Filtra los registros dentro de un rango numérico.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        columna: { type: SchemaType.STRING, description: "Columna numérica a filtrar." },
        min: { type: SchemaType.NUMBER, description: "Valor mínimo." },
        max: { type: SchemaType.NUMBER, description: "Valor máximo." },
      },
      required: ["columna", "min", "max"],
    },
  },
  {
    name: "agruparPorMultiplesColumnas",
    description: "Agrupa datos por una o varias columnas y aplica una función de agregación.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        columnasAgrupar: { 
          type: SchemaType.ARRAY, 
          items: { type: SchemaType.STRING },
          description: "Lista de nombres de columnas para agrupar." 
        },
        columnaCalcular: { type: SchemaType.STRING, description: "Columna numérica." },
        metrica: { 
          type: SchemaType.STRING, 
          enum: ["suma", "promedio", "max", "min"], 
          description: "Operación matemática.",
          format: "enum" // <--- Corregido
        },
      },
      required: ["columnasAgrupar", "columnaCalcular", "metrica"],
    },
  },
  {
    name: "calcularRanking",
    description: "Genera un ranking (Top N) agrupando por categoría y sumando una métrica.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        columnaAgrupar: { type: SchemaType.STRING, description: "Columna categórica." },
        columnaMetrica: { type: SchemaType.STRING, description: "Columna numérica." },
        orden: { 
          type: SchemaType.STRING, 
          enum: ["ascendente", "descendente"], 
          description: "Orden del ranking.",
          format: "enum" // <--- Corregido
        },
        limite: { type: SchemaType.NUMBER, description: "Cantidad de registros (Top N)." },
      },
      required: ["columnaAgrupar", "columnaMetrica", "orden"],
    },
  },
  {
    name: "calcularEstadisticas",
    description: "Estadísticas descriptivas de una columna numérica.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        columna: { type: SchemaType.STRING, description: "Columna numérica a analizar." },
      },
      required: ["columna"],
    },
  },
  {
    name: "filtrarPorCondicion",
    description: "Filtra registros basados en una condición lógica.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        condicion: { type: SchemaType.STRING, description: "Descripción de la condición." },
      },
      required: ["condicion"],
    },
  },
  {
    name: "obtenerValoresUnicos",
    description: "Lista valores distintos de una columna.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        columna: { type: SchemaType.STRING, description: "Columna a consultar." },
      },
      required: ["columna"],
    },
  },
  {
    name: "calcularSumaTotal",
    description: "Suma todos los valores de una columna numérica.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        columna: { type: SchemaType.STRING, description: "Nombre de la columna." }
      },
      required: ["columna"]
    }
  },
  {
    name: "calcularEstadisticasCategoricas",
    description: "Calcula frecuencias y moda para una columna categórica.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        columna: { type: SchemaType.STRING, description: "Columna categórica a analizar." },
      },
      required: ["columna"],
    },
  },
  {
    name: "calcularParticipacionCategoria",
    description: "Calcula qué porcentaje representa un valor sobre el total de una métrica.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        columnaCategoria: { type: SchemaType.STRING, description: "Columna de categoría." },
        valorObjetivo: { type: SchemaType.STRING, description: "Valor específico (ej: 'Efectivo')." },
        columnaMetrica: { type: SchemaType.STRING, description: "Columna numérica (ej: 'Total')." },
      },
      required: ["columnaCategoria", "valorObjetivo", "columnaMetrica"],
    },
  }
];
