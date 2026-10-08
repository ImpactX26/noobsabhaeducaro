import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Raised when no ANTHROPIC_API_KEY is configured. Callers fail gracefully and can be retried. */
export class LlmUnavailableError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not configured; LLM-backed processing is unavailable');
    this.name = 'LlmUnavailableError';
  }
}

/** The model declined, was cut off, or returned something that is not valid JSON. */
export class LlmOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmOutputError';
  }
}

export interface JsonCompletionRequest {
  system: string;
  /** User content: text, image and PDF document blocks. */
  content: Anthropic.ContentBlockParam[];
  /** JSON Schema the response is constrained to (structured outputs). */
  schema: Record<string, unknown>;
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
}

/**
 * Thin wrapper around the Anthropic Messages API for schema-constrained JSON output.
 * Everything LLM-related goes through `completeJson`, so tests replace this one provider
 * and no other code touches the SDK. The model is never given a score or a decision to
 * make here - only text to read and a schema to fill.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private client?: Anthropic;

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('ANTHROPIC_API_KEY'));
  }

  get model(): string {
    return this.config.get<string>('ANTHROPIC_MODEL', 'claude-sonnet-5-5');
  }

  private getClient(): Anthropic {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) throw new LlmUnavailableError();
    this.client ??= new Anthropic({ apiKey });
    return this.client;
  }

  async completeJson(req: JsonCompletionRequest): Promise<unknown> {
    const client = this.getClient();
    const response = await client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens ?? 16000,
      system: req.system,
      messages: [{ role: 'user', content: req.content }],
      output_config: { effort: req.effort ?? 'medium', format: { type: 'json_schema', schema: req.schema } },
    });

    if (response.stop_reason === 'refusal') throw new LlmOutputError('The model declined to process this content');
    if (response.stop_reason === 'max_tokens') throw new LlmOutputError('The model output was truncated');

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    try {
      return JSON.parse(text);
    } catch {
      this.logger.warn(`Non-JSON model output (${text.slice(0, 120)}...)`);
      throw new LlmOutputError('The model did not return valid JSON');
    }
  }
}
