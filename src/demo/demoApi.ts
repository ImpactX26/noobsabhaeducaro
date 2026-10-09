/**
 * DEMO MODE: an in-browser SIMULATION of the SIEG.AI backend. It answers the same interface as the real client
 * (src/services/api.ts) so every screen works unchanged.
 *
 * What this is NOT:
 *  - not Gemini and not the NestJS backend: nothing is read from your files, nothing leaves the browser;
 *  - not real authentication: there are no accounts, any input enters one fixed fictional session;
 *  - not real results: every fact below is FICTIONAL SAMPLE DATA, chosen by document type, and the "agent" is a
 *    few fixed rules. Same input, same output, every time.
 *
 * Nothing here can reach a real backend, so it cannot expose or weaken real data, tokens or keys.
 */
import { ApiError } from '../services/apiError';
import type {
  AgentAction,
  AgentView,
  AnswerResult,
  AuthAccount,
  BackendDocStatus,
  BackendDocType,
  BackendStage,
  Clarification,
  DocumentRecord,
  Evaluation,
  Evidence,
  EvidenceState,
  Gap,
  Journey,
  JourneyConflict,
  ProcessResult,
  ProfileField,
  RequirementResult,
} from '../services/api';

export const DEMO_TOKEN = 'demo-session';
const APPLICANT_ID = 'demo-applicant';
const USER: AuthAccount = {
  id: 'demo-user',
  name: 'Demo Applicant (sample)',
  email: 'demo.applicant@example.invalid',
  applicantId: null,
};
export const DEMO_DISCLAIMER =
  'DEMO MODE: simulated results from fictional sample data. Not produced by Gemini or the live backend. Requirements are DEMO configuration, not official criteria.';

const REQUIRED: BackendDocType[] = ['CV', 'DEGREE', 'TRANSCRIPT', 'LANGUAGE_CERT'];
const LABEL: Record<string, string> = {
  CV: 'CV',
  DEGREE: 'Degree Certificate',
  TRANSCRIPT: 'Marksheet',
  LANGUAGE_CERT: 'Language Certificate',
  EXPERIENCE_LETTER: 'Experience Letter',
  SOP: 'Statement of Purpose',
};
const delay = (ms = 450) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ fictional sample facts, by document type

interface Fact {
  fieldKey: string;
  label: string;
  raw: string;
  page: number;
  quote: string;
}
const FIELD_LABEL: Record<string, string> = {
  'degree.level': 'Degree level',
  'degree.field': 'Degree field',
  'degree.institution': 'Institution',
  'degree.graduationYear': 'Graduation year',
  'degree.cgpa': 'CGPA',
  'language.test': 'Language test',
  'language.overall': 'Overall language score',
  'experience.employer': 'Employer',
  'experience.role': 'Role',
  'experience.totalMonths': 'Total experience (months)',
};
const f = (fieldKey: string, raw: string, quote: string, page = 1): Fact => ({ fieldKey, label: FIELD_LABEL[fieldKey], raw, page, quote });

/** The sample applicant's CV says 2024 and the degree certificate says 2025: the deliberate conflict to resolve. */
const FACTS: Record<string, Fact[]> = {
  CV: [
    f('degree.level', 'Bachelor of Technology', 'B.Tech, Computer Science and Engineering'),
    f('degree.field', 'Computer Science and Engineering', 'B.Tech, Computer Science and Engineering'),
    f('degree.graduationYear', '2024', 'Graduated 2024'),
    f('experience.employer', 'Northstar Systems (sample)', 'Software Engineer, Northstar Systems (sample)'),
  ],
  DEGREE: [
    f('degree.level', 'Bachelor of Technology', 'awarded the BACHELOR OF TECHNOLOGY'),
    f('degree.field', 'Computer Science and Engineering', 'in Computer Science and Engineering'),
    f('degree.institution', 'Riverview Institute of Technology (sample)', 'Riverview Institute of Technology (sample)'),
    f('degree.graduationYear', '2025', 'Year of Graduation 2025'),
  ],
  TRANSCRIPT: [
    f('degree.cgpa', '8.42 / 10.00', 'Final CGPA 8.42 / 10.00'),
    f('degree.institution', 'Riverview Institute of Technology (sample)', 'Riverview Institute of Technology (sample)'),
  ],
  LANGUAGE_CERT: [
    f('language.test', 'IELTS Academic (sample)', 'ENGLISH LANGUAGE TEST REPORT (sample)'),
    f('language.overall', '7.0', 'Overall Band Score 7.0'),
  ],
  EXPERIENCE_LETTER: [
    f('experience.role', 'Software Engineer', 'worked as Software Engineer'),
    f('experience.totalMonths', '30', 'for a period of 30 months'),
  ],
  SOP: [],
};

