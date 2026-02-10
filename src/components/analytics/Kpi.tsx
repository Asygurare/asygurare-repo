"use client";

import React from "react";

export type KpiItem = {
  id: string;
  label: string;
  value: React.ReactNode;
  helper?: string;
  variant?: "default" | "dark" | "accent";
};

export function Kpi({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {items.map((k) => {
        const base =
          k.variant === "dark"
            ? "bg-black text-white"
            : k.variant === "accent"
              ? "bg-(--accents) text-black"
              : "bg-white text-black border border-black/5";

        const helperTone =
          k.variant === "dark" ? "text-white/70" : k.variant === "accent" ? "text-black/60" : "text-black/50";

        const labelTone =
          k.variant === "dark" ? "text-white/60" : k.variant === "accent" ? "text-black/60" : "text-gray-400";

        return (
          <div key={k.id} className={`p-8 rounded-[2.5rem] shadow-sm ${base}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest ${labelTone}`}>{k.label}</p>
            <div className="mt-2 text-4xl font-black tracking-tighter">{k.value}</div>
            {k.helper ? <p className={`mt-2 text-xs font-bold ${helperTone}`}>{k.helper}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

