import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Segment } from './segment.entity';

@Entity('segment_dependencies')
@Index('idx_segment_dependencies_child', ['childId'])
export class SegmentDependency {
  @PrimaryColumn({ name: 'parent_id', type: 'uuid' })
  parentId!: string;

  @PrimaryColumn({ name: 'child_id', type: 'uuid' })
  childId!: string;

  @ManyToOne(() => Segment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent!: Segment;

  @ManyToOne(() => Segment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'child_id' })
  child!: Segment;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
