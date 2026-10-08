import 'dotenv/config';
import type { ConfigService } from '@nestjs/config';
import { LlmOutputError, LlmService, LlmUnavailableError, type JsonCompletionRequest } from './llm.service';

const config = (env: Record<string, string | undefined>) => ({ get: (k: string) => env[k] }) as unknown as ConfigService;

/** The retry delay is zero in tests. */
class TestLlm extends LlmService {
  constructor(c: ConfigService) {
    super(c);
    this.retryDelayMs = 0;
  }
}
const KEY = 'sk-or-test-key';
const make = (env: Record<string, string | undefined> = { OPENROUTER_API_KEY: KEY }) => new TestLlm(config(env));

const req: JsonCompletionRequest = { system: 'sys', content: [{ type: 'text', text: 'hi' }], schema: { type: 'object' } };
const ok = (content: unknown, finish_reason = 'stop') => ({ choices: [{ finish_reason, message: { role: 'assistant', content } }] });
const respond = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, statusText: `status ${status}`, json: async () => body }) as unknown as Response;

let fetchMock: jest.SpyInstance;
beforeEach(() => {
  fetchMock = jest.spyOn(globalThis, 'fetch');
});
afterEach(() => jest.restoreAllMocks());

const sent = (call = 0) => {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) };
};

