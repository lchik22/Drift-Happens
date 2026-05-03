import { Controller, Get } from '@nestjs/common';

@Controller()
export class ApiController {
  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
