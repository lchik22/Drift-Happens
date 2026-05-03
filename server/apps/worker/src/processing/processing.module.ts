import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EvaluationModule,
  QUEUE_DELTA_EVENTS,
  RMQ_DELTA_PUBLISHER,
  Segment,
  SegmentDependency,
} from '@drift/shared';
import { CascadeController } from './cascade.controller';
import { DebouncerService } from './debouncer.service';
import { ProcessorService } from './processor.service';

@Module({
  imports: [
    EvaluationModule,
    TypeOrmModule.forFeature([Segment, SegmentDependency]),
    ClientsModule.registerAsync([
      {
        name: RMQ_DELTA_PUBLISHER,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (cfg: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [cfg.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')],
            queue: QUEUE_DELTA_EVENTS,
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [CascadeController],
  providers: [DebouncerService, ProcessorService],
  exports: [DebouncerService],
})
export class ProcessingModule {}
