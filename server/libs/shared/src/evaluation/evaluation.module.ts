import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../entities/customer.entity';
import { DeltaRecord } from '../entities/delta-record.entity';
import { MembershipSnapshot } from '../entities/membership-snapshot.entity';
import { Segment } from '../entities/segment.entity';
import { Transaction } from '../entities/transaction.entity';
import { DeltaCalculatorService } from './delta-calculator.service';
import { SegmentEvaluatorService } from './segment-evaluator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, Segment, MembershipSnapshot, DeltaRecord, Transaction]),
  ],
  providers: [SegmentEvaluatorService, DeltaCalculatorService],
  exports: [SegmentEvaluatorService, DeltaCalculatorService],
})
export class EvaluationModule {}
