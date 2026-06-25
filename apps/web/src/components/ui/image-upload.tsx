// Directiva de Next.js que indica que este archivo se ejecuta en el NAVEGADOR
// (lado del cliente), no en el servidor. Necesario porque usamos hooks de React
// como useState y useRef, que no existen en el servidor.
'use client';

// Importamos dos hooks de React:
// - useRef: crea una "referencia" a un elemento del DOM (aquí al <input> oculto)
//   para poder llamar a .click() sobre él desde código.
// - useState: crea una variable de estado reactiva; cuando cambia, React vuelve
//   a renderizar el componente automáticamente.
import { useRef, useState } from 'react';

// Importamos el modal de recorte de avatar que se abre después de elegir imagen.
import { AvatarCropModal } from './avatar-crop-modal';

// ─── Definición de las PROPS (propiedades) del componente ───────────────────
// Una "interface" en TypeScript describe la forma (los campos) que debe tener
// un objeto. Aquí describimos qué props acepta <ImageUpload>.
interface ImageUploadProps {
  // URL actual de la imagen guardada (puede ser null si no hay foto aún).
  // El signo "?" al final significa que la prop es OPCIONAL.
  currentImage?: string | null;

  // Contenido JSX que se muestra cuando no hay imagen (ej. un círculo con
  // las iniciales del usuario). React.ReactNode es cualquier cosa que React
  // puede renderizar: texto, un <div>, un componente, etc.
  placeholder: React.ReactNode;

  // Función que el componente padre nos pasa para que la llamemos cuando el
  // usuario haya recortado y aceptado la imagen. Le pasamos el File resultante.
  onSelect: (file: File) => void;

  // Booleano opcional: si true, se muestra un spinner de carga en el overlay.
  uploading?: boolean;

  // Clases CSS adicionales para el contenedor del avatar (tamaño, etc.).
  className?: string;

  // Mensaje de éxito opcional que aparece debajo del avatar tras subir la foto.
  successMessage?: string | null;
}

