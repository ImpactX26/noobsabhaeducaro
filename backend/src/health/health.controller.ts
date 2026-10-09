import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness + database connectivity check' })
  async check() {
    let db: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    const body = { status: db === 'up' ? 'ok' : 'degraded', db, time: new Date().toISOString() };
    // 503 (same body) when the database is unreachable, so a platform health check can tell a broken instance from a healthy one.
    if (db === 'down') throw new ServiceUnavailableException(body);
    return body;
  }
}