/** Demo rule for document-type validation: names that suggest a non-qualifying document are rejected. */
const NON_QUALIFYING = /(passport|aadhaar|aadhar|identity|\bid[-_. ]?card|\bid\b|invoice|receipt)/i;

// ------------------------------------------------------------------ state

interface DemoDoc {
  id: string;
  filename: string;
  docType: BackendDocType;
  status: BackendDocStatus;
  error: string | null;
}
interface DemoState {
  signedIn: boolean;
  applicant: { name: string; email: string | null; goal: string | null; programLabel: string | null } | null;
  docs: DemoDoc[];
  evaluations: Array<{ score: number; verdict: string; outcome: BackendStage }>;
  gradYearAnswer: string | null;
  seq: number;
}
const KEY = 'sieg_demo_state_v1';
const fresh = (): DemoState => ({ signedIn: false, applicant: null, docs: [], evaluations: [], gradYearAnswer: null, seq: 0 });

let memory: DemoState | null = null;
function load(): DemoState {
  if (memory) return memory;
  try {
    const raw = sessionStorage.getItem(KEY);
    memory = raw ? (JSON.parse(raw) as DemoState) : fresh();
  } catch {
    memory = fresh();
  }
  return memory;
}
function save(s: DemoState) {
  memory = s;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: the demo then lasts until the page closes */
  }
}
export function resetDemo() {
  memory = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

const requireSession = (s: DemoState) => {
  if (!s.signedIn) throw new ApiError('Demo session ended. Please enter the demo again.', 401);
};
const requireApplicant = (s: DemoState, id: string) => {
  requireSession(s);
  if (!s.applicant || id !== APPLICANT_ID) throw new ApiError('Applicant not found (demo)', 404);
  return s.applicant;
};
const iso = (n: number) => new Date(Date.UTC(2026, 0, 1, 9, n)).toISOString(); // fixed clock: deterministic output

// ------------------------------------------------------------------ derivation (pure functions of the state)

/** The latest successfully processed document of each type. */
const doneByType = (s: DemoState) => {
  const m = new Map<string, DemoDoc>();
  for (const d of s.docs) if (d.status === 'DONE') m.set(d.docType, d);
  return m;
};

function evidenceOf(doc: DemoDoc, fact: Fact): Evidence {
  return {
    claimId: `demo-claim-${doc.docType}-${fact.fieldKey}`,
    source: 'DOCUMENT',
    documentId: doc.id,
    documentType: doc.docType,
    page: fact.page,
    quote: fact.quote,
    rawValue: fact.raw,
  };
}

function buildProfile(s: DemoState): ProfileField[] {
  const byField = new Map<string, Array<{ doc: DemoDoc; fact: Fact }>>();
  for (const [type, doc] of doneByType(s)) {
    for (const fact of FACTS[type] ?? []) byField.set(fact.fieldKey, [...(byField.get(fact.fieldKey) ?? []), { doc, fact }]);
  }
  const fields: ProfileField[] = [];
  for (const [fieldKey, items] of byField) {
    const distinct = [...new Set(items.map((i) => i.fact.raw.toLowerCase()))];
    const base = { id: `demo-field-${fieldKey}`, fieldKey, label: FIELD_LABEL[fieldKey], entryKey: null };
    if (distinct.length > 1 && s.gradYearAnswer && fieldKey === 'degree.graduationYear') {
      // resolved by the applicant's answer: only the matching document evidence plus their own confirmation
      const chosen = items.filter((i) => i.fact.raw === s.gradYearAnswer);
      fields.push({
        ...base,
        state: 'APPLICANT_PROVIDED',
        value: s.gradYearAnswer,
        resolved: true,
        conflictOptions: null,
        evidence: [
          ...chosen.map((i) => evidenceOf(i.doc, i.fact)),
          { claimId: 'demo-claim-applicant-gradyear', source: 'APPLICANT', documentId: null, documentType: null, page: null, quote: null, rawValue: s.gradYearAnswer },
        ],
      });
    } else if (distinct.length > 1) {
      fields.push({
        ...base,
        state: 'CONFLICT',
        value: null,
        resolved: false,
        evidence: items.map((i) => evidenceOf(i.doc, i.fact)),
        conflictOptions: items.map((i) => ({ value: i.fact.raw, sources: [i.doc.docType], evidence: [evidenceOf(i.doc, i.fact)] })),
      });
    } else {
      fields.push({
        ...base,
        state: 'DOCUMENT_SUPPORTED' as EvidenceState,
        value: items[0].fact.raw.toLowerCase(),
        resolved: false,
        conflictOptions: null,
        evidence: items.map((i) => evidenceOf(i.doc, i.fact)),
      });
    }
  }
  return fields;
}

const claimIds = (profile: ProfileField[], ...keys: string[]) => profile.filter((p) => keys.includes(p.fieldKey)).flatMap((p) => p.evidence.map((e) => e.claimId));

function buildRequirements(s: DemoState, profile: ProfileField[]): RequirementResult[] {
  const get = (k: string) => profile.find((p) => p.fieldKey === k);
  const raw = (k: string) => get(k)?.evidence.find((e) => e.source === 'DOCUMENT')?.rawValue;
  const done = doneByType(s);
  const missingDocs = REQUIRED.filter((t) => !done.has(t));
  const conflict = profile.find((p) => p.state === 'CONFLICT');
  const cgpa = parseFloat(raw('degree.cgpa') ?? '');
  const lang = parseFloat(raw('language.overall') ?? '');
  const mk = (requirementId: string, title: string, ok: boolean | 'conflict', metMsg: string, missMsg: string, keys: string[]): RequirementResult => ({
    requirementId,
    title,
    mandatory: true,
    status: ok === true ? 'MET' : ok === 'conflict' ? 'CONFLICT' : 'MISSING',
    evidenceState: ok === true ? 'DOCUMENT_SUPPORTED' : ok === 'conflict' ? 'CONFLICT' : 'MISSING',
    message: ok === true ? metMsg : missMsg,
    claimIds: claimIds(profile, ...keys),
  });
  return [
    mk('degree-level', "Completed bachelor's degree", Boolean(raw('degree.level')), `${raw('degree.level')} found in your documents.`, 'No degree information has been verified yet.', ['degree.level']),
    mk(
      'field-relevance',
      'Degree field relevant to Computer Science',
      /computer science/i.test(raw('degree.field') ?? ''),
      `${raw('degree.field')} matches the demo field list.`,
      'No degree field has been verified yet.',
      ['degree.field'],
    ),
    mk('gpa-min', 'Minimum CGPA of 7.0 / 10', cgpa >= 7, `CGPA ${raw('degree.cgpa')} meets the minimum of 7.0.`, 'No CGPA has been verified yet (upload your marksheet).', ['degree.cgpa']),
    mk('language-level', 'English overall score of at least 6.5', lang >= 6.5, `Overall ${raw('language.overall')} meets the minimum of 6.5.`, 'No language score has been verified yet (upload your language certificate).', ['language.overall']),
    mk(
      'docs-complete',
      'CV, degree, transcript and language evidence uploaded',
      missingDocs.length === 0,
      'All required documents have been processed.',
      `Missing or not accepted: ${missingDocs.map((t) => LABEL[t]).join(', ')}.`,
      [],
    ),
    mk(
      'consistency',
      'No unresolved conflicts between documents',
      conflict ? 'conflict' : true,
      'No unresolved conflicts between your documents.',
      conflict ? `${conflict.label} differs between documents: ${conflict.conflictOptions!.map((o) => `${o.value} (${LABEL[(o.sources ?? [])[0]] ?? 'document'})`).join(' vs ')}. Please confirm which is correct.` : '',
      conflict ? [conflict.fieldKey] : [],
    ),
  ];
}

const WEIGHT: Record<string, number> = { 'degree-level': 15, 'field-relevance': 15, 'gpa-min': 20, 'language-level': 20, 'docs-complete': 15, consistency: 15 };

function buildGaps(s: DemoState, profile: ProfileField[]) {
  const done = doneByType(s);
  const gaps: Gap[] = [];
  for (const t of REQUIRED) {
    if (!done.has(t)) gaps.push({ id: `MISSING_DOC:${t}`, kind: 'MISSING_DOC', docType: t, severity: 'BLOCKING', message: `Your ${LABEL[t]} has not been accepted yet.` });
  }
  const conflicts: JourneyConflict[] = [];
  for (const p of profile.filter((x) => x.state === 'CONFLICT')) {
    const gapId = `CONFLICT:${p.fieldKey}`;
    gaps.push({ id: gapId, kind: 'CONFLICT', fieldId: p.id, severity: 'BLOCKING', message: `${p.label} differs between your documents.` });
    conflicts.push({ gapId, fieldId: p.id, label: p.label, options: p.conflictOptions! });
  }
  return { gaps, conflicts };
}

/** Evaluation number `n`, computed from the current state (a pure function: same state, same result). */
function computeEvaluation(s: DemoState, profile: ProfileField[], n: number): Evaluation {
  const requirements = buildRequirements(s, profile);
  const score = requirements.reduce((sum, r) => sum + (r.status === 'MET' ? WEIGHT[r.requirementId] : 0), 0);
  const allMet = requirements.every((r) => r.status === 'MET');
  const verdict = allMet && score >= 80 ? 'READY' : 'INCOMPLETE';
  const { conflicts } = buildGaps(s, profile);
  const outcome: BackendStage = verdict === 'READY' ? 'READY' : conflicts.length ? 'ACTION_REQUIRED' : 'INCOMPLETE';
  return { id: `demo-eval-${n}`, createdAt: iso(n), score, verdict, outcome, isDemo: true, disclaimer: DEMO_DISCLAIMER, requirements };
}

const currentEvaluation = (s: DemoState, profile: ProfileField[]): Evaluation | null =>
  s.evaluations.length === 0 ? null : computeEvaluation(s, profile, s.evaluations.length);

function clarificationOf(s: DemoState, profile: ProfileField[]): Clarification | null {
  const conflict = profile.find((p) => p.state === 'CONFLICT');
  const resolved = profile.find((p) => p.fieldKey === 'degree.graduationYear' && p.resolved);
  if (conflict) {
    const [a, b] = conflict.conflictOptions!;
    return {
      id: 'demo-clarification-1',
      prompt: `Your ${LABEL[(a.sources ?? [])[0]]} says ${a.value} but your ${LABEL[(b.sources ?? [])[0]]} says ${b.value}. Which graduation year is correct?`,
      gapId: `CONFLICT:${conflict.fieldKey}`,
      fieldId: conflict.id,
      status: 'OPEN',
      answer: null,
      createdAt: iso(1),
      answeredAt: null,
    };
  }
  if (resolved && s.gradYearAnswer) {
    return {
      id: 'demo-clarification-1',
      prompt: 'Which graduation year is correct?',
      gapId: 'CONFLICT:degree.graduationYear',
      fieldId: resolved.id,
      status: 'ANSWERED',
      answer: { choice: s.gradYearAnswer, value: s.gradYearAnswer },
      createdAt: iso(1),
      answeredAt: iso(2),
    };
  }
  return null;
}

function buildJourney(s: DemoState): Journey {
  const a = s.applicant!;
  const profile = buildProfile(s);
  const evaluation = currentEvaluation(s, profile);
  const { gaps, conflicts } = evaluation ? buildGaps(s, profile) : { gaps: [], conflicts: [] };
  const clar = evaluation ? clarificationOf(s, profile) : null;
  const claimCount = (d: DemoDoc) => (d.status === 'DONE' && doneByType(s).get(d.docType)?.id === d.id ? (FACTS[d.docType] ?? []).length : 0);
  return {
    applicant: { id: APPLICANT_ID, name: a.name, email: a.email, goal: a.goal, programLabel: a.programLabel },
    stage: evaluation ? evaluation.outcome : 'NEW',
    documents: s.docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      docType: d.docType,
      status: d.status,
      error: d.error,
      activeVersion: d.status === 'DONE' ? 1 : null,
      activeClaimCount: claimCount(d),
    })),
    profile,
    evaluation,
    isStale: Boolean(evaluation) && s.docs.some((d) => d.status === 'UPLOADED'),
    gaps,
    conflicts,
    history: s.evaluations.map((e, i) => ({ id: `demo-eval-${i + 1}`, createdAt: iso(i + 1), score: e.score, verdict: e.verdict, outcome: e.outcome })),
    clarifications: { open: clar?.status === 'OPEN' ? 1 : 0, items: clar ? [clar] : [] },
  };
}

