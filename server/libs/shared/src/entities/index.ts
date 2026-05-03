export * from './rule.types';
export * from './customer.entity';
export * from './segment.entity';
export * from './segment-dependency.entity';
export * from './membership-snapshot.entity';
export * from './delta-record.entity';
export * from './transaction.entity';

import { Customer } from './customer.entity';
import { Segment } from './segment.entity';
import { SegmentDependency } from './segment-dependency.entity';
import { MembershipSnapshot } from './membership-snapshot.entity';
import { DeltaRecord } from './delta-record.entity';
import { Transaction } from './transaction.entity';

export const ALL_ENTITIES = [
  Customer,
  Segment,
  SegmentDependency,
  MembershipSnapshot,
  DeltaRecord,
  Transaction,
] as const;
