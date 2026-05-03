import { Module } from '@nestjs/common';
import { DeltasController } from './deltas.controller';
import { DeltasGateway } from './deltas.gateway';

@Module({
  controllers: [DeltasController],
  providers: [DeltasGateway],
  exports: [DeltasGateway],
})
export class RealtimeModule {}
