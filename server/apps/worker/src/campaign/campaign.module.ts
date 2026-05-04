import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer, Segment } from '@drift/shared';
import { CampaignController } from './campaign.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Segment, Customer])],
  controllers: [CampaignController],
})
export class CampaignModule {}