/** A fixed set of rules, nothing more: conflict first, then missing documents, then the recommendation. */
function decideView(s: DemoState): AgentView {
  const journey = buildJourney(s);
  const ev = journey.evaluation;
  if (!ev) return { action: null, message: '', source: null, clarification: null, isCurrent: true };
  const clar = journey.clarifications.items[0] ?? null;
  const base = (type: AgentAction['type'], message: string, rationale: string, params: Partial<NonNullable<AgentAction['params']>>, gapId: string | null): AgentView => ({
    action: {
      id: `demo-action-${s.evaluations.length}-${type}`,
      type,
      status: 'PENDING',
      gapId,
      evaluationId: ev.id,
      params: { docType: null, requirementId: null, route: null, fieldId: null, options: [], ...params },
      decision: { decision: { message, rationale }, source: 'RULES' },
    },
    message,
    source: 'RULES',
    clarification: type === 'ASK_CLARIFICATION' ? clar : null,
    isCurrent: true,
  });
  const conflict = journey.conflicts[0];
  if (conflict && clar?.status === 'OPEN') {
    return base(
      'ASK_CLARIFICATION',
      `(Demo simulation) ${clar.prompt}`,
      'Two of your documents disagree, and a requirement cannot be confirmed until you tell us which is correct.',
      { fieldId: conflict.fieldId, clarificationId: clar.id, options: conflict.options.map((o) => ({ value: o.value, sources: o.sources ?? [] })) },
      conflict.gapId,
    );
  }
  const missing = journey.gaps.find((g) => g.kind === 'MISSING_DOC');
  if (missing) {
    return base('REQUEST_DOCUMENT', `(Demo simulation) Please upload your ${LABEL[missing.docType!]}. ${missing.message}`, 'A required document is still missing, and it blocks the application check.', { docType: missing.docType }, missing.id);
  }
  if (ev.verdict === 'READY') {
    return base('RECOMMEND_NEXT_STEP', '(Demo simulation) All demo requirements are met. The next step is to look at Master\'s programmes that fit your profile.', 'Every mandatory demo requirement is met by your documents.', { route: 'STUDY' }, null);
  }
  return base('NO_ACTION', '(Demo simulation) Nothing needed right now.', 'No open gap needs your action.', {}, null);
}

