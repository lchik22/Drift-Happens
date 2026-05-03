import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EvaluationModule,
  QUEUE_DELTA_EVENTS,
  RMQ_DELTA_PUBLISHER,
  Segment,
} from '@drift/shared';
import { SegmentsController } from './segments.controller';
import { SegmentsService } from './segments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Segment]),
    EvaluationModule,
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
  controllers: [SegmentsController],
  providers: [SegmentsService],
  exports: [SegmentsService],
})
export class SegmentsModule {}
