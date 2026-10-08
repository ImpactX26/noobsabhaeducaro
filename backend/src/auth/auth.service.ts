import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const BCRYPT_ROUNDS = 12;
const INVALID_LOGIN = 'Invalid email or password';

interface AccountRow {
  id: string;
  email: string;
  name: string;
}

@Injectable()
export class AuthService {
  /** Compared against when the email is unknown, so "no such account" costs the same time as "wrong password". Built lazily, off the startup path. */
  private decoyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      const user = await this.prisma.user.create({
        data: { email, name: dto.name.trim(), passwordHash },
        select: { id: true, email: true, name: true },
      });
      return this.session(user);
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') throw new ConflictException('An account with this email already exists');
      throw err;
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    this.decoyHash ??= bcrypt.hash(randomBytes(16).toString('hex'), BCRYPT_ROUNDS);
    const matches = await bcrypt.compare(dto.password, user?.passwordHash ?? (await this.decoyHash));
    // one message for "no such account" and "wrong password": do not reveal which emails are registered
    if (!user || !matches) throw new UnauthorizedException(INVALID_LOGIN);
    return this.session({ id: user.id, email: user.email, name: user.name });
  }

  /** The signed-in account and the applicant it owns (so a new device can pick up where the user left off). */
  async profile(user: AccountRow) {
    const latest = await this.prisma.applicant.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return { id: user.id, name: user.name, email: user.email, applicantId: latest?.id ?? null };
  }

  private async session(user: AccountRow) {
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { token, user: await this.profile(user) };
  }
}
