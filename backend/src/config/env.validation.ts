import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  DATABASE_URL!: string;

  // Claude through OpenRouter (https://openrouter.ai). Without a key, LLM-backed steps fail gracefully.
  @IsOptional()
  @IsString()
  OPENROUTER_API_KEY?: string;

  @IsString()
  OPENROUTER_MODEL: string = 'anthropic/claude-sonnet-5.5';

  @IsString()
  OPENROUTER_BASE_URL: string = 'https://openrouter.ai/api/v1';

  @IsString()
  UPLOAD_DIR: string = './uploads';
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
