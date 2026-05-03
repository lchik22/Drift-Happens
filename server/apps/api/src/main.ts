import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { QUEUE_DELTA_EVENTS_WS } from '@drift/shared';
import { ApiModule } from './api.module';

async function bootstrap() {
  const app = await NestFactory.create(ApiModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT', 3000);
  const rabbitUrl = config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672');

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitUrl],
      queue: QUEUE_DELTA_EVENTS_WS,
      queueOptions: { durable: true },
      noAck: false,
      prefetchCount: 32,
    },
  });

  app.enableShutdownHooks();
  await app.startAllMicroservices();
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on http://0.0.0.0:${port}`, 'Bootstrap');
  Logger.log(`API consuming '${QUEUE_DELTA_EVENTS_WS}' for WS fan-out`, 'Bootstrap');
}
void bootstrap();
