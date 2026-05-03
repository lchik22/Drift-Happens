import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  SegmentDeltaEvent,
  WS_EVENT_SEGMENT_DELTA,
  WS_NAMESPACE_DELTAS,
} from '@drift/shared';

const ROOM_ALL = 'all';
const roomFor = (segmentId: string): string => `segment:${segmentId}`;

@WebSocketGateway({
  namespace: WS_NAMESPACE_DELTAS,
  cors: { origin: true, credentials: true },
})
export class DeltasGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(DeltasGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    void client.join(ROOM_ALL);
    this.logger.log(`client ${client.id} connected (joined ${ROOM_ALL})`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`client ${client.id} disconnected`);
  }

  @SubscribeMessage('subscribe')
  onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { segmentId: string },
  ): { ok: true; room: string } {
    const room = roomFor(body.segmentId);
    void client.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage('unsubscribe')
  onUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { segmentId: string },
  ): { ok: true; room: string } {
    const room = roomFor(body.segmentId);
    void client.leave(room);
    return { ok: true, room };
  }

  publish(event: SegmentDeltaEvent): void {
    this.server.to(ROOM_ALL).emit(WS_EVENT_SEGMENT_DELTA, event);
    this.server.to(roomFor(event.segmentId)).emit(WS_EVENT_SEGMENT_DELTA, event);
  }
}
