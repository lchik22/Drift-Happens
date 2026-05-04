import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, RmqOptions, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DeltaBroadcasterService,
  EvaluationModule,
  QUEUE_DELTA_EVENTS,
  QUEUE_DELTA_EVENTS_CAMPAIGN,
  QUEUE_DELTA_EVENTS_WS,
  RMQ_DELTA_CAMPAIGN_PUBLISHER,
  RMQ_DELTA_PUBLISHER,
  RMQ_DELTA_WS_PUBLISHER,
  Segment,
  SegmentDependency,
} from '@drift/shared';
import { CascadeController } from './cascade.controller';
import { DebouncerService } from './debouncer.service';
import { ProcessorService } from './processor.service';

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
    EvaluationModule,
    TypeOrmModule.forFeature([Segment, SegmentDependency]),
    ClientsModule.registerAsync([
      { name: RMQ_DELTA_PUBLISHER, ...rmqClient(QUEUE_DELTA_EVENTS) },
      { name: RMQ_DELTA_WS_PUBLISHER, ...rmqClient(QUEUE_DELTA_EVENTS_WS) },
      { name: RMQ_DELTA_CAMPAIGN_PUBLISHER, ...rmqClient(QUEUE_DELTA_EVENTS_CAMPAIGN) },
    ]),
  ],
  controllers: [CascadeController],
  providers: [DebouncerService, ProcessorService, DeltaBroadcasterService],
  exports: [DebouncerService],
})
export class ProcessingModule {}
