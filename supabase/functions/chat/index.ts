import { convertToModelMessages, type UIMessage } from "npm:ai@7";
import { createResponsesCall } from "../_shared/responses.ts";
import { withLovableAiGatewayRunIdHeader } from "../_shared/run-id.ts";
import { adminClient, corsHeaders, gatewayErrorMessage, gatewayErrorStatus, getUserClient, json } from "../_shared/context.ts";

const BASE = `You are sieg.ai, a sharp, warm AI advisor helping Indian students and job seekers reach Germany (studies, Ausbildung, jobs).
- Use the applicant's profile and document analysis below to give specific, personal answers.
- Advise on German universities and programs that match their background (e.g. TU9, TUM, RWTH, KIT, TU Berlin), admission requirements, APS certificate, blocked account, visa, language tests (IELTS/TOEFL/TestDaF/Goethe), costs and timelines.
- If something is missing from their documents, say exactly what to upload next.
- Be concise and structured with short headings and bullets. Never invent facts about their documents. Note that you are not affiliated with any university and official sites are the final authority.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await getUserClient(req);
    if (!ctx) return json({ error: "Please sign in." }, 401);
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI is not configured." }, 500);

    const { messages } = (await req.json()) as { messages: UIMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) return json({ error: "No messages." }, 400);

    const [{ data: profile }, { data: docs }] = await Promise.all([
      ctx.supabase.from("profiles").select("*").eq("id", ctx.user.id).maybeSingle(),
      ctx.supabase.from("documents").select("doc_type,name,status,ai_summary,issues").eq("user_id", ctx.user.id),
    ]);
    const instructions = `${BASE}\n\nAPPLICANT PROFILE:\n${JSON.stringify(profile ?? {}, null, 1)}\n\nDOCUMENTS:\n${JSON.stringify(docs ?? [], null, 1)}`;

    const admin = adminClient();
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      const { error } = await admin.from("chat_messages").insert({ user_id: ctx.user.id, message: last });
      if (error) console.error("save user message failed", error);
    }

    const { result, runIdFetch } = createResponsesCall(req, { apiKey }, await convertToModelMessages(messages), instructions);
    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      sendReasoning: true,
      headers: corsHeaders,
      onFinish: async ({ responseMessage }) => {
        const { error } = await admin.from("chat_messages").insert({ user_id: ctx.user.id, message: responseMessage });
        if (error) console.error("save assistant message failed", error);
      },
      onError: (err) => {
        console.error("chat stream error", err);
        return gatewayErrorMessage(gatewayErrorStatus(err));
      },
    });
    return await withLovableAiGatewayRunIdHeader(response, runIdFetch, corsHeaders);
  } catch (e) {
    console.error(e);
    const status = gatewayErrorStatus(e);
    return json({ error: gatewayErrorMessage(status) }, status);
  }
});
