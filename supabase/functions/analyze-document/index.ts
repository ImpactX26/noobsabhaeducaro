import { createResponsesCall } from "../_shared/responses.ts";
import { corsHeaders, gatewayErrorMessage, gatewayErrorStatus, getUserClient, json } from "../_shared/context.ts";

const LABELS: Record<string, string> = {
  "10th": "10th class marksheet",
  "12th": "12th class marksheet",
  degree: "Bachelor's degree certificate or transcript",
  resume: "Resume / CV",
  language: "Language certificate (IELTS, TOEFL, TestDaF, Goethe etc.)",
  other: "Supporting document",
};

const INSTRUCTIONS = `You are a document verifier for German university/job applications. Read the attached document and reply with ONLY a JSON object (no markdown) of this exact shape:
{"matches_type": boolean, "readable": boolean, "summary": string, "issues": string[], "extracted": {"full_name": string|null, "nationality": string|null, "degree": string|null, "field": string|null, "university": string|null, "graduation_year": number|null, "marks_percent": number|null, "total_experience": string|null, "latest_organisation": string|null, "english": string|null, "german": string|null}}
- matches_type: is this really the expected document type?
- summary: one or two sentences on what the document shows (include scores/grades).
- issues: concrete problems (expired, low score, unreadable, name mismatch with the profile name, wrong document). Empty if none.
- extracted: only values actually visible in the document, else null. english/german = level or score like "IELTS 7.0" or "Goethe B1".`;

function bytesToBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const ctx = await getUserClient(req);
  if (!ctx) return json({ error: "Please sign in." }, 401);
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured." }, 500);

  const { documentId } = await req.json().catch(() => ({}));
  const { data: doc } = await ctx.supabase.from("documents").select("*").eq("id", documentId).maybeSingle();
  if (!doc) return json({ error: "Document not found." }, 404);

  const fail = async (msg: string, status: number) => {
    await ctx.supabase.from("documents").update({ status: "unknown", ai_summary: msg }).eq("id", doc.id);
    return json({ error: msg }, status);
  };

  try {
    const { data: file, error: dlErr } = await ctx.supabase.storage.from("documents").download(doc.storage_path);
    if (dlErr || !file) return await fail("Could not read the uploaded file.", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mediaType = doc.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : file.type || "image/jpeg";
    const { data: profile } = await ctx.supabase.from("profiles").select("*").eq("id", ctx.user.id).maybeSingle();

    const part = mediaType === "application/pdf"
      ? { type: "file" as const, data: bytesToBase64(bytes), mediaType, filename: doc.name }
      : { type: "image" as const, image: bytesToBase64(bytes), mediaType };

    const { result } = createResponsesCall(req, { apiKey }, [{
      role: "user",
      content: [
        { type: "text", text: `Expected document type: ${LABELS[doc.doc_type] ?? doc.doc_type}. Applicant name on profile: ${profile?.full_name || "unknown"}.` },
        part,
      ],
    }], INSTRUCTIONS, "low");

    const text = await result.text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return await fail("AI couldn't read this document. Try a clearer scan.", 422);
    const out = JSON.parse(match[0]);
    const issues: string[] = Array.isArray(out.issues) ? out.issues.map(String) : [];
    const ok = out.matches_type && out.readable !== false;
    const status = ok ? (issues.length ? "conflict" : "verified") : "rejected";

    await ctx.supabase.from("documents").update({ status, ai_summary: String(out.summary ?? ""), issues }).eq("id", doc.id);

    // Fill only empty profile fields with AI-extracted values.
    if (ok && profile) {
      const e = out.extracted ?? {};
      const map: Record<string, unknown> = {
        full_name: e.full_name, nationality: e.nationality, degree: e.degree, field: e.field,
        university: e.university, graduation_year: e.graduation_year, marks: e.marks_percent,
        total_experience: e.total_experience, latest_organisation: e.latest_organisation,
        english: e.english, german: e.german,
      };
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(map)) {
        const cur = (profile as Record<string, unknown>)[k];
        const empty = cur === null || cur === "" || cur === undefined;
        const forceLang = doc.doc_type === "language" && (k === "english" || k === "german");
        if (v !== null && v !== undefined && v !== "" && (empty || forceLang)) patch[k] = v;
      }
      if (Object.keys(patch).length) {
        patch.updated_at = new Date().toISOString();
        await ctx.supabase.from("profiles").update(patch).eq("id", ctx.user.id);
      }
    }
    return json({ status, summary: out.summary, issues });
  } catch (e) {
    console.error(e);
    const s = gatewayErrorStatus(e);
    return await fail(gatewayErrorMessage(s), s);
  }
});
