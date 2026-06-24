// Global: hace que lo que este módulo EXPORTA esté disponible en TODA la app
// sin tener que importar UploadsModule en cada módulo que lo necesite.
// Module: decorador que agrupa controladores y servicios.
import { Global, Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';

// @Global() => el UploadsService queda disponible globalmente (muchos módulos
// suben/borran archivos: avatares, portafolio, documentos, etc.).
@Global()
@Module({
  controllers: [UploadsController], // expone los endpoints para servir archivos
  providers: [UploadsService],      // lógica de guardar/borrar/validar archivos
  exports: [UploadsService],        // se comparte con el resto de la aplicación
})
export class UploadsModule {}
