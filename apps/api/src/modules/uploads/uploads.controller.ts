import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { UploadsService } from './uploads.service';
import * as path from 'path';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get(':folder/:filename')
  serveFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    if (!['avatars', 'portfolio', 'documents'].includes(folder)) {
      throw new NotFoundException('Carpeta no válida');
    }

    const filePath = this.uploadsService.getFilePath(folder, filename);
    if (!filePath) {
      throw new NotFoundException('Archivo no encontrado');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    };

    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath);
  }
}
