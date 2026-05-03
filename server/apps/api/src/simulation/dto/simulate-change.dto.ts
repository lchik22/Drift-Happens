import { IsArray, IsIn, IsString, IsUUID } from 'class-validator';
import type { ChangeType } from '@drift/shared';

const CHANGE_TYPES: ChangeType[] = ['transaction', 'profile_update', 'time_tick', 'bulk_import'];

export class SimulateChangeDto {
  @IsUUID()
  customerId!: string;

  @IsIn(CHANGE_TYPES)
  changeType!: ChangeType;

  @IsArray()
  @IsString({ each: true })
  fieldsChanged!: string[];

  @IsString()
  timestamp!: string;
}
