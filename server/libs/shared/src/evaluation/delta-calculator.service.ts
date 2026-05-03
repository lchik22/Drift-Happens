import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DeltaRecord } from '../entities/delta-record.entity';
import { MembershipSnapshot } from '../entities/membership-snapshot.entity';
import type { Segment } from '../entities/segment.entity';
import type { SegmentDeltaEvent } from '../messaging/events';

export interface DeltaResult {
  added: string[];
  removed: string[];
  wasNoOp: boolean;
  snapshotId: string | null;
  deltaId: string | null;
  computedAt: Date;
  event: SegmentDeltaEvent | null;
}

@Injectable()
export class DeltaCalculatorService {
  private readonly logger = new Logger(DeltaCalculatorService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(MembershipSnapshot)
    private readonly snapshots: Repository<MembershipSnapshot>,
    @InjectRepository(DeltaRecord)
    private readonly deltas: Repository<DeltaRecord>,
  ) {}

  async computeAndPersist(segment: Segment, newMemberIds: string[]): Promise<DeltaResult> {
    const previous = await this.snapshots.findOne({
      where: { segmentId: segment.id },
      order: { evaluatedAt: 'DESC' },
    });
    const previousIds = previous?.customerIds ?? [];

    const oldSet = new Set(previousIds);
    const newSet = new Set(newMemberIds);
    const added = newMemberIds.filter((id) => !oldSet.has(id));
    const removed = previousIds.filter((id) => !newSet.has(id));
    const now = new Date();

    if (added.length === 0 && removed.length === 0) {
      this.logger.log(`segment ${segment.name}: no-op (members unchanged, count=${newMemberIds.length})`);
      return {
        added: [],
        removed: [],
        wasNoOp: true,
        snapshotId: previous?.id ?? null,
        deltaId: null,
        computedAt: now,
        event: null,
      };
    }

    const persisted = await this.dataSource.transaction(async (mgr) => {
      const snapshot = mgr.create(MembershipSnapshot, {
        segmentId: segment.id,
        customerIds: newMemberIds,
        memberCount: newMemberIds.length,
        evaluatedAt: now,
      });
      const savedSnapshot = await mgr.save(snapshot);

      const delta = mgr.create(DeltaRecord, {
        segmentId: segment.id,
        added,
        removed,
        addedCount: added.length,
        removedCount: removed.length,
        computedAt: now,
      });
      const savedDelta = await mgr.save(delta);

      return { snapshotId: savedSnapshot.id, deltaId: savedDelta.id };
    });

    this.logger.log(
      `segment ${segment.name}: delta +${added.length}/-${removed.length} (snapshot=${persisted.snapshotId.slice(0, 8)}…)`,
    );

    return {
      added,
      removed,
      wasNoOp: false,
      snapshotId: persisted.snapshotId,
      deltaId: persisted.deltaId,
      computedAt: now,
      event: {
        segmentId: segment.id,
        added,
        removed,
        computedAt: now.toISOString(),
      },
    };
  }
}
