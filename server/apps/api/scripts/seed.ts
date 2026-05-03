import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import {
  Customer,
  Rule,
  Segment,
  SegmentDependency,
  Transaction,
} from '@drift/shared';
import { ApiModule } from '../src/api.module';

const log = new Logger('seed');

interface SeedCustomer {
  email: string;
  name: string;
  balance: number;
  txCount: number;
  daysSinceLastTx: number | null;
}

const SEED_CUSTOMERS: SeedCustomer[] = [
  { email: 'alice@example.com', name: 'Alice', balance: 6500, txCount: 12, daysSinceLastTx: 2 },
  { email: 'bob@example.com', name: 'Bob', balance: 250, txCount: 1, daysSinceLastTx: 10 },
  { email: 'carol@example.com', name: 'Carol', balance: 8200, txCount: 30, daysSinceLastTx: 1 },
  { email: 'dave@example.com', name: 'Dave', balance: 0, txCount: 0, daysSinceLastTx: null },
  { email: 'eve@example.com', name: 'Eve', balance: 5500, txCount: 18, daysSinceLastTx: 5 },
  { email: 'frank@example.com', name: 'Frank', balance: 120, txCount: 4, daysSinceLastTx: 95 },
  { email: 'grace@example.com', name: 'Grace', balance: 9800, txCount: 22, daysSinceLastTx: 0 },
  { email: 'heidi@example.com', name: 'Heidi', balance: 750, txCount: 6, daysSinceLastTx: 40 },
  { email: 'ivan@example.com', name: 'Ivan', balance: 3200, txCount: 9, daysSinceLastTx: 7 },
  { email: 'judy@example.com', name: 'Judy', balance: 11200, txCount: 50, daysSinceLastTx: 3 },
];

const ACTIVE_BUYERS_RULE: Rule = {
  type: 'date_window_count',
  field: 'transactions',
  windowDays: 30,
  operator: '>=',
  value: 1,
};

const VIP_RULE: Rule = {
  type: 'sum_threshold',
  field: 'transactions.amount',
  windowDays: 60,
  operator: '>',
  value: 5000,
};

async function main(): Promise<void> {
  const ctx = await NestFactory.createApplicationContext(ApiModule, {
    logger: ['error', 'warn', 'log'],
  });
  const ds = ctx.get(DataSource);

  try {
    await ds.transaction(async (manager) => {
      await manager.query(
        'TRUNCATE TABLE delta_records, membership_snapshots, segment_dependencies, transactions, segments, customers RESTART IDENTITY CASCADE',
      );

      const customerEntities = SEED_CUSTOMERS.map((c) => {
        const lastTxAt =
          c.daysSinceLastTx === null
            ? null
            : new Date(Date.now() - c.daysSinceLastTx * 24 * 60 * 60 * 1000);
        return manager.create(Customer, {
          email: c.email,
          name: c.name,
          balance: c.balance.toFixed(2),
          txCount: c.txCount,
          lastTxAt,
          profile: {},
        });
      });
      const customers = await manager.save(customerEntities);
      log.log(`inserted ${customers.length} customers`);

      const txRows: Transaction[] = [];
      for (const customer of customers) {
        if (!customer.lastTxAt) continue;
        txRows.push(
          manager.create(Transaction, {
            customerId: customer.id,
            amount: customer.balance,
            occurredAt: customer.lastTxAt,
          }),
        );
      }
      if (txRows.length > 0) {
        await manager.save(txRows);
        log.log(`inserted ${txRows.length} transactions`);
      }

      const activeBuyers = await manager.save(
        manager.create(Segment, {
          name: 'Active buyers',
          description: 'At least one transaction in the last 30 days',
          rules: ACTIVE_BUYERS_RULE,
          isStatic: false,
        }),
      );
      const vipCustomers = await manager.save(
        manager.create(Segment, {
          name: 'VIP customers',
          description: 'Total spend in last 60 days exceeds 5000',
          rules: VIP_RULE,
          isStatic: false,
        }),
      );
      const vipAndActive = await manager.save(
        manager.create(Segment, {
          name: 'VIP and active',
          description: 'Members of both VIP customers and Active buyers',
          rules: {
            type: 'compound',
            op: 'and',
            rules: [
              { type: 'segment_membership', segmentId: vipCustomers.id },
              { type: 'segment_membership', segmentId: activeBuyers.id },
            ],
          },
          isStatic: false,
        }),
      );
      const marchCampaign = await manager.save(
        manager.create(Segment, {
          name: 'March campaign audience',
          description: 'Frozen list captured at campaign launch',
          rules: ACTIVE_BUYERS_RULE,
          isStatic: true,
        }),
      );
      log.log(
        `inserted segments: ${activeBuyers.name}, ${vipCustomers.name}, ${vipAndActive.name}, ${marchCampaign.name}`,
      );

      const deps = [
        manager.create(SegmentDependency, {
          parentId: activeBuyers.id,
          childId: vipAndActive.id,
        }),
        manager.create(SegmentDependency, {
          parentId: vipCustomers.id,
          childId: vipAndActive.id,
        }),
      ];
      await manager.save(deps);
      log.log(`inserted ${deps.length} segment dependencies (cascade demo)`);
    });

    log.log('seed complete');
  } finally {
    await ctx.close();
  }
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
