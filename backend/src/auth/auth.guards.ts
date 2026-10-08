import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, IS_PUBLIC_KEY } from './auth.decorators';

type AuthedRequest = Request & { user?: AuthUser };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isPublic = (reflector: Reflector, ctx: ExecutionContext) =>
  reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);

/**
 * Global guard, authentication: every route needs a valid signed token unless it is marked @Public().
 * The account is re-loaded from PostgreSQL on each request, so a deleted account loses access at once.
 * Missing or invalid credentials -> 401.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (isPublic(this.reflector, ctx)) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw new UnauthorizedException('Authentication required');

    let userId: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: string }>(token, { algorithms: ['HS256'] });
      if (!payload.sub) throw new Error('no subject');
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
    if (!user) throw new UnauthorizedException('Invalid or expired token');
    req.user = user;
    return true;
  }
}

/**
 * Global guard, authorization: any route with an `:applicantId` path parameter may only be used by
 * the account that owns that applicant. The applicant id in the URL is just a name for the record;
 * ownership is decided from the database and the verified token, never from the client.
 * Unknown applicant -> 404, someone else's applicant -> 403.
 */
@Injectable()
export class ApplicantOwnerGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (isPublic(this.reflector, ctx)) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const rawId = req.params?.applicantId;
    const applicantId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (applicantId === undefined) return true; // route is not applicant-scoped (e.g. GET /auth/me)

    if (!req.user) throw new UnauthorizedException('Authentication required');
    // guards run before pipes, so keep the uuid validation that used to happen in the controller
    if (!UUID.test(applicantId)) throw new BadRequestException('Validation failed (uuid is expected)');

    const applicant = await this.prisma.applicant.findUnique({ where: { id: applicantId }, select: { userId: true } });
    if (!applicant) throw new NotFoundException(`Applicant ${applicantId} not found`);
    if (applicant.userId !== req.user.id) throw new ForbiddenException('You do not have access to this applicant');
    return true;
  }
}
