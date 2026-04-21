import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENT_MIME_TYPES = [...IMAGE_MIME_TYPES, 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const UPLOADS_BASE = path.resolve(process.cwd(), '..', '..', 'uploads');

@Injectable()
export class UploadsService {
  constructor() {
    // Ensure upload directories exist
    for (const folder of ['avatars', 'portfolio', 'documents', 'results', 'products']) {
      const dir = path.join(UPLOADS_BASE, folder);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  validateFile(file: MulterFile, folder: string = 'avatars'): void {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }
    const allowed = folder === 'documents' ? DOCUMENT_MIME_TYPES : IMAGE_MIME_TYPES;
    if (!allowed.includes(file.mimetype)) {
      const msg = folder === 'documents'
        ? 'Tipo de archivo no permitido. Solo se aceptan JPEG, PNG, WebP y PDF'
        : 'Tipo de archivo no permitido. Solo se aceptan JPEG, PNG y WebP';
      throw new BadRequestException(msg);
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('El archivo excede el tamaño máximo de 5MB');
    }
  }

  async saveFile(
    file: MulterFile,
    folder: 'avatars' | 'portfolio' | 'documents' | 'results' | 'products' | 'resources',
  ): Promise<string> {
    this.validateFile(file, folder);

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOADS_BASE, folder, filename);

    fs.writeFileSync(filePath, file.buffer);

    return `/api/uploads/${folder}/${filename}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    // Extract folder/filename from URL like /api/uploads/avatars/uuid.jpg
    const match = fileUrl.match(/\/api\/uploads\/(avatars|portfolio|documents|results|products)\/(.+)$/);
    if (!match) return;

    const [, folder, filename] = match;
    const safeName = path.basename(filename); // Sanitize against directory traversal
    const filePath = path.join(UPLOADS_BASE, folder, safeName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  getFilePath(folder: string, filename: string): string | null {
    const safeName = path.basename(filename); // Sanitize
    const filePath = path.join(UPLOADS_BASE, folder, safeName);

    if (!fs.existsSync(filePath)) return null;
    return filePath;
  }
}
