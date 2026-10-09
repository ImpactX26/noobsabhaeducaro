import { classifyDocument } from './classify';

const page = (text: string) => ({ pageNo: 1, text });

describe('classifyDocument (content only)', () => {
  const cases: Array<[string, string]> = [
    ['DEMO DOCUMENT\nCURRICULUM VITAE\nArjun Mehta', 'CV'],
    ['DEMO DOCUMENT\nDEGREE CERTIFICATE\nRiverview Institute', 'DEGREE'],
    ['DEMO DOCUMENT\nACADEMIC TRANSCRIPT\nB.Tech', 'TRANSCRIPT'],
    ['DEMO DOCUMENT\nENGLISH LANGUAGE TEST REPORT', 'LANGUAGE_CERT'],
    ['DEMO DOCUMENT\nEXPERIENCE LETTER\nNorthstar', 'EXPERIENCE_LETTER'],
    ['DEMO DOCUMENT\nSTATEMENT OF PURPOSE', 'SOP'],
  ];
  it.each(cases)('classifies by the title in the text: %j', (text, expected) => {
    expect(classifyDocument(page(text))).toEqual({ docType: expected, source: 'TITLE' });
  });

  it('is not fooled by a statement of purpose that talks about degrees and transcripts', () => {
    const text = 'STATEMENT OF PURPOSE\nI completed my degree and my transcript shows a CGPA of 8.4';
    expect(classifyDocument(page(text)).docType).toBe('SOP');
  });

  it('has no file-name or upload-slot input: without a recognisable title the answer is UNKNOWN', () => {
    expect(classifyDocument.length).toBe(1); // (firstPage) only
    expect(classifyDocument(page('lorem ipsum'))).toEqual({ docType: 'UNKNOWN', source: 'NONE' });
    expect(classifyDocument(undefined)).toEqual({ docType: 'UNKNOWN', source: 'NONE' });
  });

  it('returns UNKNOWN for identity documents and other unrelated content, whatever they might be called', () => {
    const idCard = 'GOVERNMENT IDENTITY CARD\nName: Arjun Mehta\nIdentity No: 0000 0000 0000\nDate of Birth: 14/02/2004';
    const invoice = 'INVOICE 2026-0042\nItem: office chairs x 4\nTotal due: 480.00 EUR';
    expect(classifyDocument(page(idCard)).docType).toBe('UNKNOWN');
    expect(classifyDocument(page(invoice)).docType).toBe('UNKNOWN');
  });

  it('a document with real content but no title heading is not classified here (the model decides, with grounded evidence)', () => {
    const untitled = 'This is to certify that Arjun Mehta was awarded the BACHELOR OF TECHNOLOGY. Year of Graduation 2025. Final CGPA 8.42 / 10.00';
    expect(classifyDocument(page(untitled)).docType).toBe('UNKNOWN');
  });
});
