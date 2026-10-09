import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  DATABASE_URL!: string;

  // Google Gemini (document extraction + the agent). Without a key, LLM-backed steps fail gracefully.
  @IsOptional()
  @IsString()
  GEMINI_API_KEY?: string;

  @IsString()
  GEMINI_MODEL: string = 'gemini-3.5-flash-lite';

  // Secret used to sign login tokens. Required, server-side only, never committed.
  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters (see .env.example for how to generate one)' })
  JWT_SECRET!: string;

  // How long a login token stays valid (e.g. 8h, 30m).
  @IsString()
  JWT_EXPIRES_IN: string = '8h';

  @IsString()
  UPLOAD_DIR: string = './uploads';

  // Comma-separated browser origins allowed by CORS (the deployed frontend). Unset = permissive (local dev).
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${errors.toString()}`);
  }
  return validated;
}
