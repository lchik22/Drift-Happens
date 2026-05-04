import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import {
  Customer,
  Rule,
  Segment,
  SegmentEvaluatorService,
  Transaction,
} from '@drift/shared';
import { ApiModule } from '../src/api.module';
import { SegmentsModule } from '../src/segments/segments.module';
import { SegmentsService } from '../src/segments/segments.service';

const log = new Logger('seed');

const ACTIVE_WINDOW_DAYS = 30;
const VIP_WINDOW_DAYS = 60;
const VIP_SUM_THRESHOLD = 5000;
const RISK_INACTIVITY_DAYS = 90;
const TOP_TIER_BALANCE = 10_000;

interface TxFixture {
  daysAgo: number;
  amount: number;
}

interface CustomerFixture {
  email: string;
  name: string;
  balance: number;
  profile: Record<string, string>;
  txHistory: TxFixture[];
}

const SEED_CUSTOMERS: CustomerFixture[] = [
  {
    email: 'alice@example.com',
    name: 'Alice',
    balance: 6500,
    profile: { tier: 'gold', country: 'GE', signup_source: 'organic' },
    txHistory: [
      { daysAgo: 2, amount: 300 },
      { daysAgo: 10, amount: 400 },
      { daysAgo: 25, amount: 200 },
    ],
  },
  {
    email: 'bob@example.com',
    name: 'Bob',
    balance: 250,
    profile: { tier: 'silver', country: 'GE', signup_source: 'referral' },
    txHistory: [{ daysAgo: 10, amount: 250 }],
  },
  {
    email: 'carol@example.com',
    name: 'Carol',
    balance: 8200,
    profile: { tier: 'gold', country: 'US', signup_source: 'ads' },
    txHistory: [
      { daysAgo: 1, amount: 2000 },
      { daysAgo: 5, amount: 3500 },
      { daysAgo: 20, amount: 1500 },
    ],
  },
  {
    email: 'dave@example.com',
    name: 'Dave',
    balance: 0,
    profile: { tier: 'bronze', country: 'GE', signup_source: 'organic' },
    txHistory: [],
  },
  {
    email: 'eve@example.com',
    name: 'Eve',
    balance: 5500,
    profile: { tier: 'gold', country: 'GE', signup_source: 'partner' },
    txHistory: [
      { daysAgo: 5, amount: 1200 },
      { daysAgo: 15, amount: 2000 },
      { daysAgo: 30, amount: 1500 },
    ],
  },
  {
    email: 'frank@example.com',
    name: 'Frank',
    balance: 120,
    profile: { tier: 'silver', country: 'GE', signup_source: 'ads' },
    txHistory: [
      { daysAgo: 95, amount: 3000 },
      { daysAgo: 120, amount: 2500 },
    ],
  },
  {
    email: 'grace@example.com',
    name: 'Grace',
    balance: 12000,
    profile: { tier: 'platinum', country: 'US', signup_source: 'referral' },
    txHistory: [
      { daysAgo: 0, amount: 5000 },
      { daysAgo: 15, amount: 3500 },
      { daysAgo: 45, amount: 2000 },
    ],
  },
  {
    email: 'heidi@example.com',
    name: 'Heidi',
    balance: 750,
    profile: { tier: 'bronze', country: 'GE', signup_source: 'organic' },
    txHistory: [{ daysAgo: 40, amount: 500 }],
  },
  {
    email: 'ivan@example.com',
    name: 'Ivan',
    balance: 3200,
    profile: { tier: 'silver', country: 'US', signup_source: 'partner' },
    txHistory: [
      { daysAgo: 7, amount: 800 },
      { daysAgo: 18, amount: 400 },
      { daysAgo: 50, amount: 300 },
    ],
  },
  {
    email: 'judy@example.com',
    name: 'Judy',
    balance: 15000,
    profile: { tier: 'platinum', country: 'US', signup_source: 'ads' },
    txHistory: [
      { daysAgo: 3, amount: 4000 },
      { daysAgo: 10, amount: 3500 },
      { daysAgo: 28, amount: 2500 },
      { daysAgo: 50, amount: 2000 },
    ],
  },
];

const ACTIVE_BUYERS_RULE: Rule = {
  type: 'date_window_count',
  field: 'transactions',
  windowDays: ACTIVE_WINDOW_DAYS,
  operator: '>=',
  value: 1,
};

const VIP_RULE: Rule = {
  type: 'sum_threshold',
  field: 'transactions.amount',
  windowDays: VIP_WINDOW_DAYS,
  operator: '>',
  value: VIP_SUM_THRESHOLD,
};

const RISK_GROUP_RULE: Rule = {
  type: 'compound',
  op: 'and',
  rules: [
    {
      type: 'date_window_count',
      field: 'transactions',
      windowDays: RISK_INACTIVITY_DAYS,
      operator: '=',
      value: 0,
    },
    { type: 'field_comparison', field: 'tx_count', operator: '>=', value: 1 },
  ],
};

