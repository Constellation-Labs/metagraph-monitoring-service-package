import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class RestartRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RestartNodeRequestDto {
  @IsNumber()
  nodeIndex: number;

  @IsArray()
  @IsString({ each: true })
  layers: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ToggleMonitoringDto {
  enabled: boolean;
}

export class OperationResultDto {
  operationId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  message?: string;
}
