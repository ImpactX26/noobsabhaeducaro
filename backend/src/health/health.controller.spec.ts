import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  const make = (query: jest.Mock) =>
    new HealthController({ $queryRaw: query } as unknown as PrismaService);

  it('reports ok when the database responds', async () => {
    const res = await make(jest.fn().mockResolvedValue([{ ok: 1 }])).check();
    expect(res.status).toBe('ok');
    expect(res.db).toBe('up');
  });

  it('answers 503 with a degraded body when the database fails (so health checks fail)', async () => {
    const err = await make(jest.fn().mockRejectedValue(new Error('down'))).check().catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.getStatus()).toBe(503);
    expect(err.getResponse()).toMatchObject({ status: 'degraded', db: 'down' });
  });
});
