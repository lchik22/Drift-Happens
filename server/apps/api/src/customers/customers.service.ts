import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '@drift/shared';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
  ) {}

  findAll(): Promise<Customer[]> {
    return this.customers.find({ order: { createdAt: 'ASC' } });
  }
}
