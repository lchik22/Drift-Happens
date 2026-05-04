import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  QUEUE_CHANGE_EVENTS,
  QUEUE_DELTA_EVENTS,
  QUEUE_DELTA_EVENTS_CAMPAIGN,
} from '@drift/shared';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerModule, { logger: ['error', 'warn', 'log'] });
  const cfg = app.get(ConfigService);
  const url = cfg.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672');

  const rmqOptions = (queue: string): MicroserviceOptions => ({
    transport: Transport.RMQ,
    options: {
      urls: [url],
      queue,
      queueOptions: { durable: true },
      noAck: false,
      prefetchCount: 16,
    },
  });

  app.connectMicroservice<MicroserviceOptions>(rmqOptions(QUEUE_CHANGE_EVENTS));
  app.connectMicroservice<MicroserviceOptions>(rmqOptions(QUEUE_DELTA_EVENTS));
  app.connectMicroservice<MicroserviceOptions>(rmqOptions(QUEUE_DELTA_EVENTS_CAMPAIGN));

  app.enableShutdownHooks();
  await app.startAllMicroservices();
  await app.init();
  Logger.log(
    `Worker consuming queues '${QUEUE_CHANGE_EVENTS}' (change events) + '${QUEUE_DELTA_EVENTS}' (cascade) + '${QUEUE_DELTA_EVENTS_CAMPAIGN}' (campaign notifications)`,
    'Bootstrap',
  );
}
void bootstrap();
