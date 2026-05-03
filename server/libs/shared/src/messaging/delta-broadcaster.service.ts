import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { SegmentDeltaEvent } from './events';
import {
  PATTERN_SEGMENT_DELTA,
  RMQ_DELTA_PUBLISHER,
  RMQ_DELTA_WS_PUBLISHER,
} from './patterns';

@Injectable()
export class DeltaBroadcasterService {
  constructor(
    @Inject(RMQ_DELTA_PUBLISHER) private readonly cascade: ClientProxy,
    @Inject(RMQ_DELTA_WS_PUBLISHER) private readonly ws: ClientProxy,
  ) {}

  broadcast(event: SegmentDeltaEvent): void {
    this.cascade.emit(PATTERN_SEGMENT_DELTA, event);
    this.ws.emit(PATTERN_SEGMENT_DELTA, event);
  }
}
