import { IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class SimulateTransactionDto {
  @IsUUID()
  customerId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsOptional()
  occurredAt?: string;
}
