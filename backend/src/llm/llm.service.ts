import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Raised when no OPENROUTER_API_KEY is configured. Callers fail gracefully and can be retried. */
export class LlmUnavailableError extends Error {
  constructor() {
    super('OPENROUTER_API_KEY is not configured; LLM-backed processing is unavailable');
    this.name = 'LlmUnavailableError';
  }
}

/** The model declined, was cut off, the request failed, or the reply is not valid JSON. */
export class LlmOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmOutputError';
  }
}

/** Provider-neutral user content: callers never see which API carries it. */
export type LlmContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } };

export interface JsonCompletionRequest {
  system: string;
  /** User content: text, image and PDF document blocks. */
  content: LlmContentBlock[];
  /** JSON Schema the response is constrained to (structured outputs). */
  schema: Record<string, unknown>;
  maxTokens?: number;
  /** Accepted for interface stability; OpenRouter chooses the model's own default reasoning. */
  effort?: 'low' | 'medium' | 'high';
}

export const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-sonnet-5.5';
export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const REQUEST_TIMEOUT_MS = 120_000;

type OpenRouterPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } };

function toPart(block: LlmContentBlock): OpenRouterPart {
  if (block.type === 'text') return { type: 'text', text: block.text };
  const url = `data:${block.source.media_type};base64,${block.source.data}`;
  return block.type === 'image'
    ? { type: 'image_url', image_url: { url } }
    : { type: 'file', file: { filename: 'document.pdf', file_data: url } };
}

/**
 * Schema-constrained JSON completion through OpenRouter's chat-completions API (Claude by
 * default). Everything LLM-related goes through `completeJson`, so document extraction and the
 * agent do not know which provider carries the request, and tests replace this one provider.
 * The model is never given a score or a decision to make here - only text to read and a schema to fill.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  /** Delay before the single retry of a transient failure (429 / 5xx / network); tests set it to 0. */
  protected retryDelayMs = 1000;

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('OPENROUTER_API_KEY'));
  }

  get model(): string {
    return this.config.get<string>('OPENROUTER_MODEL') || DEFAULT_OPENROUTER_MODEL;
  }

  get endpoint(): string {
    const base = this.config.get<string>('OPENROUTER_BASE_URL') || DEFAULT_OPENROUTER_BASE_URL;
    return `${base.replace(/\/+$/, '')}/chat/completions`;
  }

  async completeJson(req: JsonCompletionRequest): Promise<unknown> {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) throw new LlmUnavailableError();

    const body = JSON.stringify({
      model: this.model,
      max_tokens: req.maxTokens ?? 3000,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.content.map(toPart) },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'response', strict: true, schema: req.schema } },
      // only route to providers that honour the structured-output parameter
      provider: { require_parameters: true },
    });

    const data = await this.post(apiKey, body);
    const choice = data.choices?.[0];
    if (data.error || !choice) throw new LlmOutputError(`LLM request failed: ${data.error?.message ?? 'empty response'}`);
    if (choice.finish_reason === 'content_filter') throw new LlmOutputError('The model declined to process this content');
    if (choice.finish_reason === 'length') throw new LlmOutputError('The model output was truncated');
    if (choice.finish_reason === 'error') throw new LlmOutputError(`LLM request failed: ${choice.error?.message ?? 'provider error'}`);

    const content = choice.message?.content;
    const text = (typeof content === 'string' ? content : '').trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
    try {
      return JSON.parse(text);
    } catch {
      this.logger.warn(`Non-JSON model output (${text.slice(0, 120)}...)`);
      throw new LlmOutputError('The model did not return valid JSON');
    }
  }

  /** POST with a timeout and one retry for transient failures. Never leaks the API key into errors. */
  private async post(apiKey: string, body: string, attempt = 1): Promise<OpenRouterResponse> {
    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'AI Applicant Copilot' },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      if (attempt === 1) return this.retry(apiKey, body);
      throw new LlmOutputError(`LLM request failed: ${err instanceof Error ? err.name : 'network error'}`);
    }
    if (!res.ok) {
      if (attempt === 1 && (res.status === 429 || res.status >= 500)) return this.retry(apiKey, body);
      const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new LlmOutputError(`LLM request failed (HTTP ${res.status}): ${detail?.error?.message ?? res.statusText}`);
    }
    return (await res.json().catch(() => ({}))) as OpenRouterResponse;
  }

  private async retry(apiKey: string, body: string) {
    await new Promise((r) => setTimeout(r, this.retryDelayMs));
    return this.post(apiKey, body, 2);
  }
}

interface OpenRouterResponse {
  choices?: Array<{ finish_reason?: string; error?: { message?: string }; message?: { content?: unknown } }>;
  error?: { message?: string };
}
