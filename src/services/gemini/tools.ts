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

// Tools orientadas al workspace (RAG + queries enfocadas).
// Nota: son READ-ONLY por seguridad (no modifican datos).
export const workspaceTools: FunctionDeclaration[] = [
  {
    name: "consultarTabla",
    description:
      "Consulta segura sobre tablas del workspace (clientes, leads, polizas, tareas). Permite filtros simples, orden y límite. Read-only.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        table: {
          type: SchemaType.STRING,
          description: "Tabla lógica: 'clientes' | 'leads' | 'polizas' | 'tareas'.",
        },
        select: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description:
            "Lista de columnas a devolver. Si se omite, se usan columnas recomendadas.",
        },
        filters: {
          type: SchemaType.ARRAY,
          description:
            "Filtros (AND). Cada filtro: { column, op, value }. op: eq|neq|ilike|gt|gte|lt|lte|isnull|notnull|in",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              column: { type: SchemaType.STRING },
              op: {
                type: SchemaType.STRING,
                enum: ["eq", "neq", "ilike", "gt", "gte", "lt", "lte", "isnull", "notnull", "in"],
                format: "enum",
              },
              value: { type: SchemaType.STRING, description: "Valor del filtro (string). Para 'in' usa CSV." },
            },
            required: ["column", "op"],
          },
        },
        orderBy: {
          type: SchemaType.STRING,
          description: "Columna para ordenar (si existe).",
        },
        orderDir: {
          type: SchemaType.STRING,
          enum: ["asc", "desc"],
          format: "enum",
          description: "Dirección de orden.",
        },
        limit: {
          type: SchemaType.NUMBER,
          description: "Máximo de filas (default 10, max 50).",
        },
      },
      required: ["table"],
    },
  },
  {
    name: "contarRegistros",
    description:
      "Cuenta registros en una tabla del workspace con filtros simples (read-only).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        table: {
          type: SchemaType.STRING,
          description: "Tabla lógica: 'clientes' | 'leads' | 'polizas' | 'tareas'.",
        },
        filters: {
          type: SchemaType.ARRAY,
          description:
            "Filtros (AND). Cada filtro: { column, op, value }. op: eq|neq|ilike|gt|gte|lt|lte|isnull|notnull|in",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              column: { type: SchemaType.STRING },
              op: {
                type: SchemaType.STRING,
                enum: ["eq", "neq", "ilike", "gt", "gte", "lt", "lte", "isnull", "notnull", "in"],
                format: "enum",
              },
              value: { type: SchemaType.STRING, description: "Valor del filtro (string). Para 'in' usa CSV." },
            },
            required: ["column", "op"],
          },
        },
      },
      required: ["table"],
    },
  },
  {
    name: "describirTabla",
    description:
      "Devuelve columnas detectadas de una tabla (por ejemplo clientes, leads, pólizas, tareas) a partir de una muestra mínima. Útil para entender estructura sin que el usuario conozca el backend.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        table: {
          type: SchemaType.STRING,
          description:
            "Nombre lógico de tabla: 'clientes' | 'leads' | 'polizas' | 'tareas'.",
        },
      },
      required: ["table"],
    },
  },
  {
    name: "listarClientes",
    description:
      "Lista clientes (últimos registrados por defecto) con campos clave. No requiere criterio de búsqueda.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: "Máximo de clientes." },
      },
      required: [],
    },
  },
  {
    name: "calcularEdadPromedioClientes",
    description:
      "Calcula la edad promedio de tus clientes usando WS_CUSTOMERS_2.age o WS_CUSTOMERS_2.birthday. No requiere que el usuario conozca columnas.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        sampleLimit: {
          type: SchemaType.NUMBER,
          description:
            "Cantidad de clientes a muestrear para el cálculo si no hay columna de edad directa (default 200).",
        },
      },
      required: [],
    },
  },
  {
    name: "contarClientes",
    description: "Devuelve el número total de clientes (count exact).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: "buscarProspectos",
    description:
      "Busca prospectos/leads por texto (nombre, teléfono, email, notas). Devuelve una lista corta con campos clave.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "Texto a buscar." },
        limit: { type: SchemaType.NUMBER, description: "Máximo de resultados." },
      },
      required: ["query"],
    },
  },
  {
    name: "buscarClientes",
    description:
      "Busca clientes por texto (nombre, teléfono, email). Devuelve una lista corta con campos clave.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "Texto a buscar." },
        limit: { type: SchemaType.NUMBER, description: "Máximo de resultados." },
      },
      required: ["query"],
    },
  },
  {
    name: "buscarPolizas",
    description:
      "Busca pólizas por texto (número de póliza, aseguradora, categoría/ramo). Devuelve una lista corta con campos clave.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "Texto a buscar." },
        limit: { type: SchemaType.NUMBER, description: "Máximo de resultados." },
      },
      required: ["query"],
    },
  },
  {
    name: "obtenerContextoOperativo",
    description:
      "Obtiene un snapshot compacto del estado operativo (tareas próximas, leads recientes, pólizas recientes y próximas a vencer).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tz: { type: SchemaType.STRING, description: "Timezone IANA del usuario." },
        nowIso: { type: SchemaType.STRING, description: "Fecha/hora actual en ISO." },
      },
      required: ["tz", "nowIso"],
    },
  },
];

export const allGeminiTools: FunctionDeclaration[] = [...workspaceTools, ...analysisTools];
