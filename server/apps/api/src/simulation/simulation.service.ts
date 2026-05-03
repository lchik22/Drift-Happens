import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import {
  Customer,
  PATTERN_CUSTOMER_CHANGED,
  RMQ_API_CLIENT,
  Transaction,
} from '@drift/shared';
import type { CustomerChangedEvent } from '@drift/shared';
import { SimulateTransactionDto } from './dto/simulate-transaction.dto';

interface RecordedTransaction {
  transaction: Transaction;
  customer: Customer;
}

@Injectable()
export class SimulationService {
  private readonly logger = new Logger(SimulationService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(RMQ_API_CLIENT) private readonly client: ClientProxy,
  ) {}

  async recordTransaction(dto: SimulateTransactionDto): Promise<RecordedTransaction> {
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();

    const result = await this.dataSource.transaction(async (manager) => {
      const customer = await manager.findOne(Customer, { where: { id: dto.customerId } });
      if (!customer) {
        throw new NotFoundException(`Customer ${dto.customerId} not found`);
      }

      const tx = manager.create(Transaction, {
        customerId: customer.id,
        amount: dto.amount.toFixed(2),
        occurredAt,
      });
      const savedTx = await manager.save(tx);

      customer.balance = (Number(customer.balance) + dto.amount).toFixed(2);
      customer.txCount += 1;
      if (!customer.lastTxAt || customer.lastTxAt < occurredAt) {
        customer.lastTxAt = occurredAt;
      }
      const savedCustomer = await manager.save(customer);

      return { transaction: savedTx, customer: savedCustomer };
    });

    this.publishCustomerChanged({
      customerId: result.customer.id,
      changeType: 'transaction',
      fieldsChanged: ['balance', 'tx_count', 'last_tx_at'],
      timestamp: occurredAt.toISOString(),
    });

    return result;
  }

  publishCustomerChanged(event: CustomerChangedEvent): void {
    this.client.emit(PATTERN_CUSTOMER_CHANGED, event);
    this.logger.log(`emitted ${PATTERN_CUSTOMER_CHANGED} for customer ${event.customerId}`);
  }
}