describe('LlmService (OpenRouter)', () => {
  describe('request construction', () => {
    it('posts to the OpenRouter chat-completions URL with a Bearer key', async () => {
      fetchMock.mockResolvedValue(respond(200, ok('{"a":1}')));
      await make().completeJson(req);
      const { url, init, headers } = sent();
      expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
      expect(init.method).toBe('POST');
      expect(headers.Authorization).toBe(`Bearer ${KEY}`);
      expect(headers['Content-Type']).toBe('application/json');
      expect(Object.keys(headers).some((h) => h.toLowerCase() === 'x-api-key')).toBe(false); // not the Anthropic header
    });

    it('honours OPENROUTER_BASE_URL (and ignores a trailing slash)', async () => {
      fetchMock.mockResolvedValue(respond(200, ok('{}')));
      await make({ OPENROUTER_API_KEY: KEY, OPENROUTER_BASE_URL: 'https://proxy.example/v1/' }).completeJson(req);
      expect(sent().url).toBe('https://proxy.example/v1/chat/completions');
    });

    it('uses anthropic/claude-sonnet-5.5 by default and OPENROUTER_MODEL when set', async () => {
      fetchMock.mockResolvedValue(respond(200, ok('{}')));
      const def = make();
      expect(def.model).toBe('anthropic/claude-sonnet-5.5');
      await def.completeJson(req);
      expect(sent().body.model).toBe('anthropic/claude-sonnet-5.5');

      fetchMock.mockClear();
      await make({ OPENROUTER_API_KEY: KEY, OPENROUTER_MODEL: 'anthropic/claude-haiku-5.5' }).completeJson(req);
      expect(sent().body.model).toBe('anthropic/claude-haiku-5.5');
    });

    it('asks for schema-constrained JSON and sends system + user messages', async () => {
      fetchMock.mockResolvedValue(respond(200, ok('{}')));
      await make().completeJson({ ...req, schema: { type: 'object', required: ['x'] }, maxTokens: 777 });
      const { body } = sent();
      expect(body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'response', strict: true, schema: { type: 'object', required: ['x'] } } });
      expect(body.provider).toEqual({ require_parameters: true });
      expect(body.max_tokens).toBe(777);
      expect(body.messages).toEqual([
        { role: 'system', content: 'sys' },
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      ]);
      expect(body).not.toHaveProperty('temperature');
    });

    it('translates image and PDF blocks to the OpenRouter format', async () => {
      fetchMock.mockResolvedValue(respond(200, ok('{}')));
      await make().completeJson({
        ...req,
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'BBBB' } },
          { type: 'text', text: 'read it' },
        ],
      });
      expect(sent().body.messages[1].content).toEqual([
        { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
        { type: 'file', file: { filename: 'document.pdf', file_data: 'data:application/pdf;base64,BBBB' } },
        { type: 'text', text: 'read it' },
      ]);
    });
  });

  describe('responses', () => {
    it('parses structured JSON from the first choice', async () => {
      fetchMock.mockResolvedValue(respond(200, ok('{"documentType":"CV","claims":[{"fieldKey":"applicant.name"}]}')));
      await expect(make().completeJson(req)).resolves.toEqual({ documentType: 'CV', claims: [{ fieldKey: 'applicant.name' }] });
    });

    it('tolerates a JSON code fence around the reply', async () => {
      fetchMock.mockResolvedValue(respond(200, ok('```json\n{"a":1}\n```')));
      await expect(make().completeJson(req)).resolves.toEqual({ a: 1 });
    });

    it.each([
      ['not json at all', ok('Sure! Here you go'), /valid JSON/],
      ['truncated JSON', ok('{"a":'), /valid JSON/],
      ['empty content', ok(''), /valid JSON/],
      ['null content', ok(null), /valid JSON/],
      ['non-string content', ok([{ type: 'text', text: '{}' }]), /valid JSON/],
      ['a length cut-off', ok('{"a":', 'length'), /truncated/],
      ['a content-filter stop', ok('{}', 'content_filter'), /declined/],
      ['no choices', { choices: [] }, /empty response/],
      ['an error body with HTTP 200', { error: { message: 'No endpoints found' } }, /No endpoints found/],
    ])('raises LlmOutputError for %s', async (_n, body, pattern) => {
      fetchMock.mockResolvedValue(respond(200, body));
      const err: Error = await make().completeJson(req).then(() => new Error('did not throw'), (e: Error) => e);
      expect(err).toBeInstanceOf(LlmOutputError);
      expect(err.message).toMatch(pattern);
    });
  });

  describe('configuration and failures', () => {
    it('is unavailable without an API key and never calls the network', async () => {
      const llm = make({});
      expect(llm.isConfigured).toBe(false);
      await expect(llm.completeJson(req)).rejects.toBeInstanceOf(LlmUnavailableError);
      await expect(llm.completeJson(req)).rejects.toThrow(/OPENROUTER_API_KEY/);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports a non-retryable HTTP error once, with the provider message and without the key', async () => {
      fetchMock.mockResolvedValue(respond(401, { error: { message: 'Invalid credentials' } }));
      const err: Error = await make().completeJson(req).then(() => new Error('did not throw'), (e: Error) => e);
      expect(err).toBeInstanceOf(LlmOutputError);
      expect(err.message).toBe('LLM request failed (HTTP 401): Invalid credentials');
      expect(err.message).not.toContain(KEY);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it.each([429, 503])('retries once on HTTP %s and then succeeds', async (status) => {
      fetchMock.mockResolvedValueOnce(respond(status, { error: { message: 'busy' } })).mockResolvedValueOnce(respond(200, ok('{"ok":true}')));
      await expect(make().completeJson(req)).resolves.toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('gives up after one retry', async () => {
      fetchMock.mockResolvedValue(respond(503, { error: { message: 'down' } }));
      await expect(make().completeJson(req)).rejects.toThrow('LLM request failed (HTTP 503): down');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('turns a network failure into LlmOutputError after one retry, without leaking details', async () => {
      fetchMock.mockRejectedValue(Object.assign(new Error(`connect ECONNREFUSED ${KEY}`), { name: 'TypeError' }));
      const err: Error = await make().completeJson(req).then(() => new Error('did not throw'), (e: Error) => e);
      expect(err).toBeInstanceOf(LlmOutputError);
      expect(err.message).toBe('LLM request failed: TypeError');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('handles an error response that is not JSON', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 400, statusText: 'Bad Request', json: async () => { throw new Error('x'); } } as unknown as Response);
      await expect(make().completeJson(req)).rejects.toThrow('LLM request failed (HTTP 400): Bad Request');
    });
  });
});

// Optional live smoke test: runs only when OPENROUTER_API_KEY is set (environment or backend/.env).
const live = process.env.OPENROUTER_API_KEY ? describe : describe.skip;
live('LlmService (live OpenRouter -> Claude)', () => {
  it('returns schema-valid extraction JSON for a short text', async () => {
    fetchMock?.mockRestore();
    const { EXTRACTION_SCHEMA, EXTRACTION_SYSTEM_PROMPT, buildExtractionUserText } = await import('../ingestion/extraction.schema');
    const llm = new LlmService(config({ OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY, OPENROUTER_MODEL: process.env.OPENROUTER_MODEL, OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL }));
    const out = (await llm.completeJson({
      system: EXTRACTION_SYSTEM_PROMPT,
      content: [{ type: 'text', text: buildExtractionUserText([{ pageNo: 1, text: 'ENGLISH LANGUAGE TEST REPORT\nCandidate Arjun Mehta\nOverall Band 7.0' }], 'x.pdf') }],
      schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 2000, // smoke test only: keeps the request affordable on a small OpenRouter allowance
    })) as { documentType: string; claims: Array<{ fieldKey: string; rawValue: string; quote: string }> };
    console.log(`live OpenRouter model: ${llm.model}; claims: ${JSON.stringify(out.claims.map((c) => [c.fieldKey, c.rawValue]))}`);
    expect(out.documentType).toBe('LANGUAGE_CERT');
    expect(out.claims.find((c) => c.fieldKey === 'language.overall')?.rawValue).toBe('7.0');
  }, 120000);
});
