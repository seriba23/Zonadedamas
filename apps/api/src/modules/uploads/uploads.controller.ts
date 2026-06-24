// Decoradores/utilidades de NestJS:
//   - Controller, Get, Param: declarar endpoints y leer trozos de la URL.
//   - Res: inyecta el objeto "Response" de Express para responder a mano
//     (aquí lo necesitamos porque vamos a ENVIAR un archivo, no un JSON).
//   - NotFoundException: error HTTP 404.
//   - UseGuards: aplica un guard (control de acceso) a un endpoint.
import { Controller, Get, Param, Res, NotFoundException, UseGuards } from '@nestjs/common';
// "Response" es el TIPO del objeto respuesta de Express (la librería HTTP que
// usa NestJS por debajo). Lo importamos solo para tipar el parámetro "res".
import { Response } from 'express';
import { UploadsService } from './uploads.service';
// Guard que exige usuario autenticado (para los documentos privados).
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// "path": módulo de Node para manipular rutas de archivos de forma segura y
// multiplataforma (Windows/Linux). "* as path" importa todo el módulo.
import * as path from 'path';

// @Controller('uploads') => rutas bajo "/api/uploads".
// Este controlador SIRVE (devuelve) los archivos ya guardados; la subida en sí
// la hacen otros módulos usando el UploadsService.
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // sendFile(): método auxiliar privado que localiza el archivo en disco y lo
  // envía como respuesta HTTP con el tipo de contenido correcto. No es un
  // endpoint (no tiene @Get); lo usan los endpoints de abajo.
  // ───────────────────────────────────────────────────────────────────────────
  private sendFile(folder: string, filename: string, res: Response) {
    // Pedimos al servicio la ruta real en disco (o null si no existe).
    const filePath = this.uploadsService.getFilePath(folder, filename);
    // Si no se encontró el archivo, respondemos 404.
    if (!filePath) {
      throw new NotFoundException('Archivo no encontrado');
    }

    // path.extname obtiene la extensión (ej. ".PNG") y la pasamos a minúsculas.
    const ext = path.extname(filePath).toLowerCase();
    // "mimeMap" traduce cada extensión a su "MIME type" (cómo debe interpretar
    // el navegador el archivo). Record<string,string> = objeto texto->texto.
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    };

    // Content-Type le dice al navegador qué tipo de archivo recibe. Si la
    // extensión no está en el mapa, usamos 'application/octet-stream'
    // (genérico = "datos binarios", el navegador lo descargará).
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    // Cache-Control: permite al navegador GUARDAR el archivo en caché 86400
    // segundos (= 24 horas) para no volver a pedirlo cada vez. "public" = lo
    // pueden cachear también proxies intermedios.
    res.setHeader('Cache-Control', 'public, max-age=86400');
    // sendFile envía el archivo físico al cliente como cuerpo de la respuesta.
    res.sendFile(filePath);
  }

  // Protected route for employee documents (ID scans, contracts, etc.)
  // Must be defined BEFORE the wildcard :folder route
  // ── GET /api/uploads/documents/:filename ───────────────────────────────────
  // Sirve documentos privados (identificaciones, contratos...). Va PRIMERO que
  // la ruta genérica de abajo: en NestJS gana la ruta declarada antes, así que
  // esta intercepta "documents/..." y le aplica el guard de autenticación.
  @Get('documents/:filename')
  @UseGuards(JwtAuthGuard) // solo usuarios autenticados pueden verlos
  serveDocument(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    this.sendFile('documents', filename, res);
  }

  // Public routes for avatars and portfolio images
  // ── GET /api/uploads/:folder/:filename ─────────────────────────────────────
  // Sirve archivos PÚBLICOS (avatares, portafolio, etc.). Sin guard.
  @Get(':folder/:filename')
  serveFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Lista blanca de carpetas permitidas. Si "folder" NO está en la lista,
    // rechazamos con 404 (evita que pidan carpetas arbitrarias del servidor).
    // Nótese que "documents" NO está aquí: es privado y se sirve arriba.
    if (!['avatars', 'portfolio', 'results', 'products', 'resources', 'payments'].includes(folder)) {
      throw new NotFoundException('Carpeta no válida');
    }
    this.sendFile(folder, filename, res);
  }
}
