import type { DocumentType } from '../config/requirements.demo';
import type { PageText } from './pdf-text';

/** Title patterns, checked against the first lines of the first page, most specific first. */
const TITLE_RULES: Array<[DocumentType, RegExp]> = [
  ['SOP', /statement of purpose|personal statement|letter of motivation/],
  ['TRANSCRIPT', /academic transcript|transcript of records|\btranscript\b|semester results|grade sheet|mark ?sheet/],
  ['LANGUAGE_CERT', /language test|english test|test report|\bielts\b|\btoefl\b|overall band|language certificate/],
  ['EXPERIENCE_LETTER', /experience letter|experience certificate|employment (letter|certificate)|internship (letter|certificate)/],
  ['DEGREE', /degree certificate|certificate of graduation|provisional certificate|diploma certificate/],
  ['CV', /curriculum vitae|\bresume\b|\bcv\b/],
];

const TITLE_LINES = 8;

export interface Classification {
  docType: DocumentType;
  source: 'TITLE' | 'NONE';
}

/**
 * Cheap deterministic classification from the document's OWN TEXT (its title area; a statement of
 * purpose that mentions "degree" must not be classified as a degree certificate).
 *
 * The file name and the upload slot are deliberately not inputs: both are chosen by the uploader and
 * are not evidence of what the document is. Returns UNKNOWN when the title says nothing; the model's
 * reading of the whole content then decides (see document-type.ts).
 */
export function classifyDocument(firstPage: PageText | undefined): Classification {
  if (firstPage) {
    const head = firstPage.text.split(/\r?\n/).slice(0, TITLE_LINES).join(' ').toLowerCase();
    for (const [type, re] of TITLE_RULES) if (re.test(head)) return { docType: type, source: 'TITLE' };
  }
  return { docType: 'UNKNOWN', source: 'NONE' };
}
