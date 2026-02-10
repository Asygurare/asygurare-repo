import { DATABASE } from "@/src/config";
import type { AnalyticsChart, AnalyticsEntity } from "./types";
import { ageBuckets, groupCount, groupCountByGetter, safeNumber, topN } from "./aggregate";

function fmtAvgAge(avg: number | null) {
  if (avg == null) return undefined;
  return `Edad promedio: ${avg.toFixed(1)}`;
}

function yn(v: unknown) {
  if (v === true) return "Sí";
  if (v === false) return "No";
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "yes" || s === "si" || s === "sí") return "Sí";
  if (s === "no") return "No";
  return "Sin dato";
}

function getAdditional(row: any) {
  const extra = row?.additional_fields;
  return extra && typeof extra === "object" ? extra : null;
}

export function getEntityTable(entity: AnalyticsEntity) {
  switch (entity) {
    case "prospectos":
      return DATABASE.TABLES.WS_LEADS;
    case "clientes":
      return DATABASE.TABLES.WS_CUSTOMERS_2;
    case "polizas":
      return DATABASE.TABLES.WS_POLICIES;
  }
}

export function buildCharts(entity: AnalyticsEntity, rows: any[]): AnalyticsChart[] {
  const r = rows || [];

  if (entity === "prospectos") {
    const { points: agePoints, avg } = ageBuckets(r);

    const charts: AnalyticsChart[] = [
      { id: "gender", title: "Género", kind: "pie", data: groupCount(r, "gender") },
      { id: "state", title: "Por estado (Top 10)", kind: "bar", data: topN(groupCount(r, "state"), 10) },
      { id: "city", title: "Por ciudad (Top 10)", kind: "bar", data: topN(groupCount(r, "city"), 10) },
      { id: "age", title: "Rangos de edad", kind: "bar", data: agePoints, subtitle: fmtAvgAge(avg) },

      // Campos directos (tabla WS_LEADS)
      { id: "status", title: "Estatus", kind: "bar", data: topN(groupCount(r, "status"), 10) },
      { id: "stage", title: "Etapa", kind: "bar", data: topN(groupCount(r, "stage"), 10) },
      { id: "source", title: "Origen", kind: "bar", data: topN(groupCount(r, "source"), 10) },
      { id: "insurance_type", title: "Tipo de seguro", kind: "bar", data: topN(groupCount(r, "insurance_type"), 10) },
      { id: "marital_status", title: "Estado civil", kind: "bar", data: topN(groupCount(r, "marital_status"), 10) },

      // Triage bools
      { id: "smoking", title: "¿Fuman?", kind: "pie", data: groupCountByGetter(r, (row) => yn(row?.smoking)) },
      { id: "drinking", title: "¿Toman?", kind: "pie", data: groupCountByGetter(r, (row) => yn(row?.drinking)) },

      // JSONB: WS_LEADS.additional_fields
      {
        id: "education_level",
        title: "Escolaridad",
        kind: "bar",
        data: topN(groupCountByGetter(r, (row) => getAdditional(row)?.education_level), 10),
      },
      {
        id: "sector",
        title: "Sector",
        kind: "bar",
        data: topN(groupCountByGetter(r, (row) => getAdditional(row)?.sector), 10),
      },
      {
        id: "has_children",
        title: "¿Tiene hijos?",
        kind: "pie",
        data: groupCountByGetter(r, (row) => yn(getAdditional(row)?.has_children)),
      },
      {
        id: "currency",
        title: "Moneda",
        kind: "pie",
        data: groupCountByGetter(r, (row) => getAdditional(row)?.currency),
      },
    ];

    return charts.filter((c) => c.data.length > 0);
  }

  if (entity === "clientes") {
    const { points: agePoints, avg } = ageBuckets(r);
    const charts: AnalyticsChart[] = [
      { id: "gender", title: "Género", kind: "pie", data: groupCount(r, "gender") },
      { id: "status", title: "Estatus", kind: "bar", data: topN(groupCount(r, "status"), 10) },
      { id: "source", title: "Origen", kind: "bar", data: topN(groupCount(r, "source"), 10) },
      { id: "insurance_type", title: "Tipo de seguro", kind: "bar", data: topN(groupCount(r, "insurance_type"), 10) },
      { id: "marital_status", title: "Estado civil", kind: "bar", data: topN(groupCount(r, "marital_status"), 10) },
      { id: "ocupation", title: "Ocupación (Top 10)", kind: "bar", data: topN(groupCount(r, "ocupation"), 10) },
      { id: "smoking", title: "¿Fuman?", kind: "pie", data: groupCountByGetter(r, (row) => yn(row?.smoking)) },
      { id: "drinking", title: "¿Toman?", kind: "pie", data: groupCountByGetter(r, (row) => yn(row?.drinking)) },
      { id: "age", title: "Rangos de edad", kind: "bar", data: agePoints, subtitle: fmtAvgAge(avg) },
    ];

    return charts.filter((c) => c.data.length > 0);
  }

  // polizas
  const byCategory = topN(groupCount(r, "category"), 10);
  const byCompany = topN(groupCount(r, "insurance_company"), 10);

  const expiring30d = (() => {
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const points = r
      .filter((p: any) => !!p?.expiry_date)
      .map((p: any) => {
        const ms = new Date(p.expiry_date).getTime();
        return Number.isNaN(ms) ? null : ms;
      })
      .filter((ms: number | null): ms is number => ms != null)
      .filter((ms: number) => ms > now && ms < now + thirtyDays);
    return points.length;
  })();

  const totalPremium = r.reduce((acc: number, p: any) => acc + (safeNumber(p?.total_premium) ?? 0), 0);

  const charts: AnalyticsChart[] = [
    { id: "category", title: "Categoría (Top 10)", kind: "bar", data: byCategory },
    { id: "company", title: "Aseguradora (Top 10)", kind: "bar", data: byCompany },
    {
      id: "portfolio",
      title: "Cartera (snapshot)",
      kind: "bar",
      data: [
        { name: "Pólizas", value: r.length },
        { name: "Por vencer (30d)", value: expiring30d },
        { name: "Prima total", value: Math.round(totalPremium) },
      ],
    },
  ];

  return charts.filter((c) => c.data.length > 0);
}

