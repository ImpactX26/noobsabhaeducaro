// Document type validation and completeness credit, end to end: real PostgreSQL, real Arjun PDFs, scripted
// stand-in for the model. A document is only evidence if its CONTENT says it is what it was uploaded as.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { TestSession, registerTestUser } from '../testing/auth-client';
import { makeBlankPdf, makeTextPdf } from '../testing/pdf-fixtures';
import { ScriptedLlm } from '../testing/scripted-llm';

const FIXTURES = path.resolve(__dirname, '../../test-fixtures/arjun');
const CV = '01_Arjun_Mehta_CV.pdf';
const DEGREE = '02_Arjun_Mehta_Degree_Certificate.pdf';
const TRANSCRIPT = '03_Arjun_Mehta_Academic_Transcript.pdf';
const LANGUAGE = '04_Arjun_Mehta_Language_Certificate.pdf';
const EXPERIENCE = '05_Arjun_Mehta_Experience_Letter.pdf';
const SOP = '06_Arjun_Mehta_Statement_of_Purpose.pdf';

// Fictional documents that are NOT what some upload slot will claim they are.
const ID_CARD = makeTextPdf([
  'GOVERNMENT IDENTITY CARD (FICTIONAL SAMPLE - NOT A REAL DOCUMENT)',
  'Name: Arjun Mehta',
  'Identity No: 0000 0000 0000',
  'Date of Birth: 14/02/2004',
  'Address: Sample Street, Bengaluru, Karnataka',
]);
const INVOICE = makeTextPdf(['INVOICE 2026-0042', 'Item: office chairs x 4', 'Total due: 480.00 EUR', 'Payment terms: 30 days net']);
// A real degree certificate's content with NO title heading at all.
const UNTITLED_DEGREE = makeTextPdf([
  'This is to certify that Arjun Mehta was awarded the BACHELOR OF TECHNOLOGY in Computer Science and Engineering',
  'by Riverview Institute of Technology, Bengaluru.',
  'Year of Graduation 2025',
  'Final CGPA 8.42 / 10.00',
]);
const UNTITLED_DEGREE_CLAIMS = [
  { fieldKey: 'degree.graduationYear', rawValue: '2025', quote: 'Year of Graduation 2025' },
  { fieldKey: 'degree.cgpa', rawValue: '8.42 / 10.00', quote: 'Final CGPA 8.42 / 10.00' },
];

