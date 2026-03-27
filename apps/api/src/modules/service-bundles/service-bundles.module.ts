import { Module } from '@nestjs/common';
import { ServiceBundlesController } from './service-bundles.controller';
import { ServiceBundlesService } from './service-bundles.service';

@Module({
  controllers: [ServiceBundlesController],
  providers: [ServiceBundlesService],
  exports: [ServiceBundlesService],
})
export class ServiceBundlesModule {}
