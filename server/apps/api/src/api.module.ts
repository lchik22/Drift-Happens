import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from '@drift/shared';
import { ApiController } from './api.controller';
import { CustomersModule } from './customers/customers.module';
import { SegmentsModule } from './segments/segments.module';
import { SimulationModule } from './simulation/simulation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>(
          'DATABASE_URL',
          'postgres://drift:drift@localhost:5432/drift',
        ),
        entities: [...ALL_ENTITIES],
        synchronize: true,
        logging: ['error', 'warn', 'schema'],
      }),
    }),
    CustomersModule,
    SegmentsModule,
    SimulationModule,
  ],
  controllers: [ApiController],
})
export class ApiModule {}
