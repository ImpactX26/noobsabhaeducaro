// Decides what an uploaded document IS, from its content, and whether it may be used as evidence.
// Pure functions: no database, no network.
//
// Inputs that are NOT evidence of a document's type: the file name and the upload slot. The slot is
// only the type the applicant CLAIMS the file is; it is compared with the content, never trusted.
import type { DocumentType } from '../config/requirements.demo';
import { DetectedDocType, SUPPORTED_DOC_TYPES, TYPE_EVIDENCE_PREFIXES } from './extraction.schema';

export type SupportedDocType = (typeof SUPPORTED_DOC_TYPES)[number];

/** Stable machine-readable reasons a document is not accepted; the readable text is `message`. */
export type RejectionCode = 'DOCUMENT_TYPE_MISMATCH' | 'UNSUPPORTED_DOCUMENT_TYPE' | 'DOCUMENT_TYPE_UNCLEAR';

export interface Rejection {
  code: RejectionCode;
  message: string;
  /** What the content says the document is (or why that is unclear). */
  detectedType: string;
  /** What the applicant said it was (the upload slot), if any. */
  expectedType: DocumentType | null;
}

export type TypeDecision =
  | { ok: true; docType: SupportedDocType; basis: 'TITLE' | 'MODEL' | 'TITLE_AND_MODEL' }
  | { ok: false; rejection: Rejection };

const LABEL: Record<string, string> = {
  CV: 'a CV',
  DEGREE: 'a degree certificate',
  TRANSCRIPT: 'an academic transcript',
  LANGUAGE_CERT: 'a language certificate',
  EXPERIENCE_LETTER: 'an experience letter',
  SOP: 'a statement of purpose',
  IDENTITY_DOCUMENT: 'an identity document',
  OTHER: 'a document that is not one of the supported types',
};
export const describeType = (t: string) => LABEL[t] ?? 'an unrecognised document';

const isSupported = (t: string): t is SupportedDocType => (SUPPORTED_DOC_TYPES as readonly string[]).includes(t);
const normalizeModel = (t: unknown): DetectedDocType =>
  typeof t === 'string' && (isSupported(t) || t === 'IDENTITY_DOCUMENT' || t === 'OTHER') ? (t as DetectedDocType) : 'UNKNOWN';

function reject(code: RejectionCode, message: string, detectedType: string, slot: DocumentType): TypeDecision {
  return { ok: false, rejection: { code, message, detectedType, expectedType: slot === 'UNKNOWN' ? null : slot } };
}

/**
 * @param titleType  type recognised from the document's own title text (or UNKNOWN)
 * @param modelType  type the model read from the whole content (or anything invalid / UNKNOWN)
 * @param slot       what the applicant says it is (UNKNOWN when uploaded without a slot)
 */
export function decideDocumentType(input: { titleType: DocumentType; modelType: unknown; slot: DocumentType }): TypeDecision {
  const { titleType, slot } = input;
  const modelType = normalizeModel(input.modelType);

  // The model recognised something we cannot use (an ID card, an invoice ...): the title cannot override that.
  if (modelType === 'IDENTITY_DOCUMENT' || modelType === 'OTHER') {
    return slot === 'UNKNOWN'
      ? reject('UNSUPPORTED_DOCUMENT_TYPE', `This looks like ${describeType(modelType)}, which cannot be used as evidence. Please upload a CV, degree certificate, transcript, language certificate or experience letter.`, modelType, slot)
      : reject('DOCUMENT_TYPE_MISMATCH', `This looks like ${describeType(modelType)}, but it was uploaded as ${describeType(slot)}. It was not used. Please upload the correct document.`, modelType, slot);
  }

  const fromTitle = isSupported(titleType) ? titleType : null;
  const fromModel = isSupported(modelType) ? modelType : null;

  if (fromTitle && fromModel && fromTitle !== fromModel) {
    return reject('DOCUMENT_TYPE_UNCLEAR', 'The title and the content of this document point to different document types, so it was not used. Please upload a clear copy.', `${fromTitle} / ${fromModel}`, slot);
  }
  const docType = fromTitle ?? fromModel;
  if (!docType) {
    return reject(
      'DOCUMENT_TYPE_UNCLEAR',
      slot === 'UNKNOWN'
        ? 'The type of this document could not be determined from its content, so it was not used. Please upload a clear copy.'
        : `The type of this document could not be determined from its content, so it was not used. Please upload a clear copy of ${describeType(slot)}.`,
      'UNKNOWN',
      slot,
    );
  }
  if (slot !== 'UNKNOWN' && slot !== docType) {
    return reject('DOCUMENT_TYPE_MISMATCH', `This looks like ${describeType(docType)}, but it was uploaded as ${describeType(slot)}. It was not used. Please upload it in the correct place.`, docType, slot);
  }
  return { ok: true, docType, basis: fromTitle && fromModel ? 'TITLE_AND_MODEL' : fromTitle ? 'TITLE' : 'MODEL' };
}

/**
 * Grounded evidence that the document really is of this type: at least one accepted claim of the kind
 * such a document carries. (Name and date of birth alone prove nothing: an ID card has both.)
 */
export function hasTypeEvidence(docType: SupportedDocType, acceptedFieldKeys: string[]): boolean {
  const prefixes = TYPE_EVIDENCE_PREFIXES[docType];
  return acceptedFieldKeys.some((k) => prefixes.some((p) => k.startsWith(p)));
}

export function noEvidenceRejection(docType: SupportedDocType, slot: DocumentType): TypeDecision & { ok: false } {
  return reject(
    'DOCUMENT_TYPE_UNCLEAR',
    `No information that belongs in ${describeType(docType)} could be verified in this document, so it was not used. Please upload a clear copy.`,
    docType,
    slot,
  ) as TypeDecision & { ok: false };
}
