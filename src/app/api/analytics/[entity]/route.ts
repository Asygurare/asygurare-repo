import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/src/lib/supabase/server";
import type { AnalyticsEntity, AnalyticsResponse } from "@/src/services/analytics/types";
import { buildCharts, getEntityTable } from "@/src/services/analytics/buildCharts";
import { buildKpis } from "@/src/services/analytics/buildKpis";

function isEntity(x: string): x is AnalyticsEntity {
  return x === "prospectos" || x === "clientes" || x === "polizas";
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ entity: string }> }
) {
  const supabase = await createServerClient();
  const { entity } = await ctx.params;

  if (!isEntity(entity)) {
    return NextResponse.json({ error: "Entidad inválida" }, { status: 400 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const table = getEntityTable(entity);
  const selectByEntity: Record<AnalyticsEntity, string> = {
    prospectos:
      "id,user_id,gender,state,city,age,birthday,status,stage,source,insurance_type,marital_status,smoking,drinking,estimated_value,additional_fields,created_at,updated_at",
    clientes:
      "id,user_id,gender,age,birthday,status,source,insurance_type,marital_status,ocupation,smoking,drinking,estimated_value,created_at,updated_at",
    polizas: "id,user_id,customer_id,category,insurance_company,expiry_date,total_premium,created_at,updated_at",
  };

  const { data, error } = await supabase
    .from(table)
    .select(selectByEntity[entity])
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response: AnalyticsResponse = {
    entity,
    generated_at: new Date().toISOString(),
    kpis: buildKpis(entity, (data as any[]) || []),
    charts: buildCharts(entity, (data as any[]) || []),
  };

  return NextResponse.json(response, {
    headers: {
      // Always fresh: charts should reflect realtime refetch
      "Cache-Control": "no-store",
    },
  });
}

