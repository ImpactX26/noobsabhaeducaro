import type { DocumentType } from '../config/requirements.demo';
import { decideDocumentType, hasTypeEvidence, noEvidenceRejection } from './document-type';
import { DOC_TYPES, EXTRACTION_SCHEMA, EXTRACTION_SYSTEM_PROMPT, SUPPORTED_DOC_TYPES, buildExtractionUserText } from './extraction.schema';

const decide = (titleType: DocumentType, modelType: unknown, slot: DocumentType) => decideDocumentType({ titleType, modelType, slot });
const rejection = (d: ReturnType<typeof decide>) => {
  if (d.ok) throw new Error(`expected a rejection, got ${d.docType}`);
  return d.rejection;
};

describe('decideDocumentType: the content decides, the upload slot is only compared', () => {
  describe('unsupported documents (identity card, invoice) never become evidence', () => {
    it('an identity document in the Degree slot is a MISMATCH, even when there is no title and the slot said DEGREE', () => {
      const r = rejection(decide('UNKNOWN', 'IDENTITY_DOCUMENT', 'DEGREE'));
      expect(r).toMatchObject({ code: 'DOCUMENT_TYPE_MISMATCH', detectedType: 'IDENTITY_DOCUMENT', expectedType: 'DEGREE' });
      expect(r.message).toMatch(/identity document.*uploaded as a degree certificate/);
    });

    it('an invoice in the Language Certificate slot is a MISMATCH', () => {
      expect(rejection(decide('UNKNOWN', 'OTHER', 'LANGUAGE_CERT'))).toMatchObject({ code: 'DOCUMENT_TYPE_MISMATCH', detectedType: 'OTHER', expectedType: 'LANGUAGE_CERT' });
    });

    it('with no slot at all it is UNSUPPORTED instead', () => {
      expect(rejection(decide('UNKNOWN', 'IDENTITY_DOCUMENT', 'UNKNOWN'))).toMatchObject({ code: 'UNSUPPORTED_DOCUMENT_TYPE', expectedType: null });
    });

    it('a forged title cannot override the model recognising an identity document', () => {
      expect(rejection(decide('DEGREE', 'IDENTITY_DOCUMENT', 'DEGREE')).code).toBe('DOCUMENT_TYPE_MISMATCH');
    });
  });

  describe('a supported document in the wrong slot', () => {
    it('a degree certificate in the Transcript slot is a MISMATCH (not silently relabelled)', () => {
      const r = rejection(decide('DEGREE', 'DEGREE', 'TRANSCRIPT'));
      expect(r).toMatchObject({ code: 'DOCUMENT_TYPE_MISMATCH', detectedType: 'DEGREE', expectedType: 'TRANSCRIPT' });
      expect(r.message).toMatch(/degree certificate.*uploaded as an academic transcript/);
    });

    it('also when only the model (no title) recognises it', () => {
      expect(rejection(decide('UNKNOWN', 'DEGREE', 'TRANSCRIPT')).code).toBe('DOCUMENT_TYPE_MISMATCH');
    });
  });

  describe('classification when the title text is absent', () => {
    it('the model reading the content is enough, and the result matches a correct slot', () => {
      expect(decide('UNKNOWN', 'DEGREE', 'DEGREE')).toEqual({ ok: true, docType: 'DEGREE', basis: 'MODEL' });
    });

    it('works without any slot too', () => {
      expect(decide('UNKNOWN', 'LANGUAGE_CERT', 'UNKNOWN')).toEqual({ ok: true, docType: 'LANGUAGE_CERT', basis: 'MODEL' });
    });

    it('the slot can NEVER make an unreadable/unknown document valid', () => {
      for (const slot of SUPPORTED_DOC_TYPES) {
        expect(rejection(decide('UNKNOWN', 'UNKNOWN', slot)).code).toBe('DOCUMENT_TYPE_UNCLEAR');
      }
      expect(rejection(decide('UNKNOWN', 'UNKNOWN', 'UNKNOWN')).code).toBe('DOCUMENT_TYPE_UNCLEAR');
    });

    it('garbage from the model counts as "cannot tell"', () => {
      expect(rejection(decide('UNKNOWN', 'PASSPORT', 'DEGREE')).code).toBe('DOCUMENT_TYPE_UNCLEAR');
      expect(rejection(decide('UNKNOWN', undefined, 'DEGREE')).code).toBe('DOCUMENT_TYPE_UNCLEAR');
      expect(rejection(decide('UNKNOWN', 42, 'DEGREE')).code).toBe('DOCUMENT_TYPE_UNCLEAR');
    });
  });

  describe('title and model together', () => {
    it('agreement is accepted', () => {
      expect(decide('DEGREE', 'DEGREE', 'DEGREE')).toEqual({ ok: true, docType: 'DEGREE', basis: 'TITLE_AND_MODEL' });
    });
    it('a title alone is accepted when the model cannot tell', () => {
      expect(decide('DEGREE', 'UNKNOWN', 'DEGREE')).toEqual({ ok: true, docType: 'DEGREE', basis: 'TITLE' });
    });
    it('disagreeing supported types are UNCLEAR, not resolved in favour of the slot', () => {
      expect(rejection(decide('DEGREE', 'TRANSCRIPT', 'DEGREE'))).toMatchObject({ code: 'DOCUMENT_TYPE_UNCLEAR' });
      expect(rejection(decide('DEGREE', 'TRANSCRIPT', 'TRANSCRIPT')).code).toBe('DOCUMENT_TYPE_UNCLEAR');
    });
  });

  it('every correct pairing of content and slot is accepted (no false rejections for honest uploads)', () => {
    for (const t of SUPPORTED_DOC_TYPES) {
      expect(decide(t, t, t).ok).toBe(true);
      expect(decide('UNKNOWN', t, t).ok).toBe(true);
      expect(decide(t, 'UNKNOWN', t).ok).toBe(true);
      expect(decide(t, t, 'UNKNOWN').ok).toBe(true);
    }
  });

  it('every wrong slot for a recognised type is rejected', () => {
    for (const actual of SUPPORTED_DOC_TYPES) {
      for (const slot of SUPPORTED_DOC_TYPES) {
        if (slot !== actual) expect(rejection(decide(actual, actual, slot)).code).toBe('DOCUMENT_TYPE_MISMATCH');
      }
    }
  });
});

