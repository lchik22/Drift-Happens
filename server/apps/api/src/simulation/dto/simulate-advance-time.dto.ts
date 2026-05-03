import { IsInt, Max, Min } from 'class-validator';

export class SimulateAdvanceTimeDto {
  @IsInt()
  @Min(1)
  @Max(365)
  days!: number;
}
