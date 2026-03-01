import { Controller, Get, Param, Res, NotFoundException, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import * as path from 'path';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  private sendFile(folder: string, filename: string, res: Response) {
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

  // Protected route for employee documents (ID scans, contracts, etc.)
  // Must be defined BEFORE the wildcard :folder route
  @Get('documents/:filename')
  @UseGuards(JwtAuthGuard)
  serveDocument(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    this.sendFile('documents', filename, res);
  }

  // Public routes for avatars and portfolio images
  @Get(':folder/:filename')
  serveFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    if (!['avatars', 'portfolio', 'results'].includes(folder)) {
      throw new NotFoundException('Carpeta no válida');
    }
    this.sendFile(folder, filename, res);
  }
}
