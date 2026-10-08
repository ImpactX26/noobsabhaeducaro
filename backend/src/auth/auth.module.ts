import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ApplicantOwnerGuard, JwtAuthGuard } from './auth.guards';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Accounts, login tokens and the two global guards. Registered globally, so every route is
 * protected by default; a route must opt out explicitly with @Public().
 * Order matters: authentication runs first (401), then applicant ownership (403 / 404).
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '8h') as never, algorithm: 'HS256' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ApplicantOwnerGuard },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
