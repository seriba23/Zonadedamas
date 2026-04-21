import { Module } from '@nestjs/common';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [UploadsModule],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
