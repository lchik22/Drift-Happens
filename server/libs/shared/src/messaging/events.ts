export type ChangeType = 'transaction' | 'profile_update' | 'time_tick' | 'bulk_import';

export interface CustomerChangedEvent {
  customerId: string;
  changeType: ChangeType;
  fieldsChanged: string[];
  timestamp: string;
}

export interface SegmentDeltaEvent {
  segmentId: string;
  added: string[];
  removed: string[];
  computedAt: string;
  cascadeDepth?: number;
}
