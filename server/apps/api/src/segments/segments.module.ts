import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, RmqOptions, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DeltaBroadcasterService,
  EvaluationModule,
  QUEUE_DELTA_EVENTS,
  QUEUE_DELTA_EVENTS_WS,
  RMQ_DELTA_PUBLISHER,
  RMQ_DELTA_WS_PUBLISHER,
  Segment,
  SegmentDependency,
} from '@drift/shared';
import { SegmentsController } from './segments.controller';
import { SegmentsService } from './segments.service';

const rmqClient = (queue: string) => ({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (cfg: ConfigService): RmqOptions => ({
    transport: Transport.RMQ,
    options: {
      urls: [cfg.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')],
      queue,
      queueOptions: { durable: true },
    },
  }),
});

@Module({
  imports: [
    TypeOrmModule.forFeature([Segment, SegmentDependency]),
    EvaluationModule,
    ClientsModule.registerAsync([
      { name: RMQ_DELTA_PUBLISHER, ...rmqClient(QUEUE_DELTA_EVENTS) },
      { name: RMQ_DELTA_WS_PUBLISHER, ...rmqClient(QUEUE_DELTA_EVENTS_WS) },
    ]),
  ],
  controllers: [SegmentsController],
  providers: [SegmentsService, DeltaBroadcasterService],
  exports: [SegmentsService],
})
export class SegmentsModule {}
