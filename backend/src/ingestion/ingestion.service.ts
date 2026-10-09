import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import type { DocumentType } from '../config/requirements.demo';
import { DocumentStorage } from '../documents/document-storage';
import { activeClaimsWhere } from '../evidence/active-claims';
import { DocStatus } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';
import { LlmOutputError, LlmService, LlmUnavailableError } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { classifyDocument } from './classify';
import { DocumentReader, IngestionError } from './document-reader';
import { decideDocumentType, hasTypeEvidence, noEvidenceRejection, type Rejection } from './document-type';
import { EXTRACTION_SCHEMA, EXTRACTION_SYSTEM_PROMPT, buildExtractionUserText } from './extraction.schema';
import { groundClaims, parseProposedClaims } from './grounding';

const CLAIM_SELECT = {
  id: true,
  documentId: true,
  runId: true,
  fieldKey: true,
  entryKey: true,
  rawValue: true,
  value: true,
  source: true,
  page: true,
  quote: true,
  confidence: true,
  createdAt: true,
} as const;

const DOCUMENT_SELECT = {
  id: true,
  applicantId: true,
  filename: true,
  mime: true,
  docType: true,
  status: true,
  error: true,
  textMethod: true,
  extraction: true,
  createdAt: true,
} as const;

const RUN_SELECT = {
  id: true,
  documentId: true,
  version: true,
  status: true,
  isActive: true,
  docType: true,
  textMethod: true,
  error: true,
  createdAt: true,
  completedAt: true,
} as const;

