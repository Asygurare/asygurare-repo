import type { ChartPoint } from "./types";

const UNKNOWN = "Sin dato";

function normLabel(value: unknown) {
  const s = String(value ?? "").trim();
  return s ? s : UNKNOWN;
}

export function topN(points: ChartPoint[], n: number) {
  return points.slice().sort((a, b) => b.value - a.value).slice(0, n);
}

export function groupCount(rows: any[], key: string): ChartPoint[] {
  const acc = new Map<string, number>();
  for (const r of rows || []) {
    const label = normLabel(r?.[key]);
    acc.set(label, (acc.get(label) ?? 0) + 1);
  }
  return Array.from(acc.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function groupCountByGetter(rows: any[], getKey: (row: any) => unknown): ChartPoint[] {
  const acc = new Map<string, number>();
  for (const r of rows || []) {
    const label = normLabel(getKey(r));
    acc.set(label, (acc.get(label) ?? 0) + 1);
  }
  return Array.from(acc.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function safeNumber(n: unknown): number | null {
  if (typeof n === "number") return Number.isFinite(n) ? n : null;
  const parsed = parseFloat(String(n ?? "").replace(/[$, ]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function computeAgeFromBirthday(birthdayISO: unknown): number | null {
  const s = String(birthdayISO ?? "").trim();
  if (!s) return null;
  const b = new Date(`${s}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

export function getAge(row: any): number | null {
  const fromAge = safeNumber(row?.age);
  if (fromAge != null && fromAge >= 0 && fromAge <= 120) return Math.round(fromAge);
  return computeAgeFromBirthday(row?.birthday);
}

export function ageBucket(age: number | null): string {
  if (age == null) return UNKNOWN;
  if (age < 18) return "<18";
  if (age <= 24) return "18-24";
  if (age <= 34) return "25-34";
  if (age <= 44) return "35-44";
  if (age <= 54) return "45-54";
  if (age <= 64) return "55-64";
  return "65+";
}

export function ageBuckets(rows: any[]): { points: ChartPoint[]; avg: number | null } {
  const ages: number[] = [];
  const points = groupCountByGetter(rows, (r) => {
    const age = getAge(r);
    if (age != null) ages.push(age);
    return ageBucket(age);
  });
  const avg = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null;
  // Keep a consistent bucket order for nicer charts
  const order = ["<18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+", UNKNOWN];
  const byName = new Map(points.map((p) => [p.name, p.value] as const));
  const ordered = order
    .filter((name) => byName.has(name))
    .map((name) => ({ name, value: byName.get(name)! }));
  return { points: ordered, avg };
}

