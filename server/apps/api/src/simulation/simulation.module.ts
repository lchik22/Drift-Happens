import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Customer,
  QUEUE_CHANGE_EVENTS,
  RMQ_API_CLIENT,
  Transaction,
} from '@drift/shared';
import { SimulationController } from './simulation.controller';
import { SimulationService } from './simulation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, Transaction]),
    ClientsModule.registerAsync([
      {
        name: RMQ_API_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')],
            queue: QUEUE_CHANGE_EVENTS,
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [SimulationController],
  providers: [SimulationService],
})
export class SimulationModule {}
