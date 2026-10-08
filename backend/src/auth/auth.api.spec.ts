// Authentication and authorization against the REAL PostgreSQL: accounts, passwords, tokens, and
// the rule that an account can only touch its own applicant. The LLM is the scripted stand-in.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { TEST_PASSWORD, TestSession, registerTestUser } from '../testing/auth-client';
import { ScriptedLlm } from '../testing/scripted-llm';

const CV = path.resolve(__dirname, '../../test-fixtures/arjun/01_Arjun_Mehta_CV.pdf');
const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const MESSAGE_BAD_LOGIN = 'Invalid email or password';

describe('Authentication & ownership (real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let uploadDir: string;
  let alice: TestSession;
  let bob: TestSession;
  let aliceApplicantId: string;
  let aliceDocId: string;
  let aliceClarificationId: string;
  const extraUsers: string[] = [];

  const anon = () => request(app.getHttpServer());

  beforeAll(async () => {
    uploadDir = mkdtempSync(path.join(tmpdir(), 'auth-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
    const { AppModule } = await import('../app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(LlmService).useValue(new ScriptedLlm()).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    alice = await registerTestUser(app, 'alice');
    bob = await registerTestUser(app, 'bob');

    // Alice owns an applicant with a document and a clarification
    aliceApplicantId = (await alice.http().post('/applicants').send({ name: 'Alice Applicant', email: 'alice.applicant@example.com' }).expect(201)).body.id;
    aliceDocId = (
      await alice.http().post(`/applicants/${aliceApplicantId}/documents`).attach('file', readFileSync(CV), { filename: 'cv.pdf', contentType: 'application/pdf' }).expect(201)
    ).body.id;
    aliceClarificationId = (await prisma.clarification.create({ data: { applicantId: aliceApplicantId, prompt: 'Which year?' } })).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [alice.user.id, bob.user.id, ...extraUsers] } } }); // cascades to applicants
    await prisma.applicant.deleteMany({ where: { userId: null, name: 'Legacy Applicant' } });
    await app.close();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  // ------------------------------------------------------------------ registration
  describe('registration', () => {
    it('creates an account, returns a token, and never returns or stores the password', async () => {
      const email = `Mixed.Case-${Date.now()}@Test.Example`;
      const res = await anon().post('/auth/register').send({ name: '  Rita Register ', email, password: TEST_PASSWORD }).expect(201);
      extraUsers.push(res.body.user.id);

      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user).toEqual({ id: expect.any(String), name: 'Rita Register', email: email.toLowerCase(), applicantId: null });
      expect(JSON.stringify(res.body)).not.toMatch(/password|hash|\$2[aby]\$/i);

      const row = await prisma.user.findUniqueOrThrow({ where: { id: res.body.user.id } });
      expect(row.email).toBe(email.toLowerCase());
      expect(row.passwordHash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, cost 12
      expect(row.passwordHash).not.toContain(TEST_PASSWORD);
      expect(await bcrypt.compare(TEST_PASSWORD, row.passwordHash)).toBe(true);

      // the token works, and the email is case-insensitive for sign-in
      await anon().get('/auth/me').set('Authorization', `Bearer ${res.body.token}`).expect(200);
      await anon().post('/auth/login').send({ email: email.toLowerCase(), password: TEST_PASSWORD }).expect(200);
    });

    it('rejects a duplicate email (case-insensitive) with 409 and keeps the original password', async () => {
      const email = `dup-${Date.now()}@test.example`;
      const first = await anon().post('/auth/register').send({ name: 'First', email, password: TEST_PASSWORD }).expect(201);
      extraUsers.push(first.body.user.id);
      await anon().post('/auth/register').send({ name: 'Second', email: email.toUpperCase(), password: 'Another-pass-123' }).expect(409);
      await anon().post('/auth/login').send({ email, password: TEST_PASSWORD }).expect(200);
      await anon().post('/auth/login').send({ email, password: 'Another-pass-123' }).expect(401);
    });

    it.each([
      ['an invalid email', { name: 'X', email: 'not-an-email', password: TEST_PASSWORD }],
      ['a password shorter than 8 characters', { name: 'X', email: 'short@test.example', password: 'abc1234' }],
      ['a password longer than bcrypt can use (72)', { name: 'X', email: 'long@test.example', password: 'a'.repeat(73) }],
      ['a missing name', { email: 'noname@test.example', password: TEST_PASSWORD }],
      ['a missing password', { name: 'X', email: 'nopass@test.example' }],
    ])('rejects %s with 400 and creates nothing', async (_n, body) => {
      await anon().post('/auth/register').send(body).expect(400);
      // (checked by email, not by a global count: other test files create accounts in parallel)
      expect(await prisma.user.findUnique({ where: { email: (body as { email: string }).email } })).toBeNull();
    });

    it('ignores fields a client should not control (such as an id)', async () => {
      const email = `extra-${Date.now()}@test.example`;
      const res = await anon().post('/auth/register').send({ name: 'Extra', email, password: TEST_PASSWORD, id: MISSING_ID, role: 'admin' }).expect(201);
      extraUsers.push(res.body.user.id);
      expect(res.body.user.id).not.toBe(MISSING_ID);
    });
  });

  // ------------------------------------------------------------------ login
  describe('login', () => {
    it('signs in with the right credentials and issues a signed token for that account', async () => {
      const res = await anon().post('/auth/login').send({ email: alice.user.email, password: TEST_PASSWORD }).expect(200);
      expect(res.body.user).toMatchObject({ id: alice.user.id, email: alice.user.email, applicantId: aliceApplicantId });
      const payload = await jwt.verifyAsync<{ sub: string; exp: number; iat: number }>(res.body.token);
      expect(payload.sub).toBe(alice.user.id);
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('rejects a wrong password with 401 and the same message as an unknown account', async () => {
      const wrong = await anon().post('/auth/login').send({ email: alice.user.email, password: 'Not-the-password-1' }).expect(401);
      const unknown = await anon().post('/auth/login').send({ email: `nobody-${Date.now()}@test.example`, password: TEST_PASSWORD }).expect(401);
      expect(wrong.body.message).toBe(MESSAGE_BAD_LOGIN);
      expect(unknown.body.message).toBe(MESSAGE_BAD_LOGIN); // does not reveal which emails exist
      expect(wrong.body.token).toBeUndefined();
    });

    it('never creates an account or logs anyone in just because an email and some password were typed', async () => {
      const email = `ghost-${Date.now()}@test.example`;
      await anon().post('/auth/login').send({ email, password: 'whatever-123' }).expect(401);
      // the old mock accepted any email with a 6+ character password, and a built-in demo account
      await anon().post('/auth/login').send({ email: 'rahul.sharma@example.com', password: 'germany2025' }).expect(401);
      await anon().post('/auth/login').send({ email: alice.user.email, password: 'germany2025' }).expect(401);
      for (const e of [email, 'rahul.sharma@example.com']) {
        expect(await prisma.user.findUnique({ where: { email: e } })).toBeNull(); // nothing was auto-registered
      }
    });

    it.each([
      ['no body', {}],
      ['an empty password', { email: 'a@test.example', password: '' }],
      ['an invalid email', { email: 'nope', password: 'x' }],
    ])('rejects %s with 400', async (_n, body) => {
      await anon().post('/auth/login').send(body).expect(400);
    });
  });

  // ------------------------------------------------------------------ authentication (401)
  describe('unauthenticated and invalid-token requests', () => {
    const routes: Array<[string, string]> = [
      ['get', '/auth/me'],
      ['post', '/applicants'],
      ['get', `/applicants/${MISSING_ID}`],
      ['put', `/applicants/${MISSING_ID}/goal`],
      ['get', `/applicants/${MISSING_ID}/documents`],
      ['post', `/applicants/${MISSING_ID}/documents`],
      ['get', `/applicants/${MISSING_ID}/documents/${MISSING_ID}/claims`],
      ['get', `/applicants/${MISSING_ID}/documents/${MISSING_ID}/runs`],
      ['post', `/applicants/${MISSING_ID}/documents/${MISSING_ID}/process`],
      ['post', `/applicants/${MISSING_ID}/process`],
      ['post', `/applicants/${MISSING_ID}/evaluate`],
      ['get', `/applicants/${MISSING_ID}/journey`],
      ['get', `/applicants/${MISSING_ID}/gaps`],
      ['get', `/applicants/${MISSING_ID}/claims`],
      ['get', `/applicants/${MISSING_ID}/evaluations`],
      ['get', `/applicants/${MISSING_ID}/evaluations/latest`],
      ['get', `/applicants/${MISSING_ID}/evaluations/${MISSING_ID}`],
      ['get', `/applicants/${MISSING_ID}/evaluations/${MISSING_ID}/replay`],
      ['get', `/applicants/${MISSING_ID}/clarifications`],
      ['get', `/applicants/${MISSING_ID}/clarifications/${MISSING_ID}`],
      ['post', `/applicants/${MISSING_ID}/clarifications/${MISSING_ID}/answer`],
      ['post', `/applicants/${MISSING_ID}/agent/decide`],
      ['get', `/applicants/${MISSING_ID}/agent/next-action`],
      ['get', `/applicants/${MISSING_ID}/agent/actions`],
    ];
    const call = (method: string, url: string) => (anon() as unknown as Record<string, (u: string) => request.Test>)[method](url);

    it.each(routes)('401 without a token: %s %s', async (method, url) => {
      await call(method, url).send({}).expect(401);
    });

    it('401 for a malformed Authorization header, a garbage token, or a non-bearer scheme', async () => {
      for (const header of ['Bearer', 'Bearer not.a.jwt', 'Basic YWxpY2U6cGFzcw==', 'bearer', alice.token]) {
        await anon().get('/auth/me').set('Authorization', header).expect(401);
      }
    });

    it('401 for a token signed with a different secret', async () => {
      const forged = await new JwtService({ secret: 'x'.repeat(48) }).signAsync({ sub: alice.user.id });
      await anon().get(`/applicants/${aliceApplicantId}`).set('Authorization', `Bearer ${forged}`).expect(401);
    });

    it('401 for an expired token', async () => {
      const expired = await jwt.signAsync({ sub: alice.user.id }, { expiresIn: -60 });
      await anon().get('/auth/me').set('Authorization', `Bearer ${expired}`).expect(401);
    });

    it('401 for an unsigned ("alg: none") token claiming to be Alice', async () => {
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: alice.user.id })}.`;
      await anon().get(`/applicants/${aliceApplicantId}`).set('Authorization', `Bearer ${unsigned}`).expect(401);
    });

    it('401 for a validly signed token whose account no longer exists', async () => {
      const gone = await anon().post('/auth/register').send({ name: 'Gone', email: `gone-${Date.now()}@test.example`, password: TEST_PASSWORD }).expect(201);
      await prisma.user.delete({ where: { id: gone.body.user.id } });
      await anon().get('/auth/me').set('Authorization', `Bearer ${gone.body.token}`).expect(401);
    });

    it('keeps /health, /auth/register and /auth/login public', async () => {
      await anon().get('/health').expect(200);
      await anon().post('/auth/login').send({ email: 'a@test.example', password: 'x' }).expect(401); // reached the handler
    });
  });

  // ------------------------------------------------------------------ authorization (403)
  describe('an account can only use its own applicant', () => {
    const own = () => aliceApplicantId;
    const cases = (): Array<[string, string, string]> => [
      ['get', `/applicants/${own()}`, 'applicant'],
      ['put', `/applicants/${own()}/goal`, 'set goal'],
      ['get', `/applicants/${own()}/documents`, 'list documents'],
      ['post', `/applicants/${own()}/documents`, 'upload document'],
      ['get', `/applicants/${own()}/documents/${aliceDocId}/claims`, 'document claims'],
      ['get', `/applicants/${own()}/documents/${aliceDocId}/runs`, 'document runs'],
      ['post', `/applicants/${own()}/documents/${aliceDocId}/process`, 'process one document'],
      ['post', `/applicants/${own()}/process`, 'process all'],
      ['post', `/applicants/${own()}/evaluate`, 'evaluate'],
      ['get', `/applicants/${own()}/journey`, 'journey'],
      ['get', `/applicants/${own()}/gaps`, 'gaps'],
      ['get', `/applicants/${own()}/claims`, 'claims'],
      ['get', `/applicants/${own()}/evaluations`, 'evaluation history'],
      ['get', `/applicants/${own()}/evaluations/latest`, 'latest evaluation'],
      ['get', `/applicants/${own()}/evaluations/${MISSING_ID}`, 'one evaluation'],
      ['get', `/applicants/${own()}/evaluations/${MISSING_ID}/replay`, 'replay'],
      ['get', `/applicants/${own()}/clarifications`, 'list clarifications'],
      ['get', `/applicants/${own()}/clarifications/${aliceClarificationId}`, 'one clarification'],
      ['post', `/applicants/${own()}/clarifications/${aliceClarificationId}/answer`, 'answer clarification'],
      ['post', `/applicants/${own()}/agent/decide`, 'agent decide'],
      ['get', `/applicants/${own()}/agent/next-action`, 'next action'],
      ['get', `/applicants/${own()}/agent/actions`, 'agent history'],
    ];
    const send = (s: TestSession, method: string, url: string) =>
      (s.http() as unknown as Record<string, (u: string) => request.Test>)[method](url).send({ goal: 'hijacked', text: 'hijacked' });

    it('403 on every applicant route when another signed-in account asks (Bob -> Alice)', async () => {
      for (const [method, url, label] of cases()) {
        const res = await send(bob, method, url);
        expect({ label, status: res.status }).toEqual({ label, status: 403 });
        expect(res.body.message).toBe('You do not have access to this applicant');
      }
    });

    it('Bob changed nothing of Alice’s', async () => {
      const applicant = await prisma.applicant.findUniqueOrThrow({ where: { id: aliceApplicantId } });
      expect(applicant.goal).toBeNull();
      expect(await prisma.document.count({ where: { applicantId: aliceApplicantId } })).toBe(1);
      expect(await prisma.evaluation.count({ where: { applicantId: aliceApplicantId } })).toBe(0);
      expect(await prisma.agentAction.count({ where: { applicantId: aliceApplicantId } })).toBe(0);
      const q = await prisma.clarification.findUniqueOrThrow({ where: { id: aliceClarificationId } });
      expect(q).toMatchObject({ status: 'OPEN', answer: null });
    });

    it('Alice can use the same routes on her own applicant', async () => {
      for (const [method, url] of [
        ['get', `/applicants/${own()}`],
        ['get', `/applicants/${own()}/documents`],
        ['get', `/applicants/${own()}/journey`],
        ['get', `/applicants/${own()}/clarifications/${aliceClarificationId}`],
        ['get', `/applicants/${own()}/agent/next-action`],
      ]) {
        const res = await send(alice, method, url);
        expect({ url, status: res.status }).toEqual({ url, status: 200 });
      }
      const goal = await alice.http().put(`/applicants/${own()}/goal`).send({ goal: "Master's in Germany" }).expect(200);
      expect(goal.body.goal).toBe("Master's in Germany");
    });

    it('a signed-in user gets 404 for an unknown applicant and 400 for a malformed id (not a 403 or a crash)', async () => {
      await bob.http().get(`/applicants/${MISSING_ID}`).expect(404);
      await bob.http().get('/applicants/not-a-uuid').expect(400);
    });

    it('ownership is taken from the token: a body that names another owner is ignored', async () => {
      const res = await bob.http().post('/applicants').send({ name: 'Bob Applicant', userId: alice.user.id, owner: alice.user.id }).expect(201);
      const row = await prisma.applicant.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.userId).toBe(bob.user.id);
      await alice.http().get(`/applicants/${res.body.id}`).expect(403);
      await bob.http().get(`/applicants/${res.body.id}`).expect(200);
    });

    it('Bob cannot use Alice’s clarification or document through his own applicant either', async () => {
      const bobApplicantId = (await bob.http().post('/applicants').send({ name: 'Bob Two' }).expect(201)).body.id;
      await bob.http().get(`/applicants/${bobApplicantId}/clarifications/${aliceClarificationId}`).expect(404);
      await bob.http().post(`/applicants/${bobApplicantId}/clarifications/${aliceClarificationId}/answer`).send({ text: 'hijacked' }).expect(404);
      await bob.http().post(`/applicants/${bobApplicantId}/documents/${aliceDocId}/process`).expect(404);
      expect((await prisma.clarification.findUniqueOrThrow({ where: { id: aliceClarificationId } })).status).toBe('OPEN');
    });

    it('applicants created before accounts existed (no owner) are reachable by nobody', async () => {
      const legacy = await prisma.applicant.create({ data: { name: 'Legacy Applicant' } });
      await alice.http().get(`/applicants/${legacy.id}`).expect(403);
      await bob.http().get(`/applicants/${legacy.id}`).expect(403);
      await anon().get(`/applicants/${legacy.id}`).expect(401);
    });

    it('GET /auth/me reports the signed-in account and the applicant it owns', async () => {
      const me = await alice.http().get('/auth/me').expect(200);
      expect(me.body).toEqual({ id: alice.user.id, name: alice.user.name, email: alice.user.email, applicantId: aliceApplicantId });
      expect(JSON.stringify(me.body)).not.toMatch(/password|hash/i);
    });
  });
});
