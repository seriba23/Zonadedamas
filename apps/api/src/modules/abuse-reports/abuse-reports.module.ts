import { Module } from '@nestjs/common';
import { AbuseReportsController } from './abuse-reports.controller';
import { AbuseReportsService } from './abuse-reports.service';

// Módulo de reportes/denuncias a la plataforma. Exporta el servicio para que
// otros módulos (marketplace, platform-admin) puedan crear/consultar reportes.
@Module({
  controllers: [AbuseReportsController],
  providers: [AbuseReportsService],
  exports: [AbuseReportsService],
})
export class AbuseReportsModule {}
