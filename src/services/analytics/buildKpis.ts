import type { AnalyticsEntity, AnalyticsKpi } from "./types";
import { getAge, safeNumber } from "./aggregate";

function avg(values: number[]) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function countWhere(rows: any[], predicate: (row: any) => boolean) {
  return (rows || []).reduce((acc, r) => (predicate(r) ? acc + 1 : acc), 0);
}

function sumWhere(rows: any[], getter: (row: any) => number) {
  return (rows || []).reduce((acc, r) => acc + getter(r), 0);
}

function normLower(x: unknown) {
  return String(x ?? "").trim().toLowerCase();
}

export function buildKpis(entity: AnalyticsEntity, rows: any[]): AnalyticsKpi[] {
  const r = rows || [];

  if (entity === "prospectos") {
    const total = r.length;
    const nuevos = countWhere(r, (x) => normLower(x?.status) === "nuevo");
    const enSeguimiento = countWhere(r, (x) => normLower(x?.status) === "en seguimiento");

    const estimated = sumWhere(r, (x) => safeNumber(x?.estimated_value) ?? 0);

    const ages: number[] = [];
    for (const row of r) {
      const a = getAge(row);
      if (a != null) ages.push(a);
    }
    const avgAge = avg(ages);

    return [
      { id: "total", label: "Prospectos", value: total, format: "count", helper: "Total en pipeline", variant: "default" },
      {
        id: "seguimiento",
        label: "En seguimiento",
        value: enSeguimiento,
        format: "count",
        helper: nuevos ? `${nuevos} nuevos` : undefined,
        variant: "dark",
      },
      {
        id: "valor",
        label: "Valor estimado",
        value: Math.round(estimated),
        format: "currency",
        helper: avgAge != null ? `Edad prom: ${avgAge.toFixed(1)}` : undefined,
        variant: "default",
      },
    ];
  }

  if (entity === "clientes") {
    const total = r.length;
    const activos = countWhere(r, (x) => normLower(x?.status) === "activo");
    const value = sumWhere(r, (x) => safeNumber(x?.estimated_value) ?? 0);

    const ages: number[] = [];
    for (const row of r) {
      const a = getAge(row);
      if (a != null) ages.push(a);
    }
    const avgAge = avg(ages);

    const activeRate = total ? (activos / total) * 100 : 0;

    return [
      { id: "total", label: "Clientes", value: total, format: "count", helper: "Cartera maestra", variant: "default" },
      {
        id: "activos",
        label: "Activos",
        value: activos,
        format: "count",
        helper: total ? `${activeRate.toFixed(1)}% de la cartera` : undefined,
        variant: "dark",
      },
      {
        id: "valor",
        label: "Valor estimado",
        value: Math.round(value),
        format: "currency",
        helper: avgAge != null ? `Edad prom: ${avgAge.toFixed(1)}` : undefined,
        variant: "default",
      },
    ];
  }

  // polizas
  const total = r.length;
  const uniqueCustomers = new Set(r.map((p: any) => p?.customer_id).filter(Boolean)).size;
  const avgPoliciesPerCustomer = uniqueCustomers ? total / uniqueCustomers : 0;

  const totalPremium = sumWhere(r, (p) => safeNumber(p?.total_premium) ?? 0);

  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const expiringSoon = r.filter((p: any) => {
    const ms = p?.expiry_date ? new Date(p.expiry_date).getTime() : NaN;
    return Number.isFinite(ms) && ms > now && ms < now + thirtyDays;
  });
  const expiringAmount = sumWhere(expiringSoon, (p) => safeNumber(p?.total_premium) ?? 0);

  return [
    { id: "total", label: "Pólizas", value: total, format: "count", helper: "Contratos activos", variant: "default" },
    {
      id: "cartera",
      label: "Prima total",
      value: Math.round(totalPremium),
      format: "currency",
      helper: uniqueCustomers ? `${avgPoliciesPerCustomer.toFixed(1)}x por cliente` : undefined,
      variant: "dark",
    },
    {
      id: "riesgo",
      label: "Renovaciones (30d)",
      value: Math.round(expiringAmount),
      format: "currency",
      helper: `${expiringSoon.length} por vencer`,
      variant: "default",
    },
  ];
}

