'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { Upload, X, ZoomIn } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ImageUploadProps } from './ImageUpload.types';

export function ImageUpload({
  value,
  onChange,
  label,
  hint,
  disabled,
  className,
  aspectRatio = 'wide',
  objectFit = 'cover',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setModalOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const heightClass = aspectRatio === 'square' ? 'h-32 w-32' : aspectRatio === 'banner' ? 'h-56 w-full' : 'h-36 w-full';

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/cloudinary/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Error al subir la imagen');

      const data = (await res.json()) as { url: string };
      onChange(data.url);
    } catch {
      setError('No se pudo subir la imagen. Intentá de nuevo.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className={cn('space-y-1', className)}>
      {label && <p className="text-sm font-medium text-gray-700">{label}</p>}

      {value ? (
        <>
          <div className={cn('relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50', heightClass)}>
            <Image src={value} alt="Imagen subida" fill className={cn(objectFit === 'contain' ? 'object-contain p-4' : 'object-cover')} />

            {/* botón ver imagen */}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70"
            >
              <ZoomIn className="h-3 w-3" />
              Ver imagen
            </button>

            {!disabled && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow-sm transition-colors hover:bg-white"
                aria-label="Eliminar imagen"
              >
                <X className="h-3.5 w-3.5 text-gray-700" />
              </button>
            )}
          </div>

          {/* modal */}
          {modalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-6"
              style={{ background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(8px)' }}
              onClick={() => setModalOpen(false)}
            >
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg transition-colors hover:bg-gray-100"
                >
                  <X className="h-4 w-4 text-gray-700" />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value}
                  alt="Vista previa"
                  style={{
                    display: 'block',
                    maxWidth: '90vw',
                    maxHeight: '85vh',
                    width: 'auto',
                    height: 'auto',
                    borderRadius: 12,
                    boxShadow: '0 24px 60px rgba(0,0,0,.4)',
                  }}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-orange-400 hover:bg-orange-50',
            heightClass,
            (disabled || uploading) && 'cursor-not-allowed opacity-60'
          )}
        >
          {uploading ? (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          ) : (
            <Upload className="h-5 w-5 text-gray-400" />
          )}
          <span className="text-xs text-gray-500">
            {uploading ? 'Subiendo...' : 'Clic para subir imagen'}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
