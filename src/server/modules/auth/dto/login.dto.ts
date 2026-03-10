import { IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

export class LoginResponseDto {
  accessToken: string;
  expiresIn: number;
}
