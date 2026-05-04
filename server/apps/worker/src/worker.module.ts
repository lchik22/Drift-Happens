import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from '@drift/shared';
import { CampaignModule } from './campaign/campaign.module';
import { ProcessingModule } from './processing/processing.module';
import { WorkerController } from './worker.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres' as const,
        url: cfg.get<string>('DATABASE_URL', 'postgres://drift:drift@localhost:5432/drift'),
        entities: [...ALL_ENTITIES],
        synchronize: false,
        logging: ['error', 'warn'],
      }),
    }),
    ProcessingModule,
    CampaignModule,
  ],
  controllers: [WorkerController],
})
export class WorkerModule {}
