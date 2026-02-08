import { DATABASE } from "@/src/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/src/lib/supabase/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

export async function POST(request: Request) {
    const supabase = await createServerClient();

    try {
        const requestData = await request.json();
        const { message, user_id, conversation_id, profile } = requestData;

        if (!message) {
            return NextResponse.json({ error: "El mensaje es requerido" }, { status: 400 });
        }

        // --- 1. DATA EXTRACTION (EL CONTEXTO REAL) ---
        // Traemos datos clave para que la IA no improvise (leads desde WS_LEADS)
        const [{ data: stats }, { data: leads }, { data: recentPolicies }] = await Promise.all([
            supabase.from(DATABASE.TABLES.WS_POLICIES).select('total_premium, status'),
            supabase.from(DATABASE.TABLES.WS_LEADS).select('id'),
            supabase.from(DATABASE.TABLES.WS_POLICIES).select('policy_number, insurance_company, total_premium').order('created_at', { ascending: false }).limit(3)
        ]);

        const totalCartera = stats?.reduce((acc, p) => acc + (p.total_premium || 0), 0) || 0;
        const totalLeads = leads?.length || 0;
        const totalPolizas = stats?.length || 0;

        const iaNombre = "Gubot";
        
        // --- 2. SYSTEM PROMPT EVOLUCIONADO ---
        const systemPrompt = `
        Soy Gubot, tu Copiloto de Alto Rendimiento en TECHGUROS. No soy un chatbot, soy tu Director de Estrategia y Maestro en Riesgos.
    
        📊 CONTEXTO ACTUAL DE LA AGENCIA (DATOS REALES):
        - Cartera Total: $${totalCartera.toLocaleString()}
        - Pólizas Activas: ${totalPolizas}
        - Prospectos (Leads) en Seguimiento: ${totalLeads}
        - Últimas Pólizas Emitidas: ${recentPolicies?.map(p => `${p.policy_number} (${p.insurance_company})`).join(', ') || 'Ninguna reciente'}

        🧠 TU PERSONALIDAD (COPILOTO MAESTRO):
        1. **Mente de Underwriter**: Analizas cada riesgo con precisión técnica. Conoces de ramos (Autos, GMM, Vida, Daños).
        2. **Visión de Ventas**: Tu prioridad es que el asesor cierre más. Si detectas un lead abandonado, ¡exígele acción!
        3. **Estilo Directo**: Hablas como un socio de negocios. Si los números bajan, eres honesto. Si hay oportunidad, eres audaz.

        ⚡ REGLAS DE ORO:
        - Si te preguntan por un cliente o póliza específica y no está en los datos de arriba, di: "No visualizo ese dato en el radar inmediato, dame el número de póliza o búscalo en la sección de Clientes para profundizar".
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