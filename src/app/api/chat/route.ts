import { DATABASE } from "@/src/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/src/lib/supabase/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

export async function POST(request: Request) {
    const supabase = await createServerClient();

    try {
        const requestData = await request.json();
        const { message, user_id, conversation_id, profile, client_now, client_tz } = requestData;

        if (!message) {
            return NextResponse.json({ error: "El mensaje es requerido" }, { status: 400 });
        }

        // --- 1. DATA EXTRACTION (EL CONTEXTO REAL) ---
        // Extraemos datos de TODAS las tablas para que la IA no improvise
        const tableEntries = Object.entries(DATABASE.TABLES);
        const allTablesData: Record<string, any[]> = {};
        const allTablesErrors: Record<string, string> = {};
        await Promise.all(
            tableEntries.map(async ([tableKey, tableName]) => {
                const { data, error } = await supabase.from(tableName).select('*');
                if (error) {
                    allTablesErrors[tableKey] = error.message;
                    allTablesData[tableKey] = [];
                    return;
                }
                allTablesData[tableKey] = (data as any[]) || [];
            })
        );

        // Mantenemos estas variables para el prompt actual
        const stats = allTablesData.WS_POLICIES;
        const leads = allTablesData.WS_LEADS;
        const customers = allTablesData.WS_CUSTOMERS_2;
        const tasks = allTablesData.WS_TASKS;
        const recentPolicies =
            (stats ?? [])
                .slice()
                .sort((a: any, b: any) => {
                    const at = a?.created_at ? new Date(a.created_at).getTime() : 0;
                    const bt = b?.created_at ? new Date(b.created_at).getTime() : 0;
                    return bt - at;
                })
                .slice(0, 3) ?? [];

        const upcomingTasks =
            (tasks ?? [])
                .filter((t: any) => String(t?.status || 'open') !== 'done')
                .slice()
                .sort((a: any, b: any) => {
                    const at = a?.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
                    const bt = b?.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
                    return at - bt;
                })
                .slice(0, 8) ?? [];

        const recentLeads =
            (leads ?? [])
                .slice()
                .sort((a: any, b: any) => {
                    const at = a?.updated_at ? new Date(a.updated_at).getTime() : 0;
                    const bt = b?.updated_at ? new Date(b.updated_at).getTime() : 0;
                    return bt - at;
                })
                .slice(0, 8) ?? [];

        const recentCustomers =
            (customers ?? [])
                .slice()
                .sort((a: any, b: any) => {
                    const at = a?.created_at ? new Date(a.created_at).getTime() : 0;
                    const bt = b?.created_at ? new Date(b.created_at).getTime() : 0;
                    return bt - at;
                })
                .slice(0, 8) ?? [];

        const policiesExpiringSoon =
            (stats ?? [])
                .filter((p: any) => !!p?.expiry_date)
                .slice()
                .sort((a: any, b: any) => {
                    const at = a?.expiry_date ? new Date(a.expiry_date).getTime() : Number.POSITIVE_INFINITY;
                    const bt = b?.expiry_date ? new Date(b.expiry_date).getTime() : Number.POSITIVE_INFINITY;
                    return at - bt;
                })
                .slice(0, 8) ?? [];

        // Fecha/hora actual (la IA NO la conoce si no se la damos)
        const tz =
            (typeof client_tz === 'string' && client_tz.trim()) ||
            (typeof profile?.timezone === 'string' && profile.timezone.trim()) ||
            (typeof profile?.time_zone === 'string' && profile.time_zone.trim()) ||
            'America/Mexico_City';

        const now = (() => {
            const d = typeof client_now === 'string' ? new Date(client_now) : new Date();
            return Number.isNaN(d.getTime()) ? new Date() : d;
        })();

        const nowMs = now.getTime();
        const weekHorizonMs = 7 * 24 * 60 * 60 * 1000;

        const safeDueMs = (row: any) => {
            const raw = row?.due_at;
            if (!raw) return null;
            const ms = new Date(raw).getTime();
            return Number.isNaN(ms) ? null : ms;
        };

        const tasksToday =
            (tasks ?? [])
                .filter((t: any) => String(t?.status || 'open') !== 'done')
                .filter((t: any) => {
                    const dueMs = safeDueMs(t);
                    if (dueMs == null) return false;
                    const dueKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dueMs));
                    const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
                    return dueKey === todayKey;
                })
                .slice()
                .sort((a: any, b: any) => (safeDueMs(a) ?? Number.POSITIVE_INFINITY) - (safeDueMs(b) ?? Number.POSITIVE_INFINITY))
                .slice(0, 8) ?? [];

        const tasksNext7Days =
            (tasks ?? [])
                .filter((t: any) => String(t?.status || 'open') !== 'done')
                .filter((t: any) => {
                    const dueMs = safeDueMs(t);
                    if (dueMs == null) return false;
                    return dueMs >= nowMs && dueMs < nowMs + weekHorizonMs;
                })
                .slice()
                .sort((a: any, b: any) => (safeDueMs(a) ?? Number.POSITIVE_INFINITY) - (safeDueMs(b) ?? Number.POSITIVE_INFINITY))
                .slice(0, 12) ?? [];

        // Incluimos todas las columnas de Leads/Clientes (pero con compactación para no reventar tokens)
        const collectColumns = (rows: any[], maxScan = 200) => {
            const set = new Set<string>();
            for (const r of (rows || []).slice(0, maxScan)) {
                if (r && typeof r === 'object') {
                    for (const k of Object.keys(r)) set.add(k);
                }
            }
            return Array.from(set).sort();
        };

        const safeJson = (value: any, maxChars = 9000) => {
            const seen = new WeakSet<object>();
            const json = JSON.stringify(
                value,
                (_k, v) => {
                    if (typeof v === 'string') {
                        return v.length > 500 ? `${v.slice(0, 500)}…(trunc)` : v;
                    }
                    if (Array.isArray(v)) {
                        return v.length > 50 ? [...v.slice(0, 50), `…(${v.length - 50} more)`] : v;
                    }
                    if (v && typeof v === 'object') {
                        if (seen.has(v)) return '[Circular]';
                        seen.add(v);
                    }
                    return v;
                },
                2
            );
            if (!json) return 'null';
            return json.length > maxChars ? `${json.slice(0, maxChars)}\n…(truncated ${json.length - maxChars} chars)` : json;
        };

        const leadsColumns = collectColumns(leads ?? []);
        const customersColumns = collectColumns(customers ?? []);
        const leadsRawContext = safeJson(recentLeads);
        const customersRawContext = safeJson(recentCustomers);

        const totalCartera = stats?.reduce((acc, p) => acc + (p.total_premium || 0), 0) || 0;
        const totalLeads = leads?.length || 0;
        const totalPolizas = stats?.length || 0;

        const iaNombre = "Gubot";
        
        // --- 2. SYSTEM PROMPT EVOLUCIONADO ---
        const systemPrompt = `
        Soy Gubot, tu Copiloto de Alto Rendimiento en TECHGUROS. No soy un chatbot, soy tu Director de Estrategia y Maestro en Riesgos.

        🕒 FECHA ACTUAL (REFERENCIA OPERATIVA):
        - Ahora: ${new Intl.DateTimeFormat('es-MX', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' }).format(now)}
        - TZ: ${tz}
        - ISO: ${now.toISOString()}
    
        📊 CONTEXTO ACTUAL DE LA AGENCIA (DATOS REALES):
        - Cartera Total: $${totalCartera.toLocaleString()}
        - Pólizas Activas: ${totalPolizas}
        - Prospectos (Leads) en Seguimiento: ${totalLeads}
        - Últimas Pólizas Emitidas: ${recentPolicies?.map(p => `${p.policy_number} (${p.insurance_company})`).join(', ') || 'Ninguna reciente'}

        🗓️ CALENDARIO (TAREAS HOY):
        ${tasksToday.length
            ? tasksToday
                .map((t: any) => `- ${t.due_at || 'sin fecha'} · ${t.kind || 'Otro'} · ${t.priority || 'Media'} · ${t.title || 'Sin título'}${t.entity_type && t.entity_id ? ` · ${t.entity_type}:${t.entity_id}` : ''}`)
                .join('\n')
            : '- No hay tareas para HOY en el radar'}

        🗓️ CALENDARIO (PRÓXIMOS 7 DÍAS):
        ${tasksNext7Days.length
            ? tasksNext7Days
                .map((t: any) => `- ${t.due_at || 'sin fecha'} · ${t.kind || 'Otro'} · ${t.priority || 'Media'} · ${t.title || 'Sin título'}${t.entity_type && t.entity_id ? ` · ${t.entity_type}:${t.entity_id}` : ''}`)
                .join('\n')
            : '- No hay tareas en los próximos 7 días'}

        🎯 PROSPECTOS (ÚLTIMOS ACTUALIZADOS):
        ${recentLeads.length
            ? recentLeads
                .map((l: any) => `- ${[l.name, l.last_name].filter(Boolean).join(' ') || l.full_name || 'Sin nombre'} · ${l.stage || 'Sin etapa'} · ${l.status || 'Sin estatus'} · ${l.insurance_type || 'Sin ramo'} · ${l.phone || 'sin teléfono'}`)
                .join('\n')
            : '- Sin prospectos recientes'}

        🧾 LEADS (COLUMNAS DISPONIBLES):
        ${leadsColumns.length ? `- ${leadsColumns.join(', ')}` : '- (sin columnas detectadas)'}

        🧾 LEADS (DATOS CRUDOS CON TODAS LAS COLUMNAS · MUESTRA):
        ${leadsRawContext}

        👥 CLIENTES (ÚLTIMOS REGISTRADOS):
        ${recentCustomers.length
            ? recentCustomers
                .map((c: any) => `- ${[c.name, c.last_name].filter(Boolean).join(' ') || 'Sin nombre'} · ${c.status || 'sin estatus'} · ${c.insurance_type || 'sin ramo'} · ${c.phone || 'sin teléfono'}`)
                .join('\n')
            : '- Sin clientes recientes'}

        🧾 CLIENTES (COLUMNAS DISPONIBLES):
        ${customersColumns.length ? `- ${customersColumns.join(', ')}` : '- (sin columnas detectadas)'}

        🧾 CLIENTES (DATOS CRUDOS CON TODAS LAS COLUMNAS · MUESTRA):
        ${customersRawContext}

        📄 PÓLIZAS (PRÓXIMAS A VENCER):
        ${policiesExpiringSoon.length
            ? policiesExpiringSoon
                .map((p: any) => `- Vence ${p.expiry_date} · ${p.policy_number || 'sin número'} · ${p.insurance_company || 'sin aseguradora'} · ${p.category || 'sin ramo'} · $${Number(p.total_premium || 0).toLocaleString()}`)
                .join('\n')
            : '- Sin pólizas con vencimiento en el radar'}

        🧠 TU PERSONALIDAD (COPILOTO MAESTRO):
        1. **Mente de Underwriter**: Analizas cada riesgo con precisión técnica. Conoces de ramos (Autos, GMM, Vida, Daños).
        2. **Visión de Ventas**: Tu prioridad es que el asesor cierre más. Si detectas un lead abandonado, ¡exígele acción!
        3. **Estilo Directo**: Hablas como un socio de negocios. Si los números bajan, eres honesto. Si hay oportunidad, eres audaz.
        4. **ENFOQUE**: Es muy importante hacerle entender al usuario que no todos los clientes son iguales. Debemos de actuar diferente según la edad del cliente.

        ⚡ REGLAS DE ORO:
        - Si te preguntan por un cliente o póliza específica y no está en los datos de arriba, di: "No visualizo ese dato en el radar inmediato, dame el número de póliza o búscalo en la sección de Clientes para profundizar".
        - Tienes acceso operativo a estas tablas: Calendario (${DATABASE.TABLES.WS_TASKS}), Prospectos (${DATABASE.TABLES.WS_LEADS}), Clientes (${DATABASE.TABLES.WS_CUSTOMERS_2}), Pólizas (${DATABASE.TABLES.WS_POLICIES}).
        - Usa terminología de seguros: Prima neta, siniestralidad, endosos, renovaciones, carencias.
        - Sé proactivo: Si te preguntan "Hola", responde con un breve insight, ej: "Hola. Tenemos $${totalCartera} en cartera, pero veo ${totalLeads} leads que necesitan cierre hoy. ¿En qué atacamos?"

        🗣️ ESTILO: Técnico pero motivador. Elegante, minimalista y ultra-eficiente.`;

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-pro",
            systemInstruction: systemPrompt
        });

        // --- 3. PROCESAMIENTO DE TOKENS Y MENSAJE ---
        const countResponse = await model.countTokens(message);
        const userTokens = countResponse.totalTokens;

        await supabase.from(DATABASE.TABLES.WS_IA_MESSAGES).insert([
            { user_id, conversation_id, role: 'user', content: message, tokens_input: userTokens }
        ]);

        const result = await model.generateContent(message);
        const responseText = result.response.text();
        const aiTokens = result.response.usageMetadata?.candidatesTokenCount || 0;

        await supabase.from(DATABASE.TABLES.WS_IA_MESSAGES).insert([
            {
                user_id,
                conversation_id,
                role: 'assistant',
                content: responseText,
                tokens_output: aiTokens,
                tokens_totales: userTokens + aiTokens
            }
        ]);

        return NextResponse.json({
            response: responseText,
            success: true,
            tokens: { user: userTokens, ai: aiTokens }
        });
    } catch (error) {
        console.error("Error en el chat:", error);
        return NextResponse.json({ error: 'Hubo un error al procesar' }, { status: 500 });
    }
}