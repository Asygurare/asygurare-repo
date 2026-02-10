export interface DataResponse {
    tipo: 'insight' | 'error' | 'texto';
    titulo?: string;
    valorPrincipal?: string | number;
    subtitulo?: string;
    datosAdicionales?: Array<{ etiqueta: string; valor: string | number }>;
    sugerencia?: string;
  }
