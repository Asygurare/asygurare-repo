"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseClient } from "@/src/lib/supabase/client";
import { DATABASE } from "@/src/config";
import type { AnalyticsEntity, AnalyticsResponse } from "@/src/services/analytics/types";

function entityToTable(entity: AnalyticsEntity) {
  switch (entity) {
    case "prospectos":
      return DATABASE.TABLES.WS_LEADS;
    case "clientes":
      return DATABASE.TABLES.WS_CUSTOMERS_2;
    case "polizas":
      return DATABASE.TABLES.WS_POLICIES;
  }
}

export function useRealtimeAnalytics(entity: AnalyticsEntity) {
  const [loading, setLoading] = useState(true);
  const [charts, setCharts] = useState<AnalyticsResponse["charts"]>([]);
  const [kpis, setKpis] = useState<AnalyticsResponse["kpis"]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const refetchTimerRef = useRef<number | null>(null);

  const endpoint = useMemo(() => `/api/analytics/${entity}`, [entity]);

  const fetchCharts = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const json = (await res.json()) as any;
      if (!res.ok) {
        setCharts([]);
        setKpis([]);
        setGeneratedAt(null);
        setError(json?.error ? String(json.error) : "Error al cargar analytics");
        return;
      }
      const parsed = json as AnalyticsResponse;
      setCharts(parsed.charts || []);
      setKpis(parsed.kpis || []);
      setGeneratedAt(parsed.generated_at || null);
    } catch (e: any) {
      setError(String(e?.message || e || "Error desconocido"));
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current != null) window.clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = window.setTimeout(() => {
      fetchCharts();
    }, 450);
  }, [fetchCharts]);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  useEffect(() => {
    let channel: any;
    let mounted = true;

    (async () => {
      const { data } = await supabaseClient.auth.getUser();
      const userId = data?.user?.id ?? null;
      userIdRef.current = userId;

      const table = entityToTable(entity);
      channel = supabaseClient
        .channel(`analytics-${entity}-${userId ?? "anon"}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            ...(userId ? { filter: `user_id=eq.${userId}` } : {}),
          },
          () => {
            if (!mounted) return;
            scheduleRefetch();
          }
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (refetchTimerRef.current != null) window.clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = null;
      try {
        if (channel) supabaseClient.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [entity, scheduleRefetch]);

  return { loading, charts, kpis, generatedAt, error, refetch: fetchCharts };
}

