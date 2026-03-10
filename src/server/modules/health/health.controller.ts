import { Controller, Get } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';

@Controller('api/health')
export class HealthController {
  private readonly startedAt = new Date();

  @Public()
  @Get()
  getHealth() {
    return {
      status: 'ok',
      uptime: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
