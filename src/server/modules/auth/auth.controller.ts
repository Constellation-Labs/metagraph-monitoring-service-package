import { Controller, Post, Body } from '@nestjs/common';

import { AuthService } from './auth.service';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto.username, dto.password);
  }
}