describe('Document type validation and completeness credit (real PostgreSQL, scripted model)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  let llm: ScriptedLlm;
  let session: TestSession;
  let http: TestSession['http'];

  beforeAll(async () => {
    uploadDir = mkdtempSync(path.join(tmpdir(), 'doctype-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
    const { AppModule } = await import('../app.module');
    llm = new ScriptedLlm();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(LlmService).useValue(llm).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    session = await registerTestUser(app, 'doctype');
    http = session.http;
  });
  beforeEach(() => {
    llm.configured = true;
    llm.override = {};
    llm.extra = {};
    llm.transcriptions = [];
    llm.calls = [];
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: session.user.id } }); // cascades to applicants, documents, claims
    await app.close();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  // ------------------------------------------------------------------ helpers
  const fx = (name: string) => readFileSync(path.join(FIXTURES, name));
  async function newApplicant() {
    return (await http().post('/applicants').send({ name: 'Arjun Mehta' }).expect(201)).body.id as string;
  }
  async function upload(applicantId: string, filename: string, buffer: Buffer, slot?: string) {
    const req = http().post(`/applicants/${applicantId}/documents`);
    if (slot) req.field('docType', slot);
    return (await req.attach('file', buffer, { filename, contentType: 'application/pdf' }).expect(201)).body.id as string;
  }
  const uploadFx = (applicantId: string, name: string, slot?: string) => upload(applicantId, name, fx(name), slot);
  const scanAll = async (applicantId: string) => (await http().post(`/applicants/${applicantId}/process`).expect(200)).body;
  const journey = async (applicantId: string) => (await http().get(`/applicants/${applicantId}/journey`).expect(200)).body;
  const docs = async (applicantId: string) => (await http().get(`/applicants/${applicantId}/documents`).expect(200)).body as Array<Record<string, any>>;
  const requirement = (j: any, id: string) => j.evaluation.requirements.find((r: any) => r.requirementId === id);
  const claimsOf = async (applicantId: string, docId: string) => (await http().get(`/applicants/${applicantId}/documents/${docId}/claims?scope=all`).expect(200)).body as any[];
  const lastRun = (documentId: string) => prisma.documentRun.findFirstOrThrow({ where: { documentId }, orderBy: { version: 'desc' } });

  /** CV + transcript + language certificate as genuine documents, in their own slots. */
  async function genuineSupportingDocs(applicantId: string) {
    await uploadFx(applicantId, CV, 'CV');
    await uploadFx(applicantId, TRANSCRIPT, 'TRANSCRIPT');
    await uploadFx(applicantId, LANGUAGE, 'LANGUAGE_CERT');
  }

  /** The invariant behind every "no credit" case: the persisted evaluation is not READY. */
  const expectNotReady = (j: any) => {
    expect(j.stage).not.toBe('READY');
    expect(j.evaluation.verdict).not.toBe('READY');
    expect(j.evaluation.outcome).not.toBe('READY');
    expect(j.evaluation.score).toBeLessThan(100);
  };

  // ------------------------------------------------------------------ 1. identity card in the Degree slot
  describe('identity card uploaded into the Degree slot', () => {
    it('is rejected as a mismatch before any claim is stored, gets no credit, and the applicant is not READY', async () => {
      const applicantId = await newApplicant();
      await genuineSupportingDocs(applicantId);
      // the model reads an identity card; even if it also returned "claims", none may be stored
      llm.override['degree_certificate.pdf'] = {
        documentType: 'IDENTITY_DOCUMENT',
        claims: [
          { fieldKey: 'applicant.name', rawValue: 'Arjun Mehta', quote: 'Name: Arjun Mehta' },
          { fieldKey: 'applicant.dob', rawValue: '14/02/2004', quote: 'Date of Birth: 14/02/2004' },
        ],
      };
      const idDocId = await upload(applicantId, 'degree_certificate.pdf', ID_CARD, 'DEGREE');

      const result = await scanAll(applicantId);
      expect(result.processed.map((p: any) => p.status).sort()).toEqual(['DONE', 'DONE', 'DONE', 'FAILED']);

      // explicit, readable failure on the document
      const doc = (await docs(applicantId)).find((d) => d.id === idDocId)!;
      expect(doc).toMatchObject({ status: 'FAILED', docType: 'DEGREE' }); // docType is just the slot it was uploaded to
      expect(doc.error).toMatch(/identity document.*uploaded as a degree certificate/);

      // machine-readable reason stored with the failed run, and NO claims from it
      const run = await lastRun(idDocId);
      expect(run).toMatchObject({ status: 'FAILED', isActive: false });
      expect(run.extraction).toEqual({ rejection: { code: 'DOCUMENT_TYPE_MISMATCH', detectedType: 'IDENTITY_DOCUMENT', expectedType: 'DEGREE' } });
      expect(await claimsOf(applicantId, idDocId)).toEqual([]);
      expect(await prisma.claim.count({ where: { documentId: idDocId } })).toBe(0);

      // no credit: the Degree document is still missing, so the applicant cannot be READY
      const j = await journey(applicantId);
      expect(requirement(j, 'docs-complete')).toMatchObject({ status: 'MISSING' });
      expect(requirement(j, 'docs-complete').message).toMatch(/DEGREE/);
      expect(j.gaps.map((g: any) => g.id)).toContain('MISSING_DOC:DEGREE');
      expect(j.profile.map((f: any) => f.fieldKey)).not.toContain('applicant.dob'); // nothing from the ID card entered the profile
      expectNotReady(j);

      // the adaptive agent reasons over that persisted state and asks for the right document
      const decided = (await http().post(`/applicants/${applicantId}/agent/decide`).expect(200)).body;
      expect(decided.action).toMatchObject({ type: 'REQUEST_DOCUMENT', gapId: 'MISSING_DOC:DEGREE', params: { docType: 'DEGREE' } });
    });

    it('recovers when the genuine degree certificate is uploaded: credit appears only then', async () => {
      const applicantId = await newApplicant();
      await genuineSupportingDocs(applicantId);
      llm.override['degree_certificate.pdf'] = { documentType: 'IDENTITY_DOCUMENT', claims: [] };
      await upload(applicantId, 'degree_certificate.pdf', ID_CARD, 'DEGREE');
      await scanAll(applicantId);
      expectNotReady(await journey(applicantId));

      await uploadFx(applicantId, DEGREE, 'DEGREE');
      await scanAll(applicantId);
      const j = await journey(applicantId);
      expect(requirement(j, 'docs-complete').status).toBe('MET');
      expect(j.evaluation).toMatchObject({ verdict: 'READY', score: 100 });
      expect(j.stage).toBe('READY');
    });

    it('the file name does not matter: the same ID card named like a degree is still rejected, and re-scanning it does not help', async () => {
      const applicantId = await newApplicant();
      llm.override['Degree_Certificate_Final.pdf'] = { documentType: 'IDENTITY_DOCUMENT', claims: [] };
      const id = await upload(applicantId, 'Degree_Certificate_Final.pdf', ID_CARD, 'DEGREE');
      await scanAll(applicantId);
      const retry = await http().post(`/applicants/${applicantId}/documents/${id}/process`).expect(200);
      expect(retry.body.document.status).toBe('FAILED');
      expect(retry.body.run.rejection).toMatchObject({ code: 'DOCUMENT_TYPE_MISMATCH' });
      expect(await prisma.claim.count({ where: { applicantId } })).toBe(0);
    });
  });

  // ------------------------------------------------------------------ 2. invoice in the Language slot
  describe('invoice uploaded into the Language Certificate slot', () => {
    it('is rejected, gives no language credit, and READY is impossible', async () => {
      const applicantId = await newApplicant();
      await uploadFx(applicantId, CV, 'CV');
      await uploadFx(applicantId, DEGREE, 'DEGREE');
      await uploadFx(applicantId, TRANSCRIPT, 'TRANSCRIPT');
      llm.override['language_certificate.pdf'] = { documentType: 'OTHER', claims: [] };
      const invoiceId = await upload(applicantId, 'language_certificate.pdf', INVOICE, 'LANGUAGE_CERT');

      await scanAll(applicantId);
      const doc = (await docs(applicantId)).find((d) => d.id === invoiceId)!;
      expect(doc.status).toBe('FAILED');
      expect(doc.error).toMatch(/not one of the supported types.*uploaded as a language certificate/);
      expect((await lastRun(invoiceId)).extraction).toEqual({ rejection: { code: 'DOCUMENT_TYPE_MISMATCH', detectedType: 'OTHER', expectedType: 'LANGUAGE_CERT' } });
      expect(await claimsOf(applicantId, invoiceId)).toEqual([]);

      const j = await journey(applicantId);
      expect(requirement(j, 'language-level').status).toBe('MISSING');
      expect(requirement(j, 'docs-complete').status).toBe('MISSING');
      expect(j.gaps.map((g: any) => g.id)).toEqual(expect.arrayContaining(['MISSING_DOC:LANGUAGE_CERT']));
      expectNotReady(j);
    });

    it('with no slot at all, an unsupported document is UNSUPPORTED_DOCUMENT_TYPE and also stores nothing', async () => {
      const applicantId = await newApplicant();
      llm.override['whatever.pdf'] = { documentType: 'OTHER', claims: [] };
      const id = await upload(applicantId, 'whatever.pdf', INVOICE);
      await scanAll(applicantId);
      expect((await lastRun(id)).extraction).toMatchObject({ rejection: { code: 'UNSUPPORTED_DOCUMENT_TYPE', expectedType: null } });
      expect(await prisma.claim.count({ where: { applicantId } })).toBe(0);
    });
  });

  // ------------------------------------------------------------------ 3. degree certificate in the Transcript slot
  describe('genuine degree certificate uploaded into the Transcript slot', () => {
    it('is NOT silently relabelled: it is rejected as a mismatch, stores no claims and counts for neither slot', async () => {
      const applicantId = await newApplicant();
      await uploadFx(applicantId, CV, 'CV');
      await uploadFx(applicantId, LANGUAGE, 'LANGUAGE_CERT');
      const id = await uploadFx(applicantId, DEGREE, 'TRANSCRIPT'); // wrong slot

      await scanAll(applicantId);
      const doc = (await docs(applicantId)).find((d) => d.id === id)!;
      expect(doc).toMatchObject({ status: 'FAILED', docType: 'TRANSCRIPT' });
      expect(doc.error).toMatch(/degree certificate.*uploaded as an academic transcript/);
      expect((await lastRun(id)).extraction).toEqual({ rejection: { code: 'DOCUMENT_TYPE_MISMATCH', detectedType: 'DEGREE', expectedType: 'TRANSCRIPT' } });
      expect(await claimsOf(applicantId, id)).toEqual([]);

      const j = await journey(applicantId);
      expect(requirement(j, 'docs-complete').message).toMatch(/DEGREE/);
      expect(requirement(j, 'docs-complete').message).toMatch(/TRANSCRIPT/);
      expect(j.gaps.map((g: any) => g.id)).toEqual(expect.arrayContaining(['MISSING_DOC:DEGREE', 'MISSING_DOC:TRANSCRIPT']));
      expectNotReady(j);
    });
  });

  // ------------------------------------------------------------------ 4. classification without title text
  describe('classification when the title text is absent', () => {
    it('a degree certificate without a heading is recognised from its content and accepted in the Degree slot', async () => {
      const applicantId = await newApplicant();
      llm.override['scan_0001.pdf'] = { documentType: 'DEGREE', claims: UNTITLED_DEGREE_CLAIMS };
      const id = await upload(applicantId, 'scan_0001.pdf', UNTITLED_DEGREE, 'DEGREE');
      await scanAll(applicantId);

      const doc = (await docs(applicantId)).find((d) => d.id === id)!;
      expect(doc).toMatchObject({ status: 'DONE', docType: 'DEGREE', error: null });
      const run = await lastRun(id);
      expect(run).toMatchObject({ status: 'DONE', isActive: true });
      expect(run.extraction).toMatchObject({ detectedType: 'DEGREE', typeBasis: 'MODEL', declaredType: 'DEGREE', accepted: 2 });
      expect((await claimsOf(applicantId, id)).map((c) => c.fieldKey).sort()).toEqual(['degree.cgpa', 'degree.graduationYear']);
    });

    it('the same untitled content in the Transcript slot is a mismatch (the slot is only compared, never trusted)', async () => {
      const applicantId = await newApplicant();
      llm.override['scan_0002.pdf'] = { documentType: 'DEGREE', claims: UNTITLED_DEGREE_CLAIMS };
      const id = await upload(applicantId, 'scan_0002.pdf', UNTITLED_DEGREE, 'TRANSCRIPT');
      await scanAll(applicantId);
      expect((await lastRun(id)).extraction).toMatchObject({ rejection: { code: 'DOCUMENT_TYPE_MISMATCH', detectedType: 'DEGREE', expectedType: 'TRANSCRIPT' } });
      expect(await claimsOf(applicantId, id)).toEqual([]);
    });

    it('an untitled document uploaded without a slot is classified from its content alone (file name "passport.pdf" is irrelevant)', async () => {
      const applicantId = await newApplicant();
      llm.override['passport.pdf'] = { documentType: 'DEGREE', claims: UNTITLED_DEGREE_CLAIMS };
      const id = await upload(applicantId, 'passport.pdf', UNTITLED_DEGREE);
      await scanAll(applicantId);
      expect((await docs(applicantId)).find((d) => d.id === id)).toMatchObject({ status: 'DONE', docType: 'DEGREE' });
    });

    it('when the model cannot tell, the slot does not rescue the document: it is UNCLEAR and stores nothing', async () => {
      const applicantId = await newApplicant();
      llm.override['mystery.pdf'] = { documentType: 'UNKNOWN', claims: [] };
      const id = await upload(applicantId, 'mystery.pdf', makeTextPdf(['Some unrelated page of text that is long enough to count as text']), 'DEGREE');
      await scanAll(applicantId);
      const doc = (await docs(applicantId)).find((d) => d.id === id)!;
      expect(doc).toMatchObject({ status: 'FAILED' });
      expect(doc.error).toMatch(/could not be determined from its content/);
      expect((await lastRun(id)).extraction).toMatchObject({ rejection: { code: 'DOCUMENT_TYPE_UNCLEAR' } });
      expect(await prisma.claim.count({ where: { applicantId } })).toBe(0);
    });

    it('an almost empty page (little or no readable text) is rejected as unclear, never accepted on the slot alone', async () => {
      const applicantId = await newApplicant();
      llm.transcriptions = [[{ pageNo: 1, text: 'Page 1' }]]; // a scan whose vision transcription is practically empty
      llm.override['almost_empty.pdf'] = { documentType: 'UNKNOWN', claims: [] };
      const id = await upload(applicantId, 'almost_empty.pdf', makeBlankPdf(1), 'DEGREE');
      await scanAll(applicantId);
      expect((await docs(applicantId)).find((d) => d.id === id)).toMatchObject({ status: 'FAILED' });
      expect((await lastRun(id)).extraction).toMatchObject({ rejection: { code: 'DOCUMENT_TYPE_UNCLEAR' } });
      expect(await prisma.claim.count({ where: { applicantId } })).toBe(0);
    });

    it('a blank scan with nothing readable at all fails without claims', async () => {
      const applicantId = await newApplicant();
      llm.transcriptions = [[{ pageNo: 1, text: '   ' }]];
      const id = await upload(applicantId, 'blank.pdf', makeBlankPdf(1), 'DEGREE');
      await scanAll(applicantId);
      const doc = (await docs(applicantId)).find((d) => d.id === id)!;
      expect(doc.status).toBe('FAILED');
      expect(doc.error).toMatch(/No readable text/);
      expect(await prisma.claim.count({ where: { applicantId } })).toBe(0);
    });
  });

  // ------------------------------------------------------------------ 5. the model must back its classification with grounded evidence
  describe('a classification must be backed by grounded evidence of its own kind', () => {
    it('a model that calls an ID card a "degree certificate" but extracts only name/date of birth is rejected', async () => {
      const applicantId = await newApplicant();
      llm.override['fake_degree.pdf'] = {
        documentType: 'DEGREE',
        claims: [
          { fieldKey: 'applicant.name', rawValue: 'Arjun Mehta', quote: 'Name: Arjun Mehta' },
          { fieldKey: 'applicant.dob', rawValue: '14/02/2004', quote: 'Date of Birth: 14/02/2004' },
        ],
      };
      const id = await upload(applicantId, 'fake_degree.pdf', ID_CARD, 'DEGREE');
      await scanAll(applicantId);
      expect((await docs(applicantId)).find((d) => d.id === id)!.status).toBe('FAILED');
      expect((await lastRun(id)).extraction).toMatchObject({ rejection: { code: 'DOCUMENT_TYPE_UNCLEAR', detectedType: 'DEGREE' } });
      expect(await prisma.claim.count({ where: { applicantId } })).toBe(0);
    });

    it('a hallucinated degree claim whose quote is not in the document does not count as evidence', async () => {
      const applicantId = await newApplicant();
      llm.override['fake_degree2.pdf'] = {
        documentType: 'DEGREE',
        claims: [{ fieldKey: 'degree.cgpa', rawValue: '9.9 / 10.00', quote: 'Final CGPA 9.9 / 10.00' }], // not in the ID card text
      };
      const id = await upload(applicantId, 'fake_degree2.pdf', ID_CARD, 'DEGREE');
      await scanAll(applicantId);
      expect((await docs(applicantId)).find((d) => d.id === id)!.status).toBe('FAILED');
      expect(await prisma.claim.count({ where: { applicantId } })).toBe(0);
    });

    it('conflicting signals (title says degree, model says transcript) are UNCLEAR, not resolved in favour of the slot', async () => {
      const applicantId = await newApplicant();
      llm.override[DEGREE] = { documentType: 'TRANSCRIPT', claims: [{ fieldKey: 'degree.cgpa', rawValue: '8.42 / 10.00', quote: 'Final CGPA 8.42 / 10.00' }] };
      const id = await uploadFx(applicantId, DEGREE, 'DEGREE');
      await scanAll(applicantId);
      expect((await lastRun(id)).extraction).toMatchObject({ rejection: { code: 'DOCUMENT_TYPE_UNCLEAR' } });
      expect(await claimsOf(applicantId, id)).toEqual([]);
    });
  });

  // ------------------------------------------------------------------ 6. completeness credit
  describe('failed, pending, mismatched and unprocessed uploads give no completeness credit', () => {
    const REQUIRED = ['CV', 'DEGREE', 'TRANSCRIPT', 'LANGUAGE_CERT'];
    const missingIn = (j: any) => (requirement(j, 'docs-complete').missingDocTypes as string[]).slice().sort();

    it('uploaded but not yet scanned documents do not count', async () => {
      const applicantId = await newApplicant();
      await uploadFx(applicantId, CV, 'CV');
      await uploadFx(applicantId, DEGREE, 'DEGREE');
      await uploadFx(applicantId, TRANSCRIPT, 'TRANSCRIPT');
      await uploadFx(applicantId, LANGUAGE, 'LANGUAGE_CERT');
      await http().post(`/applicants/${applicantId}/evaluate`).expect(201); // evaluate WITHOUT scanning

      const j = await journey(applicantId);
      expect(requirement(j, 'docs-complete')).toMatchObject({ status: 'MISSING', credit: 0 });
      expect(missingIn(j)).toEqual([...REQUIRED].sort());
      expectNotReady(j);
      expect(j.documents.every((d: any) => d.status === 'UPLOADED')).toBe(true);
    });

    it('only the documents that were actually scanned count, one by one', async () => {
      const applicantId = await newApplicant();
      const cvId = await uploadFx(applicantId, CV, 'CV');
      const degreeId = await uploadFx(applicantId, DEGREE, 'DEGREE');
      await uploadFx(applicantId, TRANSCRIPT, 'TRANSCRIPT');
      await uploadFx(applicantId, LANGUAGE, 'LANGUAGE_CERT');

      await http().post(`/applicants/${applicantId}/documents/${cvId}/process`).expect(200);
      expect(missingIn(await journey(applicantId))).toEqual(['DEGREE', 'LANGUAGE_CERT', 'TRANSCRIPT']);
      await http().post(`/applicants/${applicantId}/documents/${degreeId}/process`).expect(200);
      expect(missingIn(await journey(applicantId))).toEqual(['LANGUAGE_CERT', 'TRANSCRIPT']);
    });

    it('documents whose processing FAILED give no credit and the applicant stays out of READY', async () => {
      const applicantId = await newApplicant();
      await uploadFx(applicantId, CV, 'CV');
      await uploadFx(applicantId, DEGREE, 'DEGREE');
      await uploadFx(applicantId, TRANSCRIPT, 'TRANSCRIPT');
      await uploadFx(applicantId, LANGUAGE, 'LANGUAGE_CERT');
      llm.configured = false; // extraction cannot run
      const result = await scanAll(applicantId);
      expect(result.processed.every((p: any) => p.status === 'FAILED')).toBe(true);
      expect(result.evaluation).toBeNull(); // nothing was learned, so nothing is evaluated ...
      expect((await journey(applicantId)).evaluation).toBeNull(); // ... and there is no READY to show
      expect(await prisma.claim.count({ where: { applicantId } })).toBe(0);

      await http().post(`/applicants/${applicantId}/evaluate`).expect(201); // even a forced evaluation gives no credit
      const j = await journey(applicantId);
      expect(requirement(j, 'docs-complete')).toMatchObject({ status: 'MISSING', credit: 0 });
      expect(missingIn(j)).toEqual([...REQUIRED].sort());
      expectNotReady(j);
    });

    it('a mismatched upload and a scanned genuine one are told apart: only the genuine one counts', async () => {
      const applicantId = await newApplicant();
      await uploadFx(applicantId, CV, 'CV');
      await uploadFx(applicantId, TRANSCRIPT, 'TRANSCRIPT');
      await uploadFx(applicantId, LANGUAGE, 'LANGUAGE_CERT');
      await uploadFx(applicantId, SOP, 'DEGREE'); // a statement of purpose put into the Degree slot
      await scanAll(applicantId);
      const j = await journey(applicantId);
      expect(missingIn(j)).toEqual(['DEGREE']);
      expectNotReady(j);
    });

    it('a failed RE-scan of a document that was already accepted keeps its earlier, genuine evidence', async () => {
      const applicantId = await newApplicant();
      await genuineSupportingDocs(applicantId);
      const degreeId = await uploadFx(applicantId, DEGREE, 'DEGREE');
      await scanAll(applicantId);
      expect((await journey(applicantId)).stage).toBe('READY');

      llm.configured = false;
      await http().post(`/applicants/${applicantId}/documents/${degreeId}/process?force=true`).expect(200);
      llm.configured = true;
      const j = await journey(applicantId);
      expect((await docs(applicantId)).find((d) => d.id === degreeId)!.status).toBe('FAILED'); // the attempt is reported honestly
      expect(requirement(j, 'docs-complete').status).toBe('MET'); // earlier verified evidence is never lost
    });
  });

  // ------------------------------------------------------------------ 7. READY needs the persisted evaluation
  describe('READY is only reachable through the persisted evaluation', () => {
    it('a conflict keeps the applicant out of READY even though every document is genuine', async () => {
      const applicantId = await newApplicant();
      await genuineSupportingDocs(applicantId);
      await uploadFx(applicantId, DEGREE, 'DEGREE');
      llm.override['cv_2024.pdf'] = { documentType: 'CV', claims: [{ fieldKey: 'degree.graduationYear', rawValue: '2024', quote: 'Graduation year: 2024' }] };
      await upload(applicantId, 'cv_2024.pdf', makeTextPdf(['CURRICULUM VITAE', 'Arjun Mehta', 'Graduation year: 2024']), 'CV');
      await scanAll(applicantId);

      const j = await journey(applicantId);
      expect(j.conflicts.length).toBeGreaterThan(0);
      expect(requirement(j, 'consistency').status).toBe('CONFLICT');
      expect(j.evaluation.verdict).not.toBe('READY');
      expect(j.stage).toBe('ACTION_REQUIRED');
      const decided = (await http().post(`/applicants/${applicantId}/agent/decide`).expect(200)).body;
      expect(decided.action.type).toBe('ASK_CLARIFICATION'); // the agent asks; it does not call the applicant "ready"
    });

    it('a low CGPA (mandatory requirement not met) keeps the applicant out of READY', async () => {
      const applicantId = await newApplicant();
      await genuineSupportingDocs(applicantId);
      llm.override['degree_low.pdf'] = {
        documentType: 'DEGREE',
        claims: [{ fieldKey: 'degree.cgpa', rawValue: '6.20 / 10.00', quote: 'Final CGPA 6.20 / 10.00' }],
      };
      await upload(applicantId, 'degree_low.pdf', makeTextPdf(['DEGREE CERTIFICATE', 'BACHELOR OF TECHNOLOGY', 'Final CGPA 6.20 / 10.00']), 'DEGREE');
      await scanAll(applicantId);
      const j = await journey(applicantId);
      expect(j.evaluation.verdict).not.toBe('READY');
      expect(j.stage).not.toBe('READY');
    });
  });

  // ------------------------------------------------------------------ 8. regression: normal journeys still work
  describe('regression: legitimate journeys are unaffected', () => {
    it('all six genuine documents in their own slots -> READY 100, types established from the content', async () => {
      const applicantId = await newApplicant();
      for (const [file, slot] of [[CV, 'CV'], [DEGREE, 'DEGREE'], [TRANSCRIPT, 'TRANSCRIPT'], [LANGUAGE, 'LANGUAGE_CERT'], [EXPERIENCE, 'EXPERIENCE_LETTER'], [SOP, 'SOP']]) {
        await uploadFx(applicantId, file, slot);
      }
      const result = await scanAll(applicantId);
      expect(result.processed.every((p: any) => p.status === 'DONE')).toBe(true);
      const j = await journey(applicantId);
      expect(j.evaluation).toMatchObject({ verdict: 'READY', score: 100 });
      expect(j.stage).toBe('READY');
      for (const d of j.documents) expect(d.status).toBe('DONE');
      const degreeDoc = j.documents.find((d: any) => d.docType === 'DEGREE');
      expect((await lastRun(degreeDoc.id)).extraction).toMatchObject({ typeBasis: 'TITLE_AND_MODEL', detectedType: 'DEGREE', declaredType: 'DEGREE' });
    });

    it('uploading with no slot works too: the content decides every type -> READY 100', async () => {
      const applicantId = await newApplicant();
      for (const file of [CV, DEGREE, TRANSCRIPT, LANGUAGE]) await uploadFx(applicantId, file);
      await scanAll(applicantId);
      const j = await journey(applicantId);
      expect(j.documents.map((d: any) => d.docType).sort()).toEqual(['CV', 'DEGREE', 'LANGUAGE_CERT', 'TRANSCRIPT']);
      expect(j.evaluation).toMatchObject({ verdict: 'READY', score: 100 });
    });

    it('missing language certificate -> the agent asks for it; uploading it completes the journey', async () => {
      const applicantId = await newApplicant();
      await uploadFx(applicantId, CV, 'CV');
      await uploadFx(applicantId, DEGREE, 'DEGREE');
      await uploadFx(applicantId, TRANSCRIPT, 'TRANSCRIPT');
      await scanAll(applicantId);
      const decided = (await http().post(`/applicants/${applicantId}/agent/decide`).expect(200)).body;
      expect(decided.action).toMatchObject({ type: 'REQUEST_DOCUMENT', params: { docType: 'LANGUAGE_CERT' } });
      await uploadFx(applicantId, LANGUAGE, 'LANGUAGE_CERT');
      await scanAll(applicantId);
      expect((await journey(applicantId)).stage).toBe('READY');
    });
  });

  // ------------------------------------------------------------------ 9. stale runs: a definitive rejection retires old evidence
  describe('an earlier successful run does not survive a definitive rejection of the same document', () => {
    const runStates = async (documentId: string) =>
      (await prisma.documentRun.findMany({ where: { documentId }, orderBy: { version: 'asc' } })).map((r) => ({ v: r.version, status: r.status, active: r.isActive }));
    const activeClaimsOf = async (applicantId: string, docId: string) =>
      (await http().get(`/applicants/${applicantId}/documents/${docId}/claims`).expect(200)).body as any[];
    const evalCount = (applicantId: string) => prisma.evaluation.count({ where: { applicantId } });

    /** A fully READY journey whose Degree document was accepted by an earlier run (as under the old rules). */
    async function readyJourney() {
      const applicantId = await newApplicant();
      await genuineSupportingDocs(applicantId);
      const degreeId = await uploadFx(applicantId, DEGREE, 'DEGREE');
      await scanAll(applicantId);
      expect((await journey(applicantId)).stage).toBe('READY');
      return { applicantId, degreeId };
    }
    const nowIdentityCard = () => {
      llm.override[DEGREE] = { documentType: 'IDENTITY_DOCUMENT', claims: [] };
    };

    it('old DONE run + forced re-scan rejected as a mismatch: stale claims and credit are gone, history is kept, a new evaluation is stored', async () => {
      const { applicantId, degreeId } = await readyJourney();
      const before = await evalCount(applicantId);
      const oldClaims = await prisma.claim.count({ where: { documentId: degreeId } });
      expect(oldClaims).toBeGreaterThan(0);

      nowIdentityCard();
      const res = await http().post(`/applicants/${applicantId}/documents/${degreeId}/process?force=true`).expect(200);
      expect(res.body.document.status).toBe('FAILED');
      expect(res.body.run).toMatchObject({ status: 'FAILED', rejection: { code: 'DOCUMENT_TYPE_MISMATCH' }, evidenceRetired: true });
      expect(res.body.evaluation).toBeTruthy(); // evaluation refreshed
      expect(res.body.stage).not.toBe('READY');

      // the old run is retired, not deleted; its claims remain as history
      expect(await runStates(degreeId)).toEqual([{ v: 1, status: 'DONE', active: false }, { v: 2, status: 'FAILED', active: false }]);
      expect(await prisma.claim.count({ where: { documentId: degreeId } })).toBe(oldClaims);
      expect(await activeClaimsOf(applicantId, degreeId)).toEqual([]); // no current claims (default scope is active only)
      const history = (await http().get(`/applicants/${applicantId}/documents/${degreeId}/claims?scope=all`).expect(200)).body as any[];
      expect(history.length).toBe(oldClaims);

      // qualification no longer sees them
      const j = await journey(applicantId);
      expect(await evalCount(applicantId)).toBe(before + 1);
      expect(requirement(j, 'docs-complete')).toMatchObject({ status: 'MISSING' });
      expect(j.gaps.map((g: any) => g.id)).toContain('MISSING_DOC:DEGREE');
      expectNotReady(j);
      const current = (await http().get(`/applicants/${applicantId}/claims`).expect(200)).body as any[];
      expect(current.length).toBeGreaterThan(0); // other documents still provide evidence
      expect(current.some((c) => c.documentId === degreeId)).toBe(false); // none of it comes from the retired run
    });

    it('batch endpoint: a FAILED document that still had an active run, retried and now definitively rejected, triggers one refreshed evaluation', async () => {
      const { applicantId, degreeId } = await readyJourney();
      llm.configured = false; // transient failure first: the valid evidence must survive it
      await http().post(`/applicants/${applicantId}/documents/${degreeId}/process?force=true`).expect(200);
      llm.configured = true;
      expect((await docs(applicantId)).find((d) => d.id === degreeId)!.status).toBe('FAILED');
      expect((await journey(applicantId)).evaluation.verdict).toBe('READY');
      const before = await evalCount(applicantId);

      nowIdentityCard();
      const result = await scanAll(applicantId); // picks up the FAILED document
      expect(result.processed).toEqual([expect.objectContaining({ documentId: degreeId, status: 'FAILED' })]);
      expect(result.evaluation).toBeTruthy(); // evaluated even though no document reached DONE
      expect(await evalCount(applicantId)).toBe(before + 1);
      expect((await runStates(degreeId)).some((r) => r.active)).toBe(false);
      expectNotReady(await journey(applicantId));
    });

    it('a transient failure (model unavailable) keeps the previous evidence, run and READY evaluation, and creates no new evaluation', async () => {
      const { applicantId, degreeId } = await readyJourney();
      const before = await evalCount(applicantId);
      llm.configured = false;
      const res = await http().post(`/applicants/${applicantId}/documents/${degreeId}/process?force=true`).expect(200);
      llm.configured = true;
      expect(res.body.run).toMatchObject({ status: 'FAILED', evidenceRetired: false });
      expect(res.body.run.rejection).toBeUndefined();
      expect(res.body.evaluation).toBeNull();
      expect(await runStates(degreeId)).toEqual([{ v: 1, status: 'DONE', active: true }, { v: 2, status: 'FAILED', active: false }]);
      expect((await activeClaimsOf(applicantId, degreeId)).length).toBeGreaterThan(0);
      expect(await evalCount(applicantId)).toBe(before);
      const j = await journey(applicantId);
      expect(requirement(j, 'docs-complete').status).toBe('MET');
      expect(j.stage).toBe('READY');
    });

    it('is idempotent: retrying the same rejection changes nothing further', async () => {
      const { applicantId, degreeId } = await readyJourney();
      nowIdentityCard();
      await http().post(`/applicants/${applicantId}/documents/${degreeId}/process?force=true`).expect(200);
      const evals = await evalCount(applicantId);
      const retry = await http().post(`/applicants/${applicantId}/documents/${degreeId}/process`).expect(200);
      expect(retry.body.run).toMatchObject({ status: 'FAILED', evidenceRetired: false }); // nothing left to retire
      expect(retry.body.evaluation).toBeNull();
      expect(await evalCount(applicantId)).toBe(evals);
      expect((await runStates(degreeId)).filter((r) => r.active)).toEqual([]);
      expect(await prisma.claim.count({ where: { documentId: degreeId } })).toBeGreaterThan(0); // history intact
    });

    it('concurrent forced re-scans leave a consistent state: no active run, no current claims, not READY', async () => {
      const { applicantId, degreeId } = await readyJourney();
      nowIdentityCard();
      const [a, b] = await Promise.all([
        http().post(`/applicants/${applicantId}/documents/${degreeId}/process?force=true`),
        http().post(`/applicants/${applicantId}/documents/${degreeId}/process?force=true`),
      ]);
      expect([a.status, b.status].every((s) => s === 200 || s === 409)).toBe(true);
      expect([a.status, b.status]).toContain(200);
      expect((await runStates(degreeId)).filter((r) => r.active)).toEqual([]);
      expect(await activeClaimsOf(applicantId, degreeId)).toEqual([]);
      await http().post(`/applicants/${applicantId}/evaluate`).expect(201);
      expectNotReady(await journey(applicantId));
    });

    it('a rejected document that had NO earlier run has nothing to retire and triggers no evaluation', async () => {
      const applicantId = await newApplicant();
      llm.override['id.pdf'] = { documentType: 'IDENTITY_DOCUMENT', claims: [] };
      const id = await upload(applicantId, 'id.pdf', ID_CARD, 'DEGREE');
      const res = await http().post(`/applicants/${applicantId}/documents/${id}/process`).expect(200);
      expect(res.body.run).toMatchObject({ status: 'FAILED', evidenceRetired: false });
      expect(res.body.evaluation).toBeNull();
    });
  });
});
