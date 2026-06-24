// Injectable + errores HTTP + Logger de NestJS.
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
// Módulos nativos de Node:
//   - fs ("file system"): leer/escribir/borrar archivos y carpetas en disco.
//   - path: construir rutas de archivo de forma segura y multiplataforma.
//   - crypto: utilidades criptográficas (aquí, generar identificadores únicos).
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Mapa "MIME type -> extensión". Se usa al descargar imágenes externas, donde
// solo conocemos el tipo de contenido (no el nombre del archivo) y necesitamos
// decidir con qué extensión guardarlo.
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

// MulterFile describe la FORMA del archivo subido tal como lo entrega "Multer"
// (la librería que NestJS/Express usa para procesar subidas de formularios).
interface MulterFile {
  fieldname: string;    // nombre del campo del formulario
  originalname: string; // nombre original del archivo en el equipo del usuario
  encoding: string;     // codificación de transferencia
  mimetype: string;     // tipo de contenido (ej. "image/png")
  size: number;         // tamaño en bytes
  buffer: Buffer;       // el CONTENIDO del archivo en memoria (Buffer = bytes crudos)
}

// Tipos de imagen aceptados para fotos normales (avatares, portafolio, etc.).
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Para documentos aceptamos lo mismo MÁS PDF. "[...IMAGE_MIME_TYPES, 'pdf']"
// usa el "spread" (...): copia todos los elementos del primer arreglo y añade
// 'application/pdf' al final, sin modificar el original.
const DOCUMENT_MIME_TYPES = [...IMAGE_MIME_TYPES, 'application/pdf'];
// Tamaño máximo permitido: 5 MB. 5 * 1024 * 1024 = bytes en 5 megabytes.
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
// Carpeta raíz donde se guardan todos los uploads. process.cwd() = carpeta de
// trabajo actual (apps/api); subimos dos niveles ('..','..') hasta la raíz del
// monorepo y entramos a "uploads". path.resolve construye la ruta absoluta.
const UPLOADS_BASE = path.resolve(process.cwd(), '..', '..', 'uploads');

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  // El constructor se ejecuta al crear el servicio: nos aseguramos de que las
  // carpetas de destino existan (si no, las creamos).
  constructor() {
    // Ensure upload directories exist
    // Recorremos cada subcarpeta esperada.
    for (const folder of ['avatars', 'portfolio', 'documents', 'results', 'products', 'payments']) {
      // path.join une la base con el nombre de carpeta usando el separador
      // correcto del sistema operativo.
      const dir = path.join(UPLOADS_BASE, folder);
      // Si la carpeta NO existe...
      if (!fs.existsSync(dir)) {
        // ...la creamos. "recursive: true" crea también las carpetas padre que
        // falten (en lugar de fallar si la ruta intermedia no existe).
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // validateFile(): comprueba que el archivo subido sea válido (existe, tipo
  // permitido y no supera el tamaño máximo). No devuelve nada (void); si algo
  // está mal, lanza un error 400 que corta la ejecución.
  // ───────────────────────────────────────────────────────────────────────────
  validateFile(file: MulterFile, folder: string = 'avatars'): void {
    // Si no llegó archivo, error.
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }
    // Elegimos la lista de tipos permitidos según la carpeta de destino:
    // documentos admiten PDF; el resto solo imágenes. (Operador ternario.)
    const allowed = folder === 'documents' ? DOCUMENT_MIME_TYPES : IMAGE_MIME_TYPES;
    // Si el tipo del archivo NO está en la lista permitida, error con mensaje
    // adecuado a la carpeta.
    if (!allowed.includes(file.mimetype)) {
      const msg = folder === 'documents'
        ? 'Tipo de archivo no permitido. Solo se aceptan JPEG, PNG, WebP y PDF'
        : 'Tipo de archivo no permitido. Solo se aceptan JPEG, PNG y WebP';
      throw new BadRequestException(msg);
    }
    // Si pesa más de lo permitido, error.
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('El archivo excede el tamaño máximo de 5MB');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // saveFile(): valida y GUARDA el archivo en disco con un nombre único.
  // Devuelve la URL pública (/api/uploads/...) para guardar en la base de datos.
  // El tipo del parámetro "folder" es una unión de literales: solo se aceptan
  // exactamente esos nombres de carpeta.
  // ───────────────────────────────────────────────────────────────────────────
  async saveFile(
    file: MulterFile,
    folder: 'avatars' | 'portfolio' | 'documents' | 'results' | 'products' | 'resources' | 'payments',
  ): Promise<string> {
    // Primero validamos (lanza error si no cumple).
    this.validateFile(file, folder);

    // Sacamos la extensión del nombre original en minúsculas. Si no tuviera
    // extensión, "|| '.jpg'" usa .jpg por defecto.
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    // Nombre único: un UUID aleatorio + la extensión. crypto.randomUUID()
    // genera un identificador prácticamente irrepetible, así dos archivos
    // distintos nunca se pisan ni se puede adivinar el nombre.
    const filename = `${crypto.randomUUID()}${ext}`;
    // Ruta física completa donde se escribirá el archivo.
    const filePath = path.join(UPLOADS_BASE, folder, filename);

    // Escribimos los bytes del archivo (file.buffer) en disco. "Sync" = de
    // forma síncrona (espera a terminar antes de seguir).
    fs.writeFileSync(filePath, file.buffer);

    // Devolvemos la URL pública con la que el frontend podrá pedir el archivo.
    return `/api/uploads/${folder}/${filename}`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // deleteFile(): borra del disco un archivo a partir de su URL pública.
  // ───────────────────────────────────────────────────────────────────────────
  async deleteFile(fileUrl: string): Promise<void> {
    // Extract folder/filename from URL like /api/uploads/avatars/uuid.jpg
    // Usamos una expresión regular para extraer carpeta y nombre de la URL.
    // Los paréntesis "(...)" son grupos de captura: el 1.º captura la carpeta
    // (solo una de las permitidas) y el 2.º el nombre del archivo. "$" = fin.
    const match = fileUrl.match(/\/api\/uploads\/(avatars|portfolio|documents|results|products|payments)\/(.+)$/);
    // Si la URL no encaja con el patrón, no hay nada que borrar: salimos.
    if (!match) return;

    // Desestructuramos el resultado. La primera posición (la coincidencia
    // completa) se ignora con una coma vacía; tomamos folder y filename.
    const [, folder, filename] = match;
    // path.basename se queda SOLO con el nombre del archivo, descartando
    // cualquier ruta. Esto evita "directory traversal" (ataques tipo
    // "../../otra/carpeta" para salir de la carpeta de uploads).
    const safeName = path.basename(filename); // Sanitize against directory traversal
    const filePath = path.join(UPLOADS_BASE, folder, safeName);

    // Si el archivo existe, lo borramos del disco (unlink = eliminar archivo).
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getFilePath(): devuelve la ruta física del archivo si existe, o null si no.
  // Lo usa el controlador para servir el archivo al navegador.
  // ───────────────────────────────────────────────────────────────────────────
  getFilePath(folder: string, filename: string): string | null {
    // Igual que arriba: nos quedamos solo con el nombre para evitar rutas
    // maliciosas.
    const safeName = path.basename(filename); // Sanitize
    const filePath = path.join(UPLOADS_BASE, folder, safeName);

    // Si no existe el archivo, devolvemos null; si existe, su ruta.
    if (!fs.existsSync(filePath)) return null;
    return filePath;
  }

  /**
   * Descarga una imagen desde una URL externa (ej. avatar de Google) y la
   * guarda localmente en /uploads/<folder>/. Resuelve el caso donde los
   * avatares de social login fallan al renderizarse por hotlinking,
   * referer policy, formato no soportado (GIF) o expiracion de la URL.
   * Devuelve el path local listo para guardar en BD.
   */
  async downloadAndSaveExternalImage(
    externalUrl: string,
    folder: 'avatars' | 'portfolio' | 'documents' | 'results' | 'products' | 'resources' | 'payments',
  ): Promise<string | null> {
    // try/catch: si la descarga o el guardado fallan, devolvemos null en vez de
    // romper (quien llama decidirá qué hacer si no hubo imagen).
    try {
      // fetch hace una petición HTTP para descargar la imagen externa.
      const res = await fetch(externalUrl, {
        // Sin referer para que Google/etc. no bloqueen
        // Algunos servidores bloquean si detectan que se "engancha" desde otro
        // sitio (hotlinking); mandar Referer vacío evita ese bloqueo.
        headers: { Referer: '' },
      });
      // res.ok es true solo si el código HTTP es 2xx (éxito). Si no, avisamos
      // y devolvemos null.
      if (!res.ok) {
        this.logger.warn(`downloadAndSaveExternalImage: HTTP ${res.status} para ${externalUrl}`);
        return null;
      }
      // Leemos el "content-type" de la respuesta para saber el formato real.
      // "|| ''": si no viene, usamos cadena vacía. .split(';')[0] descarta lo
      // que venga tras el ";" (ej. "; charset=..."). .trim() quita espacios y
      // .toLowerCase() normaliza a minúsculas (ej. "image/png").
      const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      // Traducimos el tipo a una extensión usando el mapa de arriba; si no está,
      // por defecto .jpg.
      const ext = EXT_BY_MIME[contentType] || '.jpg';
      // Descargamos el cuerpo como ArrayBuffer (los bytes crudos de la imagen).
      const arrBuf = await res.arrayBuffer();
      // byteLength = cuántos bytes ocupa.
      const size = arrBuf.byteLength;
      // Rechazamos imágenes vacías (0 bytes) o más grandes que el máximo.
      if (size === 0 || size > MAX_FILE_SIZE) {
        this.logger.warn(`downloadAndSaveExternalImage: tamaño invalido (${size} bytes) para ${externalUrl}`);
        return null;
      }
      // Nombre único + ruta física, igual que en saveFile().
      const filename = `${crypto.randomUUID()}${ext}`;
      const filePath = path.join(UPLOADS_BASE, folder, filename);
      // Buffer.from(arrBuf) convierte el ArrayBuffer a Buffer de Node para poder
      // escribirlo en disco.
      fs.writeFileSync(filePath, Buffer.from(arrBuf));
      // Devolvemos la URL pública local de la imagen ya guardada.
      return `/api/uploads/${folder}/${filename}`;
    } catch (err) {
      // "err as Error" le dice a TypeScript que trate err como un Error para
      // poder leer .message. Registramos el fallo y devolvemos null.
      this.logger.warn(`downloadAndSaveExternalImage: fallo ${externalUrl}: ${(err as Error).message}`);
      return null;
    }
  }
}
