import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Returns a client acting as the signed-in user, plus the user, or null. */
export async function getUserClient(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export function gatewayErrorStatus(err: unknown): number {
  const s = (err as { statusCode?: number; status?: number })?.statusCode ?? (err as { status?: number })?.status;
  return typeof s === "number" ? s : 500;
}

export function gatewayErrorMessage(status: number) {
  if (status === 429) return "Too many requests right now. Please wait a moment and try again.";
  if (status === 402) return "AI credits have run out. Add credits in Settings → Plans & credits.";
  if (status === 403) return "AI access is currently blocked for this workspace.";
  return "The AI assistant couldn't respond. Please try again.";
}