const MARCH_CAMPAIGN_RULE: Rule = {
  type: 'field_comparison',
  field: 'tx_count',
  operator: '>=',
  value: 1,
};

const daysAgo = (n: number): Date => new Date(Date.now() - n * 86_400_000);

async function main(): Promise<void> {
  const ctx = await NestFactory.createApplicationContext(ApiModule, {
    logger: ['error', 'warn', 'log'],
  });
  const ds = ctx.get(DataSource);
  const segmentsModule = ctx.select(SegmentsModule);
  const segmentsService = segmentsModule.get(SegmentsService);
  const evaluator = segmentsModule.get(SegmentEvaluatorService, { strict: false });

  try {
    await ds.query(
      'TRUNCATE TABLE delta_records, membership_snapshots, segment_dependencies, transactions, segments, customers RESTART IDENTITY CASCADE',
    );
    log.log('truncated all tables');

    const customerRepo = ds.getRepository(Customer);
    const customers = await customerRepo.save(
      SEED_CUSTOMERS.map((c) =>
        customerRepo.create({
          email: c.email,
          name: c.name,
          balance: c.balance.toFixed(2),
          txCount: 0,
          lastTxAt: null,
          profile: c.profile,
        }),
      ),
    );
    log.log(`inserted ${customers.length} customers`);

    const txRepo = ds.getRepository(Transaction);
    const txRows: Transaction[] = [];
    for (let i = 0; i < customers.length; i += 1) {
      const customer = customers[i];
      const fixture = SEED_CUSTOMERS[i];
      for (const h of fixture.txHistory) {
        txRows.push(
          txRepo.create({
            customerId: customer.id,
            amount: h.amount.toFixed(2),
            occurredAt: daysAgo(h.daysAgo),
          }),
        );
      }
    }
    if (txRows.length > 0) {
      await txRepo.save(txRows);
    }
    log.log(`inserted ${txRows.length} transactions across ${customers.length} customers`);

    await ds.query(
      `UPDATE customers c
          SET tx_count = COALESCE(sub.cnt, 0),
              last_tx_at = sub.last_at
         FROM (
           SELECT customer_id, COUNT(*)::int AS cnt, MAX(occurred_at) AS last_at
             FROM transactions GROUP BY customer_id
         ) sub
        WHERE c.id = sub.customer_id`,
    );
    log.log('backfilled customers.tx_count and customers.last_tx_at from transaction history');

    const active = await segmentsService.create({
      name: 'Active buyers',
      description: `At least one transaction in the last ${ACTIVE_WINDOW_DAYS} days`,
      rules: ACTIVE_BUYERS_RULE,
      isStatic: false,
    });
    const vip = await segmentsService.create({
      name: 'VIP customers',
      description: `Total spend in last ${VIP_WINDOW_DAYS} days exceeds ${VIP_SUM_THRESHOLD}`,
      rules: VIP_RULE,
      isStatic: false,
    });
    const risk = await segmentsService.create({
      name: 'Risk group',
      description: `Previously active (tx_count >= 1) but no transactions in the last ${RISK_INACTIVITY_DAYS} days`,
      rules: RISK_GROUP_RULE,
      isStatic: false,
    });
    const vipAndActive = await segmentsService.create({
      name: 'VIP and active',
      description: 'Members of both VIP customers and Active buyers (level-1 cascade target)',
      rules: {
        type: 'compound',
        op: 'and',
        rules: [
          { type: 'segment_membership', segmentId: vip.id },
          { type: 'segment_membership', segmentId: active.id },
        ],
      },
      isStatic: false,
    });
    const topTier = await segmentsService.create({
      name: 'Top-tier loyalists',
      description: `VIP and active members with balance over ${TOP_TIER_BALANCE} (level-2 cascade target)`,
      rules: {
        type: 'compound',
        op: 'and',
        rules: [
          { type: 'segment_membership', segmentId: vipAndActive.id },
          {
            type: 'field_comparison',
            field: 'balance',
            operator: '>',
            value: TOP_TIER_BALANCE,
          },
        ],
      },
      isStatic: false,
    });
    const marchCampaign = await segmentsService.create({
      name: 'March campaign audience',
      description:
        'Frozen list at campaign launch: anyone who has ever transacted (tx_count >= 1)',
      rules: MARCH_CAMPAIGN_RULE,
      isStatic: true,
    });
    log.log(
      `created 6 segments via SegmentsService (validated path: parents-exist + cycle DFS + dependency rows)`,
    );

    const topoOrder: Segment[] = [active, vip, risk, vipAndActive, topTier, marchCampaign];
    for (const segment of topoOrder) {
      const result = await evaluator.refresh(segment);
      log.log(
        `initial snapshot for ${segment.name}: ${result.count} member(s) (added=${result.added.length})`,
      );
    }

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