/** Simulated processing: each new document is "read" by fixed rules, never by a model. */
function processDocs(s: DemoState): ProcessResult['processed'] {
  const out: ProcessResult['processed'] = [];
  for (const d of s.docs) {
    if (d.status !== 'UPLOADED' && d.status !== 'FAILED') continue;
    if (NON_QUALIFYING.test(d.filename)) {
      d.status = 'FAILED';
      d.error = `This looks like an identity document or an unrelated file, but it was uploaded as ${LABEL[d.docType] ?? 'a document'}. It was not used. Please upload the correct document. (Demo simulation of document-type validation.)`;
    } else {
      d.status = 'DONE';
      d.error = null;
    }
    out.push({ documentId: d.id, status: d.status, error: d.error });
  }
  return out;
}

function evaluate(s: DemoState) {
  if (doneByType(s).size === 0) return;
  const e = computeEvaluation(s, buildProfile(s), s.evaluations.length + 1);
  s.evaluations.push({ score: e.score, verdict: e.verdict, outcome: e.outcome });
}

// ------------------------------------------------------------------ the same interface as the real client

export const demoApi: typeof import('../services/api').api = {
  health: async () => ({ status: 'demo', db: 'simulated' }),

  register: async () => {
    await delay(250);
    const s = load();
    save({ ...s, signedIn: true });
    return { token: DEMO_TOKEN, user: { ...USER, applicantId: s.applicant ? APPLICANT_ID : null } };
  },
  login: async () => {
    await delay(250);
    const s = load();
    save({ ...s, signedIn: true });
    return { token: DEMO_TOKEN, user: { ...USER, applicantId: s.applicant ? APPLICANT_ID : null } };
  },
  me: async () => {
    const s = load();
    requireSession(s);
    return { ...USER, applicantId: s.applicant ? APPLICANT_ID : null };
  },

  createApplicant: async (input) => {
    await delay(300);
    const s = load();
    requireSession(s);
    s.applicant = { name: input.name, email: input.email ?? null, goal: input.goal ?? null, programLabel: input.programLabel ?? null };
    save(s);
    return { id: APPLICANT_ID, name: s.applicant.name, email: s.applicant.email, goal: s.applicant.goal, programLabel: s.applicant.programLabel, stage: 'NEW' };
  },
  getApplicant: async (id) => {
    const s = load();
    const a = requireApplicant(s, id);
    return { id: APPLICANT_ID, name: a.name, email: a.email, goal: a.goal, programLabel: a.programLabel, stage: buildJourney(s).stage };
  },
  setGoal: async (id, goal, programLabel) => {
    const s = load();
    const a = requireApplicant(s, id);
    a.goal = goal;
    a.programLabel = programLabel ?? a.programLabel;
    save(s);
    return { id: APPLICANT_ID, name: a.name, email: a.email, goal: a.goal, programLabel: a.programLabel, stage: buildJourney(s).stage };
  },

  // The chosen file is only used for its NAME: it is not read, uploaded or stored.
  uploadDocument: async (id, file, docType) => {
    await delay(300);
    const s = load();
    requireApplicant(s, id);
    s.seq += 1;
    const doc: DemoDoc = { id: `demo-doc-${s.seq}`, filename: file.name, docType: docType ?? 'UNKNOWN', status: 'UPLOADED', error: null };
    s.docs.push(doc);
    save(s);
    return { id: doc.id, applicantId: APPLICANT_ID, filename: doc.filename, mime: file.type || 'application/octet-stream', docType: doc.docType, status: doc.status, error: null } satisfies DocumentRecord;
  },
  listDocuments: async (id) => {
    const s = load();
    requireApplicant(s, id);
    return s.docs.map((d) => ({ id: d.id, applicantId: APPLICANT_ID, filename: d.filename, mime: 'application/octet-stream', docType: d.docType, status: d.status, error: d.error }));
  },

  processPending: async (id) => {
    await delay(900); // the "scan" takes a moment so the progress screen is visible
    const s = load();
    requireApplicant(s, id);
    const processed = processDocs(s);
    if (processed.length > 0) evaluate(s);
    save(s);
    return { processed, stage: buildJourney(s).stage };
  },
  evaluate: async (id) => {
    const s = load();
    requireApplicant(s, id);
    evaluate(s);
    save(s);
    return { stage: buildJourney(s).stage };
  },

  getJourney: async (id) => {
    const s = load();
    requireApplicant(s, id);
    return buildJourney(s);
  },
  getGaps: async (id) => {
    const s = load();
    requireApplicant(s, id);
    const j = buildJourney(s);
    return { gaps: j.gaps, conflicts: j.conflicts, isStale: j.isStale };
  },
  getClaims: async (id) => {
    const s = load();
    requireApplicant(s, id);
    return buildJourney(s).profile;
  },

  decide: async (id) => {
    await delay(350);
    const s = load();
    requireApplicant(s, id);
    return decideView(s);
  },
  getNextAction: async (id) => {
    const s = load();
    requireApplicant(s, id);
    return decideView(s);
  },
  getActions: async (id) => {
    const s = load();
    requireApplicant(s, id);
    const v = decideView(s);
    return v.action ? [v.action] : [];
  },

  listClarifications: async (id, status) => {
    const s = load();
    requireApplicant(s, id);
    return buildJourney(s).clarifications.items.filter((c) => !status || c.status === status);
  },
  getClarification: async (id, clarificationId) => {
    const s = load();
    requireApplicant(s, id);
    const c = buildJourney(s).clarifications.items.find((x) => x.id === clarificationId);
    if (!c) throw new ApiError('Clarification not found (demo)', 404);
    return c;
  },
  answerClarification: async (id, clarificationId, answer) => {
    await delay(500);
    const s = load();
    requireApplicant(s, id);
    const open = buildJourney(s).clarifications.items.find((x) => x.id === clarificationId && x.status === 'OPEN');
    if (!open) throw new ApiError('This question is no longer open (demo)', 409);
    const chosen = String(answer.choice ?? answer.value ?? answer.text ?? '').trim();
    const valid = (buildJourney(s).conflicts[0]?.options ?? []).map((o) => String(o.value));
    if (!valid.includes(chosen)) throw new ApiError(`Please choose one of: ${valid.join(', ')}`, 400);
    s.gradYearAnswer = chosen;
    evaluate(s); // the answer changes the evidence, so the demo re-evaluates, like the real loop
    save(s);
    const answered = buildJourney(s).clarifications.items.find((x) => x.id === clarificationId)!;
    return { ...answered, resolution: { stage: buildJourney(s).stage } } satisfies AnswerResult;
  },
};
