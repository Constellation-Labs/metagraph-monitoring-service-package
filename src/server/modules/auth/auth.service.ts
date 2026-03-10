import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { LoginResponseDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string): Promise<LoginResponseDto> {
    const expectedUser = this.configService.get<string>('AUTH_USERNAME');
    const expectedPass = this.configService.get<string>('AUTH_PASSWORD');

    if (username !== expectedUser || password !== expectedPass) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: username, username };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken, expiresIn: 86400 };
  }
}
