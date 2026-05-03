import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Segment } from './segment.entity';

@Entity('membership_snapshots')
@Index('idx_membership_snapshots_segment_evaluated_at', ['segmentId', 'evaluatedAt'])
export class MembershipSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'segment_id', type: 'uuid' })
  segmentId!: string;

  @ManyToOne(() => Segment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'segment_id' })
  segment!: Segment;

  @Column({ name: 'customer_ids', type: 'uuid', array: true, default: () => "'{}'::uuid[]" })
  customerIds!: string[];

  @Column({ name: 'member_count', type: 'integer', default: 0 })
  memberCount!: number;

  @Column({ name: 'evaluated_at', type: 'timestamptz', default: () => 'now()' })
  evaluatedAt!: Date;
}
