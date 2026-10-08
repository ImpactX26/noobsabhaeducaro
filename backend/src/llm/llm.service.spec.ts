import type { ConfigService } from '@nestjs/config';

const create = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ messages: { create } })),
}));

import { LlmOutputError, LlmService, LlmUnavailableError } from './llm.service';

const config = (env: Record<string, string | undefined>) =>
  ({ get: (k: string, d?: string) => env[k] ?? d }) as unknown as ConfigService;
const req = { system: 'sys', content: [{ type: 'text' as const, text: 'hi' }], schema: { type: 'object' } };
const reply = (text: string, stop_reason = 'end_turn') => ({ stop_reason, content: [{ type: 'text', text }] });

describe('LlmService', () => {
  beforeEach(() => create.mockReset());

  it('is unavailable without an API key and never calls the API', async () => {
    const llm = new LlmService(config({}));
    expect(llm.isConfigured).toBe(false);
    await expect(llm.completeJson(req)).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(create).not.toHaveBeenCalled();
  });

  it('requests schema-constrained JSON from the configured model and parses it', async () => {
    create.mockResolvedValue(reply('{"claims":[]}'));
    const llm = new LlmService(config({ ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'claude-sonnet-5-5' }));
    await expect(llm.completeJson(req)).resolves.toEqual({ claims: [] });

    const sent = create.mock.calls[0][0];
    expect(sent).toMatchObject({
      model: 'claude-sonnet-5-5',
      system: 'sys',
      messages: [{ role: 'user', content: req.content }],
      output_config: { format: { type: 'json_schema', schema: { type: 'object' } } },
    });
    // sampling params and forced tool choice are rejected by current models; none must be sent
    expect(sent).not.toHaveProperty('temperature');
    expect(sent).not.toHaveProperty('tool_choice');
  });

  it.each([
    ['refusal', '{}', /declined/],
    ['max_tokens', '{"a":', /truncated/],
    ['end_turn', 'not json', /valid JSON/],
  ])('raises LlmOutputError on %s', async (stop, text, pattern) => {
    create.mockResolvedValue(reply(text, stop));
    const llm = new LlmService(config({ ANTHROPIC_API_KEY: 'k' }));
    const err: Error = await llm.completeJson(req).then(() => new Error("did not throw"), (e: Error) => e);
    expect(err).toBeInstanceOf(LlmOutputError);
    expect(err.message).toMatch(pattern);
  });
});

// Live smoke test: runs only when a real key is present (npm test with ANTHROPIC_API_KEY set).
const live = process.env.ANTHROPIC_API_KEY ? describe : describe.skip;
live('LlmService (live Claude)', () => {
  it('extracts a grounded claim from a short text', async () => {
    jest.unmock('@anthropic-ai/sdk');
    jest.resetModules();
    const { LlmService: Real } = await import('./llm.service');
    const { EXTRACTION_SCHEMA, EXTRACTION_SYSTEM_PROMPT, buildExtractionUserText } = await import('../ingestion/extraction.schema');
    const llm = new Real(config({ ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL }));
    const out = (await llm.completeJson({
      system: EXTRACTION_SYSTEM_PROMPT,
      content: [{ type: 'text', text: buildExtractionUserText([{ pageNo: 1, text: 'ENGLISH LANGUAGE TEST REPORT\nCandidate Arjun Mehta\nOverall Band 7.0' }], 'x.pdf') }],
      schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
    })) as { documentType: string; claims: Array<{ fieldKey: string; rawValue: string }> };
    expect(out.documentType).toBe('LANGUAGE_CERT');
    expect(out.claims.find((c) => c.fieldKey === 'language.overall')?.rawValue).toBe('7.0');
  }, 120000);
});
