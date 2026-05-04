import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DeltaRecord } from '../entities/delta-record.entity';
import { MembershipSnapshot } from '../entities/membership-snapshot.entity';
import type { Segment } from '../entities/segment.entity';
import type { SegmentDeltaEvent } from '../messaging/events';
import type { CompiledPredicate } from './rule-compiler';

export interface DeltaResult {
  members: string[];
  added: string[];
  removed: string[];
  wasNoOp: boolean;
  snapshotId: string | null;
  deltaId: string | null;
  computedAt: Date;
  event: SegmentDeltaEvent | null;
}

interface DiffRow {
  members: string[] | null;
  added: string[] | null;
  removed: string[] | null;
}

@Injectable()
export class DeltaCalculatorService {
  private readonly logger = new Logger(DeltaCalculatorService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(MembershipSnapshot)
    private readonly snapshots: Repository<MembershipSnapshot>,
  ) {}

  async computeAndPersist(segment: Segment, predicate: CompiledPredicate): Promise<DeltaResult> {
    const segmentIdParam = `$${predicate.params.length + 1}`;
    const sql = `
      WITH new_members AS (
        SELECT c.id FROM customers c WHERE ${predicate.sql}
      ),
      prev_ids AS (
        SELECT unnest(
          COALESCE(
            (SELECT customer_ids
               FROM membership_snapshots
              WHERE segment_id = ${segmentIdParam}
              ORDER BY evaluated_at DESC
              LIMIT 1),
            '{}'::uuid[]
          )
        ) AS id
      ),
      added_set AS (
        SELECT id FROM new_members
        EXCEPT
        SELECT id FROM prev_ids
      ),
      removed_set AS (
        SELECT id FROM prev_ids
        EXCEPT
        SELECT id FROM new_members
      )
      SELECT
        COALESCE((SELECT array_agg(id ORDER BY id) FROM new_members), '{}'::uuid[]) AS members,
        COALESCE((SELECT array_agg(id ORDER BY id) FROM added_set),  '{}'::uuid[]) AS added,
        COALESCE((SELECT array_agg(id ORDER BY id) FROM removed_set), '{}'::uuid[]) AS removed
    `;
    const params = [...predicate.params, segment.id];
    const rows: DiffRow[] = await this.dataSource.query(sql, params);
    const row = rows[0];
    const members = row?.members ?? [];
    const added = row?.added ?? [];
    const removed = row?.removed ?? [];
    const now = new Date();

    if (added.length === 0 && removed.length === 0) {
      const previous = await this.snapshots.findOne({
        where: { segmentId: segment.id },
        order: { evaluatedAt: 'DESC' },
        select: { id: true },
      });
      this.logger.log(`segment ${segment.name}: no-op (members unchanged, count=${members.length})`);
      return {
        members,
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
        customerIds: members,
        memberCount: members.length,
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
      members,
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
