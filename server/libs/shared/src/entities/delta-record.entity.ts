import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Segment } from './segment.entity';

@Entity('delta_records')
@Index('idx_delta_records_segment_computed_at', ['segmentId', 'computedAt'])
export class DeltaRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'segment_id', type: 'uuid' })
  segmentId!: string;

  @ManyToOne(() => Segment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'segment_id' })
  segment!: Segment;

  @Column({ type: 'uuid', array: true, default: () => "'{}'::uuid[]" })
  added!: string[];

  @Column({ type: 'uuid', array: true, default: () => "'{}'::uuid[]" })
  removed!: string[];

  @Column({ name: 'added_count', type: 'integer', default: 0 })
  addedCount!: number;

  @Column({ name: 'removed_count', type: 'integer', default: 0 })
  removedCount!: number;

  @Column({ name: 'computed_at', type: 'timestamptz', default: () => 'now()' })
  computedAt!: Date;
}
