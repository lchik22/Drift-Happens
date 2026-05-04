import { Rule } from './rule';

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  rules: Rule;
  isStatic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSegmentDto {
  name: string;
  description?: string;
  rules: Rule;
  isStatic?: boolean;
}

export interface RefreshResult {
  memberIds: string[];
  count: number;
  added: string[];
  removed: string[];
  wasNoOp: boolean;
  snapshotId: string | null;
  deltaId: string | null;
  evaluatedAt: string;
}
