'use client';

import { useRef, useState } from 'react';
import { AvatarCropModal } from './avatar-crop-modal';

interface ImageUploadProps {
  currentImage?: string | null;
  placeholder: React.ReactNode;
  onSelect: (file: File) => void;
  uploading?: boolean;
  className?: string;
  successMessage?: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function ImageUpload({
  currentImage,
  placeholder,
  onSelect,
  uploading,
  className = '',
  successMessage,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function openFileDialog() {
    inputRef.current?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('Solo se permiten archivos JPEG, PNG o WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo no puede superar 5MB');
      return;
    }

    setPendingFile(file);
    e.target.value = '';
  }

  function handleCropAccept(croppedFile: File) {
    setPendingFile(null);
    onSelect(croppedFile);
  }

  function handleCropCancel() {
    setPendingFile(null);
  }

  function handleChooseAnother() {
    setPendingFile(null);
    // Small delay so the modal closes before the file dialog opens
    setTimeout(() => openFileDialog(), 100);
  }

  const imageUrl = currentImage
    ? currentImage.startsWith('http')
      ? currentImage
      : `${API_URL}${currentImage}`
    : null;

  return (
    <>
      <div className="relative">
        <div
          className={`relative group cursor-pointer ${className}`}
          onClick={openFileDialog}
        >
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
          <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {uploading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleChange}
            className="hidden"
          />
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
              {successMessage}
            </span>
          </div>
        )}
      </div>

      {/* Crop modal */}
      {pendingFile && (
        <AvatarCropModal
          imageFile={pendingFile}
          onAccept={handleCropAccept}
          onCancel={handleCropCancel}
          onChooseAnother={handleChooseAnother}
        />
      )}
    </>
  );
}
