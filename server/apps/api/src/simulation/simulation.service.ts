import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { DataSource, EntityManager } from 'typeorm';
import {
  chunks,
  Customer,
  PATTERN_CUSTOMER_CHANGED,
  RMQ_API_CLIENT,
  Transaction,
} from '@drift/shared';
import type { CustomerChangedEvent } from '@drift/shared';
import { SimulateAdvanceTimeDto } from './dto/simulate-advance-time.dto';
import { SimulateBulkTransactionsDto } from './dto/simulate-bulk-transactions.dto';
import { SimulateProfileDto } from './dto/simulate-profile.dto';
import { SimulateTransactionDto } from './dto/simulate-transaction.dto';

interface RecordedTransaction {
  transaction: Transaction;
  customer: Customer;
}

const BULK_INSERT_CHUNK = 1_000;
const TIME_TICK_EMIT_CHUNK = 500;

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

  async updateProfile(dto: SimulateProfileDto): Promise<{
    customer: Pick<Customer, 'id' | 'profile' | 'updatedAt'>;
    fieldsChanged: string[];
  }> {
    const fieldsChanged = Object.keys(dto.patch);
    if (fieldsChanged.length === 0) {
      throw new BadRequestException('patch must contain at least one field');
    }

    const customer = await this.dataSource.transaction(async (mgr) => {
      const found = await mgr.findOne(Customer, { where: { id: dto.customerId } });
      if (!found) {
        throw new NotFoundException(`Customer ${dto.customerId} not found`);
      }
      found.profile = { ...(found.profile ?? {}), ...dto.patch };
      return mgr.save(found);
    });

    const event: CustomerChangedEvent = {
      customerId: customer.id,
      changeType: 'profile_update',
      fieldsChanged: fieldsChanged.map((k) => `profile.${k}`),
      timestamp: new Date().toISOString(),
    };
    this.publishCustomerChanged(event);

    return {
      customer: { id: customer.id, profile: customer.profile, updatedAt: customer.updatedAt },
      fieldsChanged: event.fieldsChanged,
    };
  }

  async advanceTime(dto: SimulateAdvanceTimeDto): Promise<{
    days: number;
    transactionsShifted: number;
    customersAffected: number;
  }> {
    const { days } = dto;
    const ts = new Date().toISOString();

    const { transactionsShifted, customersAffected, affectedIds } =
      await this.dataSource.transaction(async (mgr) => {
        const txRes: Array<{ count: string }> = await mgr.query(
          `WITH shifted AS (
             UPDATE transactions
                SET occurred_at = occurred_at - ($1 || ' days')::interval
              RETURNING 1
           )
           SELECT COUNT(*)::text AS count FROM shifted`,
          [days],
        );
        const custRes: Array<{ id: string }> = await mgr.query(
          `WITH shifted AS (
             UPDATE customers
                SET last_tx_at = last_tx_at - ($1 || ' days')::interval
              WHERE last_tx_at IS NOT NULL
              RETURNING id
           )
           SELECT id FROM shifted`,
          [days],
        );
        return {
          transactionsShifted: Number(txRes[0]?.count ?? 0),
          customersAffected: custRes.length,
          affectedIds: custRes.map((r) => r.id),
        };
      });

    let emitted = 0;
    for (const batch of chunks(affectedIds, TIME_TICK_EMIT_CHUNK)) {
      for (const id of batch) {
        this.publishCustomerChanged(
          {
            customerId: id,
            changeType: 'time_tick',
            fieldsChanged: ['last_tx_at'],
            timestamp: ts,
          },
          /*verbose*/ false,
        );
        emitted += 1;
      }
      await Promise.resolve();
    }
    this.logger.log(
      `advanced time by ${days}d: shifted ${transactionsShifted} tx, emitted ${emitted} time_tick events for ${customersAffected} customer(s)`,
    );
    return { days, transactionsShifted, customersAffected };
  }

  async bulkTransactions(dto: SimulateBulkTransactionsDto): Promise<{
    inserted: number;
    customersAffected: number;
    chunks: number;
  }> {
    const minAmount = dto.minAmount ?? 1;
    const maxAmount = dto.maxAmount ?? 100;
    if (maxAmount < minAmount) {
      throw new BadRequestException('maxAmount must be >= minAmount');
    }

    const customerIds = await this.resolveCustomerIds(dto.customerIds);
    const now = new Date();
    const aggregates = new Map<string, { sum: number; count: number; lastAt: Date }>();
    const rows: Array<Pick<Transaction, 'customerId' | 'amount' | 'occurredAt'>> = [];
    for (let i = 0; i < dto.count; i += 1) {
      const cid = customerIds[i % customerIds.length];
      const amount = Number((minAmount + Math.random() * (maxAmount - minAmount)).toFixed(2));
      const occurredAt = new Date(now.getTime() - Math.floor(Math.random() * 86_400_000));
      rows.push({ customerId: cid, amount: amount.toFixed(2), occurredAt });
      const agg = aggregates.get(cid) ?? { sum: 0, count: 0, lastAt: occurredAt };
      agg.sum += amount;
      agg.count += 1;
      if (occurredAt > agg.lastAt) agg.lastAt = occurredAt;
      aggregates.set(cid, agg);
    }

    let inserted = 0;
    let chunkCount = 0;
    for (const chunk of chunks(rows, BULK_INSERT_CHUNK)) {
      await this.dataSource.transaction(async (mgr) => {
        await mgr
          .createQueryBuilder()
          .insert()
          .into(Transaction)
          .values(chunk)
          .execute();
      });
      inserted += chunk.length;
      chunkCount += 1;
    }

    await this.dataSource.transaction(async (mgr) => {
      await this.applyAggregates(mgr, aggregates);
    });

    let emitted = 0;
    const ts = now.toISOString();
    for (const cid of customerIds) {
      if (!aggregates.has(cid)) continue;
      this.publishCustomerChanged(
        {
          customerId: cid,
          changeType: 'bulk_import',
          fieldsChanged: ['balance', 'tx_count', 'last_tx_at'],
          timestamp: ts,
        },
        /*verbose*/ false,
      );
      emitted += 1;
    }

    this.logger.log(
      `bulk: inserted ${inserted} tx in ${chunkCount} chunk(s) across ${aggregates.size} customer(s); emitted ${emitted} change events`,
    );
    return { inserted, customersAffected: aggregates.size, chunks: chunkCount };
  }

  publishCustomerChanged(event: CustomerChangedEvent, verbose = true): void {
    this.client.emit(PATTERN_CUSTOMER_CHANGED, event);
    if (verbose) {
      this.logger.log(`emitted ${PATTERN_CUSTOMER_CHANGED} for customer ${event.customerId}`);
    }
  }

  private async resolveCustomerIds(provided?: string[]): Promise<string[]> {
    if (provided && provided.length > 0) {
      const found = await this.dataSource.getRepository(Customer).find({
        select: { id: true },
        where: provided.map((id) => ({ id })),
      });
      if (found.length !== provided.length) {
        const missing = provided.filter((id) => !found.some((c) => c.id === id));
        throw new BadRequestException(`Unknown customer id(s): ${missing.join(', ')}`);
      }
      return provided;
    }
    const all: Array<{ id: string }> = await this.dataSource.query(
      'SELECT id FROM customers',
    );
    if (all.length === 0) {
      throw new BadRequestException('no customers exist; cannot bulk-insert');
    }
    return all.map((r) => r.id);
  }

  private async applyAggregates(
    mgr: EntityManager,
    aggregates: Map<string, { sum: number; count: number; lastAt: Date }>,
  ): Promise<void> {
    for (const [customerId, agg] of aggregates) {
      await mgr.query(
        `UPDATE customers
            SET balance = balance + $2,
                tx_count = tx_count + $3,
                last_tx_at = GREATEST(COALESCE(last_tx_at, 'epoch'::timestamptz), $4)
          WHERE id = $1`,
        [customerId, agg.sum.toFixed(2), agg.count, agg.lastAt.toISOString()],
      );
    }
  }
}
