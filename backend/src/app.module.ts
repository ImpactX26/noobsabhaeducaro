import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApplicantsModule } from './applicants/applicants.module';
import { validateEnv } from './config/env.validation';
import { DocumentsModule } from './documents/documents.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    HealthModule,
    ApplicantsModule,
    DocumentsModule,
  ],
})
export class AppModule {}