describe('hasTypeEvidence: a document needs grounded claims of its own kind', () => {
  it('name and date of birth alone prove nothing (an identity card has both)', () => {
    for (const t of SUPPORTED_DOC_TYPES) expect(hasTypeEvidence(t, ['applicant.name', 'applicant.dob'])).toBe(false);
    expect(hasTypeEvidence('DEGREE', [])).toBe(false);
  });

  it('accepts claims that belong in that kind of document', () => {
    expect(hasTypeEvidence('DEGREE', ['applicant.name', 'degree.graduationYear'])).toBe(true);
    expect(hasTypeEvidence('TRANSCRIPT', ['degree.cgpa'])).toBe(true);
    expect(hasTypeEvidence('LANGUAGE_CERT', ['language.overall'])).toBe(true);
    expect(hasTypeEvidence('EXPERIENCE_LETTER', ['experience.totalMonths'])).toBe(true);
    expect(hasTypeEvidence('CV', ['experience.employer'])).toBe(true);
    expect(hasTypeEvidence('SOP', ['degree.level'])).toBe(true);
  });

  it('rejects claims of a different kind (language scores do not make a degree certificate)', () => {
    expect(hasTypeEvidence('DEGREE', ['language.overall'])).toBe(false);
    expect(hasTypeEvidence('LANGUAGE_CERT', ['degree.cgpa'])).toBe(false);
    expect(hasTypeEvidence('EXPERIENCE_LETTER', ['degree.level'])).toBe(false);
  });

  it('builds a readable rejection', () => {
    const r = noEvidenceRejection('DEGREE', 'DEGREE');
    expect(r.rejection).toMatchObject({ code: 'DOCUMENT_TYPE_UNCLEAR', detectedType: 'DEGREE', expectedType: 'DEGREE' });
    expect(r.rejection.message).toMatch(/degree certificate/);
  });
});

describe('what the model is told', () => {
  it('may name identity documents and other/unsupported documents, and may say it cannot tell', () => {
    expect(DOC_TYPES).toEqual(expect.arrayContaining([...SUPPORTED_DOC_TYPES, 'IDENTITY_DOCUMENT', 'OTHER', 'UNKNOWN']));
    expect([...EXTRACTION_SCHEMA.properties.documentType.enum]).toEqual([...DOC_TYPES]);
  });

  it('is told to classify from content only and to extract nothing from unusable documents', () => {
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/ACTUALLY IS/);
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/Ignore any file name and ignore where or how it was uploaded/);
    expect(EXTRACTION_SYSTEM_PROMPT).toMatch(/IDENTITY_DOCUMENT, OTHER and UNKNOWN return an empty "claims" list/);
  });

  it('never sees the file name or the slot in the prompt text', () => {
    const text = buildExtractionUserText([{ pageNo: 1, text: 'hello' }]);
    expect(text).toBe('[[PAGE 1]]\nhello');
    expect(text).not.toMatch(/Filename|DEGREE/);
  });
});
