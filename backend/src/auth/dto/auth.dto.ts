import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

// bcrypt only uses the first 72 bytes of a password, so longer ones are refused instead of silently cut.
const MAX_PASSWORD = 72;

export class RegisterDto {
  @ApiProperty({ example: 'Arjun Mehta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'arjun.mehta@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: MAX_PASSWORD })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(MAX_PASSWORD)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'arjun.mehta@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PASSWORD)
  password!: string;
}
