// Optional live smoke tests: run only when GEMINI_API_KEY is set (environment or backend/.env).
// They call the real Gemini API; the mocked unit tests live in llm.service.spec.ts.
import 'dotenv/config';
import type { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';
import { DECISION_SCHEMA } from '../agent/agent.logic';
import { EXTRACTION_SCHEMA, EXTRACTION_SYSTEM_PROMPT, buildExtractionUserText } from '../ingestion/extraction.schema';

const live = process.env.GEMINI_API_KEY ? describe : describe.skip;
const config = { get: (k: string) => process.env[k] } as unknown as ConfigService;

live('LlmService (live Gemini)', () => {
  const llm = new LlmService(config);

  it('returns schema-valid extraction JSON for a short document', async () => {
    const out = (await llm.completeJson({
      system: EXTRACTION_SYSTEM_PROMPT,
      content: [{ type: 'text', text: buildExtractionUserText([{ pageNo: 1, text: 'ENGLISH LANGUAGE TEST REPORT\nCandidate Arjun Mehta\nOverall Band 7.0' }]) }],
      schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 2000, // the extraction call's real limit
    })) as { documentType: string; claims: Array<{ fieldKey: string; rawValue: string; quote: string }> };
    console.log(`live Gemini model: ${llm.model}; claims: ${JSON.stringify(out.claims.map((c) => [c.fieldKey, c.rawValue]))}`);
    expect(out.documentType).toBe('LANGUAGE_CERT');
    expect(out.claims.find((c) => c.fieldKey === 'language.overall')?.rawValue).toBe('7.0');
  }, 120000);

  // The model must tell what a document IS from its content alone (no file name, no upload slot).
  it.each([
    ['an identity card', 'GOVERNMENT IDENTITY CARD (FICTIONAL SAMPLE)\nName: Arjun Mehta\nIdentity No: 0000 0000 0000\nDate of Birth: 14/02/2004\nAddress: Sample Street, Bengaluru', 'IDENTITY_DOCUMENT', 0],
    ['an invoice', 'INVOICE 2026-0042\nItem: office chairs x 4\nTotal due: 480.00 EUR\nPayment terms: 30 days net', 'OTHER', 0],
    ['an untitled degree text', 'This is to certify that Arjun Mehta was awarded the BACHELOR OF TECHNOLOGY in Computer Science and Engineering by Riverview Institute of Technology. Year of Graduation 2025. Final CGPA 8.42 / 10.00', 'DEGREE', 1],
    ['an almost empty page', 'Page 1', 'UNKNOWN', 0],
  ])('classifies %s from its content', async (_name, text, expected, minClaims) => {
    const out = (await llm.completeJson({
      system: EXTRACTION_SYSTEM_PROMPT,
      content: [{ type: 'text', text: buildExtractionUserText([{ pageNo: 1, text }]) }],
      schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 2000,
    })) as { documentType: string; claims: unknown[] };
    console.log(`live Gemini classification of ${_name}: ${out.documentType} (${out.claims.length} claims)`);
    expect(out.documentType).toBe(expected);
    if (minClaims === 0) expect(out.claims).toEqual([]); // nothing may be extracted from unusable documents
    else expect(out.claims.length).toBeGreaterThanOrEqual(minClaims);
  }, 120000);

  it('accepts the agent decision schema (nullable fields) with the agent token limit', async () => {
    const out = (await llm.completeJson({
      system: 'You choose one next action. Reply only with the JSON object.',
      content: [{ type: 'text', text: JSON.stringify({ candidates: [{ action: 'REQUEST_DOCUMENT', gapId: 'MISSING_DOC:LANGUAGE_CERT', docType: 'LANGUAGE_CERT', description: 'Please upload your language certificate' }] }) }],
      schema: DECISION_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 1000, // the agent's real limit
    })) as { action: string; gapId: string | null };
    console.log(`live Gemini agent decision: ${out.action} / ${out.gapId}`);
    expect(['ASK_CLARIFICATION', 'REQUEST_DOCUMENT', 'SHOW_MISSING_REQUIREMENT', 'RECOMMEND_NEXT_STEP', 'NO_ACTION']).toContain(out.action);
  }, 120000);
});
