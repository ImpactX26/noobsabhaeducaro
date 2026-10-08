import { createOpenAI } from "npm:@ai-sdk/openai@4";
import { streamText, type ModelMessage } from "npm:ai@7";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
} from "./run-id.ts";

export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
export const MODEL = "openai/gpt-6-astra";

export function createResponsesCall(
  request: Request,
  config: { apiKey: string; model?: string },
  messages: ModelMessage[],
  instructions?: string,
  effort: "low" | "medium" = "medium",
) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey: config.apiKey,
    headers: { "Lovable-API-Key": config.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const result = streamText({
    model: provider.responses(config.model ?? MODEL),
    ...(instructions ? { instructions } : {}),
    messages,
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: effort,
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return { result, runIdFetch };
}
