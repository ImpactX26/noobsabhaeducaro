import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ClarificationStatus } from '../generated/prisma/enums';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface OpenClarificationInput {
  applicantId: string;
  prompt: string;
  gapId?: string;
  fieldId?: string;
  claimIds?: string[];
  evaluationId?: string;
  agentActionId?: string;
}

export interface ClarificationAnswer {
  text?: string;
  value?: unknown;
  choice?: string;
}

/**
 * Durable record of questions put to the applicant and their answers.
 * Stage 4 only persists: questions are created by the agent (Stage 5) and an answer is turned
 * into a claim / conflict resolution and a re-evaluation later (Stage 6). Answering therefore
 * never changes evidence by itself.
 */
@Injectable()
export class ClarificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Service-level only (the agent calls this); there is deliberately no public endpoint to create questions. */
  async open(input: OpenClarificationInput) {
    if (!input.prompt.trim()) throw new BadRequestException('A clarification needs a prompt');
    return this.prisma.clarification.create({
      data: {
        applicantId: input.applicantId,
        prompt: input.prompt.trim(),
        gapId: input.gapId,
        fieldId: input.fieldId,
        claimIds: input.claimIds as Prisma.InputJsonValue | undefined,
        evaluationId: input.evaluationId,
        agentActionId: input.agentActionId,
      },
    });
  }

  async list(applicantId: string, status?: ClarificationStatus) {
    await this.assertApplicant(applicantId);
    return this.prisma.clarification.findMany({
      where: { applicantId, ...(status && { status }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(applicantId: string, id: string) {
    const found = await this.prisma.clarification.findFirst({ where: { id, applicantId } });
    if (!found) throw new NotFoundException(`Clarification ${id} not found for applicant ${applicantId}`);
    return found;
  }

  /** Stores the applicant's answer. Only an OPEN clarification can be answered, exactly once. */
  async answer(applicantId: string, id: string, answer: ClarificationAnswer) {
    const clean: ClarificationAnswer = {};
    if (typeof answer.text === 'string' && answer.text.trim()) clean.text = answer.text.trim();
    if (answer.value !== undefined && answer.value !== null) clean.value = answer.value;
    if (typeof answer.choice === 'string' && answer.choice.trim()) clean.choice = answer.choice.trim();
    if (Object.keys(clean).length === 0) throw new BadRequestException('Provide at least one of text, value or choice');

    const updated = await this.prisma.clarification.updateMany({
      where: { id, applicantId, status: 'OPEN' },
      data: { status: 'ANSWERED', answer: clean as Prisma.InputJsonValue, answeredAt: new Date() },
    });
    if (updated.count === 0) {
      const existing = await this.get(applicantId, id); // 404 if it does not exist
      throw new ConflictException(`Clarification is ${existing.status}; only OPEN clarifications can be answered`);
    }
    return this.get(applicantId, id);
  }

  private async assertApplicant(applicantId: string) {
    const found = await this.prisma.applicant.findUnique({ where: { id: applicantId }, select: { id: true } });
    if (!found) throw new NotFoundException(`Applicant ${applicantId} not found`);
  }
}