const json = (v: unknown) => v as Prisma.InputJsonValue;

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly storage: DocumentStorage;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reader: DocumentReader,
    private readonly llm: LlmService,
    config: ConfigService,
  ) {
    this.storage = new DocumentStorage(config.get<string>('UPLOAD_DIR', './uploads'));
  }

  /**
   * file -> page text (text layer, else vision) -> doc type -> Claude extraction -> grounding ->
   * Claim rows, as a new versioned DocumentRun. Nothing from earlier runs is deleted: when this
   * run succeeds it becomes the document's active run and the previous run (and its claims) stay
   * in the database as history. When it fails, the previous active run stays active.
   * Never throws for a bad document: the Document ends up FAILED with a readable `error`, and
   * can be retried. `force` re-processes a DONE document.
   */
  async processDocument(applicantId: string, documentId: string, opts: { force?: boolean } = {}) {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, applicantId } });
    if (!doc) throw new NotFoundException(`Document ${documentId} not found for applicant ${applicantId}`);

    // Atomic claim of the document, so two concurrent requests cannot both process it.
    const startable: DocStatus[] = opts.force ? ['UPLOADED', 'FAILED', 'DONE'] : ['UPLOADED', 'FAILED'];
    const locked = await this.prisma.document.updateMany({
      where: { id: doc.id, status: { in: startable } },
      data: { status: 'PROCESSING', error: null },
    });
    if (locked.count === 0) {
      throw new ConflictException(`Document is ${doc.status}; ${doc.status === 'DONE' ? 'pass force=true to re-process' : 'wait for it to finish'}`);
    }

    const run = await this.createRun(doc.id);
    try {
      const { document, claims, rejected } = await this.run(doc, run.id);
      return { document, run: { id: run.id, version: run.version, status: 'DONE' as const }, claims, rejected };
    } catch (err) {
      const message = this.userMessage(err);
      // A document rejected for what it IS keeps a machine-readable reason with the failed run (no claims were stored).
      const rejection = err instanceof IngestionError ? err.rejection : undefined;
      await this.prisma.$transaction([
        this.prisma.documentRun.update({
          where: { id: run.id },
          data: { status: 'FAILED', error: message, completedAt: new Date(), ...(rejection && { extraction: json({ rejection }) }) },
        }),
        this.prisma.document.update({ where: { id: doc.id }, data: { status: 'FAILED', error: message } }),
      ]);
      const document = await this.prisma.document.findUniqueOrThrow({ where: { id: doc.id }, select: DOCUMENT_SELECT });
      return { document, run: { id: run.id, version: run.version, status: 'FAILED' as const, rejection }, claims: [], rejected: [] };
    }
  }

  /** Next version number; the unique (documentId, version) index makes a race fail loudly instead of corrupting history. */
  private async createRun(documentId: string) {
    const last = await this.prisma.documentRun.aggregate({ where: { documentId }, _max: { version: true } });
    return this.prisma.documentRun.create({ data: { documentId, version: (last._max.version ?? 0) + 1 } });
  }

  private rejectionError(r: Rejection): IngestionError {
    return new IngestionError(r.message, { code: r.code, detectedType: r.detectedType, expectedType: r.expectedType });
  }

  private userMessage(err: unknown): string {
    if (err instanceof IngestionError || err instanceof LlmUnavailableError || err instanceof LlmOutputError) return err.message;
    this.logger.error('Unexpected ingestion failure', err instanceof Error ? err.stack : String(err));
    return 'Unexpected error while processing the document; please retry';
  }

  private async run(
    doc: { id: string; applicantId: string; filename: string; mime: string; storagePath: string; docType: DocumentType },
    runId: string,
  ) {
    const buffer = await fs.readFile(this.storage.resolve(doc.storagePath));
    const read = await this.reader.read({ buffer, mime: doc.mime, filename: doc.filename });

    // What the document IS comes from its content only: its own title text and the model's reading of the
    // whole text. The file name and the upload slot (`doc.docType`) are NOT evidence; the slot is only what
    // the applicant claims, and is compared with the content below.
    const titleType = classifyDocument(read.pages[0]).docType;

    const output = await this.llm.completeJson({
      system: EXTRACTION_SYSTEM_PROMPT,
      content: [{ type: 'text', text: buildExtractionUserText(read.pages) }],
      schema: EXTRACTION_SCHEMA,
      maxTokens: 2000, // extraction call limit; the global default stays 3000
      label: doc.filename, // for logs/test doubles only: never sent to the model
    });
    const proposed = parseProposedClaims(output);

    // Decide BEFORE anything is persisted: a document that is not what it was uploaded as, or is not a
    // supported type, fails here and contributes no claims and no requirement credit.
    const slot = doc.docType;
    const decision = decideDocumentType({ titleType, modelType: proposed.documentType, slot });
    if (!decision.ok) throw this.rejectionError(decision.rejection);
    const docType: DocumentType = decision.docType;

    const grounded = groundClaims(proposed.claims, read.pages, docType);
    // ... and it must be backed by grounded evidence of its own kind (a name/date of birth alone is not enough).
    if (!hasTypeEvidence(decision.docType, grounded.accepted.map((c) => c.fieldKey))) {
      const rejection = noEvidenceRejection(decision.docType, slot);
      if (!rejection.ok) throw this.rejectionError(rejection.rejection);
    }
    const rejected = [...proposed.rejected, ...grounded.rejected];
    const pages = read.pages.map((p) => ({ pageNo: p.pageNo, text: p.text, method: p.method }));

    const extraction = {
      model: this.llm.model,
      processedAt: new Date().toISOString(),
      // how the type was established from the content (TITLE, MODEL or both), and what the applicant had claimed
      detectedType: decision.docType,
      typeBasis: decision.basis,
      declaredType: slot === 'UNKNOWN' ? null : slot,
      textLayer: read.textLayer,
      pageMethods: read.pages.map((p) => ({ pageNo: p.pageNo, method: p.method })),
      proposed: proposed.claims.length + proposed.rejected.length,
      accepted: grounded.accepted.length,
      rejected,
    };

    const { document, claims } = await this.prisma.$transaction(async (tx) => {
      // The new run takes over as the active one; earlier runs and their claims are kept as history.
      await tx.documentRun.updateMany({ where: { documentId: doc.id, isActive: true }, data: { isActive: false } });
      const created = await tx.claim.createManyAndReturn({
        data: grounded.accepted.map((c) => ({
          applicantId: doc.applicantId,
          documentId: doc.id,
          runId,
          fieldKey: c.fieldKey,
          entryKey: c.entryKey,
          rawValue: c.rawValue,
          value: c.value === null || c.value === undefined ? Prisma.JsonNull : json(c.value),
          source: 'DOCUMENT' as const,
          page: c.page,
          quote: c.quote,
          // The model reports no calibrated confidence; none is invented.
          confidence: null,
        })),
        select: CLAIM_SELECT,
      });
      await tx.documentRun.update({
        where: { id: runId },
        data: {
          status: 'DONE',
          isActive: true,
          error: null,
          docType,
          textMethod: read.textMethod,
          pages: json(pages),
          extraction: json(extraction),
          completedAt: new Date(),
        },
      });
      // The Document row mirrors the active run for convenient reads.
      const updated = await tx.document.update({
        where: { id: doc.id },
        data: { status: 'DONE', error: null, docType, textMethod: read.textMethod, pages: json(pages), extraction: json(extraction) },
        select: DOCUMENT_SELECT,
      });
      return { document: updated, claims: created };
    });

    return { document, claims, rejected };
  }

  /** Claims of a document: the active ones by default, or every claim ever extracted (with their run). */
  async listClaims(applicantId: string, documentId: string, scope: 'active' | 'all' = 'active') {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, applicantId }, select: { id: true } });
    if (!doc) throw new NotFoundException(`Document ${documentId} not found for applicant ${applicantId}`);
    return this.prisma.claim.findMany({
      where: scope === 'active' ? { ...activeClaimsWhere(applicantId), documentId } : { documentId },
      orderBy: { createdAt: 'asc' },
      select: { ...CLAIM_SELECT, run: { select: { version: true, isActive: true } } },
    });
  }

  /** Processing history of a document, newest first. */
  async listRuns(applicantId: string, documentId: string) {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, applicantId }, select: { id: true } });
    if (!doc) throw new NotFoundException(`Document ${documentId} not found for applicant ${applicantId}`);
    const runs = await this.prisma.documentRun.findMany({
      where: { documentId },
      orderBy: { version: 'desc' },
      select: { ...RUN_SELECT, extraction: true, _count: { select: { claims: true } } },
    });
    return runs.map(({ extraction, _count, ...r }) => {
      const e = (extraction ?? {}) as { accepted?: number; proposed?: number; rejected?: unknown[] };
      return { ...r, claimCount: _count.claims, proposed: e.proposed ?? null, rejectedCount: e.rejected?.length ?? null };
    });
  }
}