// Lee la variable de entorno NEXT_PUBLIC_API_URL (definida en .env.local).
// Si no existe, usa la URL por defecto del servidor local de desarrollo.
// Esto nos permite que la app funcione tanto en local como en producción
// sin cambiar el código.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── Componente principal ────────────────────────────────────────────────────
// Exportamos la función como componente de React. La desestructuración
// `{ currentImage, placeholder, ... }` extrae cada prop del objeto que React
// nos pasa, para poder usarlas directamente como variables.
export function ImageUpload({
  currentImage,
  placeholder,
  onSelect,
  uploading,
  className = '',    // valor por defecto: string vacío
  successMessage,
}: ImageUploadProps) {
  // useRef<HTMLInputElement>(null): crea una referencia al elemento <input>.
  // Empezamos con null porque el elemento no existe todavía (aún no se renderizó).
  // Al montar el componente, React asigna el elemento real a inputRef.current.
  const inputRef = useRef<HTMLInputElement>(null);

  // Estado "pendingFile": guarda el archivo que el usuario eligió ANTES de
  // recortarlo. Empieza en null (ningún archivo pendiente).
  // "setPendingFile" es la función que usamos para actualizar ese estado.
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // ── Abre el selector de archivos del sistema operativo ──────────────────
  // inputRef.current es el <input type="file"> oculto en el DOM.
  // El operador "?." (optional chaining) evita un error si current es null
  // — solo llama a .click() si el elemento existe.
  function openFileDialog() {
    inputRef.current?.click();
  }

  // ── Manejador del evento "change" del <input type="file"> ───────────────
  // Se dispara cuando el usuario selecciona un archivo.
  // "e" es el evento; e.target.files es la lista de archivos elegidos.
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Tomamos el PRIMER archivo de la lista (el usuario solo puede elegir uno
    // porque el input no tiene el atributo "multiple").
    // El operador "?." evita error si files es null.
    // El operador "?.[0]" toma el elemento en la posición 0 (primero).
    const file = e.target.files?.[0];

    // Si por alguna razón no hay archivo, salimos de la función inmediatamente.
    if (!file) return;

    // Lista de tipos MIME permitidos. MIME es el estándar que identifica el
    // tipo de un archivo (ej. "image/jpeg" = foto JPEG).
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];

    // .includes() comprueba si el tipo del archivo está en la lista.
    // Si NO está permitido, mostramos alerta y salimos.
    if (!allowed.includes(file.type)) {
      alert('Solo se permiten archivos JPEG, PNG o WebP');
      return;
    }

    // Comprobamos el tamaño: file.size está en bytes.
    // 5 * 1024 * 1024 = 5.242.880 bytes = 5 MB.
    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo no puede superar 5MB');
      return;
    }

    // Si el archivo pasa las validaciones, lo guardamos en el estado.
    // Esto provocará que React renderice de nuevo y muestre el modal de recorte.
    setPendingFile(file);

    // Reseteamos el valor del input para que si el usuario cancela y vuelve a
    // elegir el MISMO archivo, el evento "change" se vuelva a disparar.
    // (Si el valor no se limpia, el navegador no dispara "change" con el mismo
    // archivo porque "no cambió nada".)
    e.target.value = '';
  }

  // ── Cuando el usuario acepta el recorte en el modal ─────────────────────
  // Recibimos el archivo ya recortado (croppedFile).
  function handleCropAccept(croppedFile: File) {
    // Limpiamos el estado: ya no hay archivo pendiente, el modal se cierra.
    setPendingFile(null);

    // Llamamos a la función que nos pasó el padre para que suba la imagen.
    onSelect(croppedFile);
  }

  // ── Cuando el usuario cancela el recorte ────────────────────────────────
  function handleCropCancel() {
    // Solo limpiamos el estado; el modal desaparece.
    setPendingFile(null);
  }

  // ── Cuando el usuario quiere elegir otra foto desde el modal ────────────
  function handleChooseAnother() {
    // Primero cerramos el modal limpiando el estado.
    setPendingFile(null);
    // Small delay so the modal closes before the file dialog opens
    // Abrimos el selector con un pequeño retraso (100ms) para que el modal
    // termine de cerrarse antes de que aparezca el selector del SO.
    // setTimeout(función, milisegundos) ejecuta la función después del retraso.
    setTimeout(() => openFileDialog(), 100);
  }

  // ── Construye la URL completa de la imagen actual ───────────────────────
  // Si currentImage existe (no es null/undefined/string vacío):
  //   - Si ya empieza con "http" (es una URL completa), la usamos tal cual.
  //   - Si no, la prefijamos con la URL del servidor (ej. "/uploads/foto.jpg"
  //     → "http://localhost:3001/uploads/foto.jpg").
  // Si currentImage no existe, imageUrl queda en null (no mostramos nada).
  const imageUrl = currentImage
    ? currentImage.startsWith('http')
      ? currentImage
      : `${API_URL}${currentImage}`
    : null;

  // ── JSX retornado: lo que se renderiza en la pantalla ───────────────────
  return (
    // Fragment (<>...</>): envuelve múltiples elementos sin añadir un nodo
    // extra al DOM. Aquí necesitamos devolver el avatar Y el modal.
    <>
      {/* Contenedor externo con position:relative para poder posicionar el
          mensaje de éxito con position:absolute (-bottom-8) */}
      <div className="relative">
        {/* Contenedor del avatar. Tiene "group" de Tailwind: permite que los
            hijos usen "group-hover:" para reaccionar al hover del padre.
            onClick llama a openFileDialog cuando el usuario hace clic. */}
        <div
          className={`relative group cursor-pointer ${className}`}
          onClick={openFileDialog}
        >
          {/* Renderizado condicional: si imageUrl tiene valor, mostramos la
              foto actual. Si no, mostramos el placeholder (ej. iniciales). */}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Foto"
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            placeholder
          )}

          {/* Hover overlay */}
          {/* Overlay semitransparente que aparece al pasar el cursor.
              - opacity-0: invisible por defecto.
              - group-hover:opacity-100: visible cuando el padre tiene hover.
              - transition-opacity: la transición es suave (animada). */}
          <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {/* Si está subiendo (uploading=true), mostramos spinner.
                Si no, mostramos el icono de cámara. */}
            {uploading ? (
              // Spinner: círculo con animación "spin" (gira continuamente).
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
            ) : (
              // Icono SVG de cámara (dibujado con trazos vectoriales).
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </div>

          {/* Input de archivo OCULTO (className="hidden").
              - ref={inputRef}: conectamos la referencia para poder llamar .click().
              - accept: restringe qué archivos muestra el selector del SO.
              - onChange: llama a handleChange cada vez que el usuario elige archivo. */}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleChange}
            className="hidden"
          />
        </div>

        {/* Success message */}
        {/* Renderizado condicional con &&: si successMessage tiene valor (no
            es null/undefined/string vacío), renderiza el mensaje verde.
            Si es falsy, React no renderiza nada. */}
        {successMessage && (
          // Posicionado con absolute para que quede justo debajo del avatar.
          // -translate-x-1/2 + left-1/2 centra horizontalmente el elemento.
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
              {successMessage}
            </span>
          </div>
        )}
      </div>

      {/* Crop modal */}
      {/* Solo renderizamos el modal si pendingFile no es null.
          Cuando el usuario elige un archivo, pendingFile se llena y el modal
          aparece. Cuando acepta o cancela, pendingFile vuelve a null y
          el modal desaparece (React lo desmonta del DOM). */}
      {pendingFile && (
        <AvatarCropModal
          imageFile={pendingFile}           // el archivo a recortar
          onAccept={handleCropAccept}       // callback: recorte aceptado
          onCancel={handleCropCancel}       // callback: recorte cancelado
          onChooseAnother={handleChooseAnother} // callback: elegir otra foto
        />
      )}
    </>
  );
}
