import { Type } from 'class-transformer';
import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';

import { LogLevel } from '../types';

export class LogEntryDto {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

export class LogFilterDto {
  @IsOptional()
  @IsEnum(LogLevel)
  level?: LogLevel;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  nodeIp?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
