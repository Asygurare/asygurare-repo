export type AnalyticsEntity = "prospectos" | "clientes" | "polizas";

export type ChartKind = "bar" | "pie";

export type KpiFormat = "count" | "currency" | "percent" | "number";

export type AnalyticsKpi = {
  id: string;
  label: string;
  value: number;
  format: KpiFormat;
  helper?: string;
  /**
   * Purely presentational hint for the UI.
   */
  variant?: "default" | "dark" | "accent";
};

export type ChartPoint = {
  name: string;
  value: number;
};

export type AnalyticsChart = {
  id: string;
  title: string;
  kind: ChartKind;
  /**
   * Recharts-friendly array.
   * - BarChart: X axis => name, Bar dataKey => value
   * - PieChart: name/value pairs
   */
  data: ChartPoint[];
  /**
   * Optional helper text for the UI (ex: "Edad promedio: 34.2").
   */
  subtitle?: string;
};

export type AnalyticsResponse = {
  entity: AnalyticsEntity;
  generated_at: string;
  kpis: AnalyticsKpi[];
  charts: AnalyticsChart[];
};

