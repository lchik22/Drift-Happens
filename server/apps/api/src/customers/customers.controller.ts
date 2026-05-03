import { Controller, Get } from '@nestjs/common';
import type { Customer } from '@drift/shared';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  findAll(): Promise<Customer[]> {
    return this.service.findAll();
  }
}
