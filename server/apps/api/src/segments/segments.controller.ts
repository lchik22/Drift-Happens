import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { RefreshResult, Segment } from '@drift/shared';
import { CreateSegmentDto } from './dto/create-segment.dto';
import { SegmentsService } from './segments.service';

@Controller('segments')
export class SegmentsController {
  constructor(private readonly service: SegmentsService) {}

  @Get()
  findAll(): Promise<Segment[]> {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<Segment> {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSegmentDto): Promise<Segment> {
    return this.service.create(dto);
  }

  @Post(':id/refresh')
  refresh(@Param('id', new ParseUUIDPipe()) id: string): Promise<RefreshResult> {
    return this.service.refresh(id);
  }
}
