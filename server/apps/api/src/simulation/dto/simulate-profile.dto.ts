import { IsObject, IsUUID } from 'class-validator';

export class SimulateProfileDto {
  @IsUUID()
  customerId!: string;

  @IsObject()
  patch!: Record<string, unknown>;
}
