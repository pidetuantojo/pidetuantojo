'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { Upload, X, ZoomIn } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ImageUploadProps } from './ImageUpload.types';

const CROP_DISPLAY = 320;
const CANVAS_SIZE = 1080;
const MIN_DIM = 600;

export function ImageUpload({
  value,
  onChange,
  label,
  hint,
  disabled,
  className,
  aspectRatio = 'wide',
  objectFit = 'cover',
  cropEnabled = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Crop state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [cropNatural, setCropNatural] = useState({ w: 0, h: 0 });
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setModalOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  useEffect(() => {
    if (!cropSrc) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') cancelCrop(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropSrc]);

  const heightClass = aspectRatio === 'square' ? 'h-32 w-32' : aspectRatio === 'banner' ? 'h-56 w-full' : 'h-36 w-full';

  function getRenderedSize(nw: number, nh: number) {
    if (!nw || !nh) return { rw: CROP_DISPLAY, rh: CROP_DISPLAY };
    const scale = Math.max(CROP_DISPLAY / nw, CROP_DISPLAY / nh);
    return { rw: Math.round(nw * scale), rh: Math.round(nh * scale) };
  }

  function clampOffset(x: number, y: number, rw: number, rh: number) {
    return {
      x: Math.max(-(rw - CROP_DISPLAY), Math.min(0, x)),
      y: Math.max(-(rh - CROP_DISPLAY), Math.min(0, y)),
    };
  }

  function onCropImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    setCropNatural({ w: nw, h: nh });
    const { rw, rh } = getRenderedSize(nw, nh);
    setCropOffset({ x: -(rw - CROP_DISPLAY) / 2, y: -(rh - CROP_DISPLAY) / 2 });
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: cropOffset.x, oy: cropOffset.y };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const { rw, rh } = getRenderedSize(cropNatural.w, cropNatural.h);
    setCropOffset(clampOffset(dragRef.current.ox + dx, dragRef.current.oy + dy, rw, rh));
  }

  function onPointerUp() { dragRef.current = null; }

  function cancelCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function confirmCrop() {
    if (!cropSrc) return;
    const img = new window.Image();
    img.src = cropSrc;
    await new Promise<void>((res) => { img.onload = () => res(); });

    const { rw } = getRenderedSize(img.naturalWidth, img.naturalHeight);
    const scale = rw / img.naturalWidth;
    const srcX = Math.round((-cropOffset.x) / scale);
    const srcY = Math.round((-cropOffset.y) / scale);
    const srcSize = Math.round(CROP_DISPLAY / scale);

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    canvas.getContext('2d')!.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/webp', 0.88));

    URL.revokeObjectURL(cropSrc);
    setCropSrc(null);

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', new File([blob], 'product.webp', { type: 'image/webp' }));
      const res = await fetch('/api/cloudinary/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { url: string };
      onChange(data.url);
    } catch {
      setError('No se pudo subir la imagen. Intenta de nuevo.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (cropEnabled) {
      const bitmap = await createImageBitmap(file).catch(() => null);
      if (!bitmap) {
        setError('No se pudo leer la imagen.');
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
      if (bitmap.width < MIN_DIM || bitmap.height < MIN_DIM) {
        setError(`La imagen debe ser al menos ${MIN_DIM}×${MIN_DIM} px.`);
        if (inputRef.current) inputRef.current.value = '';
        bitmap.close();
        return;
      }
      bitmap.close();
      setCropSrc(URL.createObjectURL(file));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/cloudinary/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Error al subir la imagen');
      const data = (await res.json()) as { url: string };
      onChange(data.url);
    } catch {
      setError('No se pudo subir la imagen. Intenta de nuevo.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const { rw, rh } = getRenderedSize(cropNatural.w, cropNatural.h);

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--t-text-2)' }}>{label}</p>
      )}

      {value ? (
        <>
          <div
            className={cn('relative overflow-hidden rounded-lg', heightClass)}
            style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface-2)' }}
          >
            <Image src={value} alt="Imagen subida" fill className={cn(objectFit === 'contain' ? 'object-contain' : 'object-cover')} />

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
                className="absolute right-2 top-2 rounded-full p-1.5 shadow-sm transition-colors"
                style={{ background: 'var(--t-surface)' }}
                aria-label="Eliminar imagen"
              >
                <X className="h-3.5 w-3.5" style={{ color: 'var(--t-text-2)' }} />
              </button>
            )}
          </div>

          {/* preview modal */}
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
                  className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-lg transition-colors"
                  style={{ background: 'var(--t-surface)' }}
                >
                  <X className="h-4 w-4" style={{ color: 'var(--t-text-2)' }} />
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
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors hover:border-orange-400',
            heightClass,
            (disabled || uploading) && 'cursor-not-allowed opacity-60'
          )}
          style={{ borderColor: 'var(--t-border)', background: 'var(--t-surface-2)' }}
        >
          {uploading ? (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          ) : (
            <Upload className="h-5 w-5" style={{ color: 'var(--t-text-4)' }} />
          )}
          <span style={{ fontSize: 12, color: 'var(--t-text-3)' }}>
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
      {hint && !error && <p style={{ fontSize: 12, color: 'var(--t-text-4)' }}>{hint}</p>}

      {/* Crop modal */}
      {cropSrc && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div style={{
            background: 'var(--t-surface)', borderRadius: 20,
            padding: 24, maxWidth: 400, width: '100%',
            boxShadow: '0 24px 60px rgba(0,0,0,.4)',
          }}>
            <h3 style={{ margin: '0 0 16px', fontWeight: 700, fontSize: 16, color: 'var(--t-text-1)' }}>
              Ajustar encuadre
            </h3>

            {/* Crop area */}
            <div
              style={{
                width: CROP_DISPLAY, height: CROP_DISPLAY,
                overflow: 'hidden', borderRadius: 14,
                border: '2px solid #FF6A1A',
                cursor: 'grab', touchAction: 'none',
                position: 'relative', margin: '0 auto',
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cropSrc}
                alt="Crop preview"
                onLoad={onCropImgLoad}
                draggable={false}
                style={{
                  position: 'absolute',
                  width: rw,
                  height: rh,
                  left: cropOffset.x,
                  top: cropOffset.y,
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
            </div>

            <p style={{ margin: '12px 0 20px', fontSize: 12, color: 'var(--t-text-3)', textAlign: 'center' }}>
              Arrastrá para ajustar el encuadre
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={cancelCrop}
                style={{
                  flex: 1, padding: '11px 16px', borderRadius: 10,
                  border: '1.5px solid var(--t-border-2)',
                  background: 'transparent', cursor: 'pointer',
                  fontWeight: 600, fontSize: 14, color: 'var(--t-text-2)',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmCrop}
                disabled={uploading}
                style={{
                  flex: 1, padding: '11px 16px', borderRadius: 10,
                  border: 'none', background: '#FF6A1A',
                  cursor: uploading ? 'wait' : 'pointer',
                  fontWeight: 700, fontSize: 14, color: '#fff',
                  opacity: uploading ? 0.7 : 1,
                }}
              >
                {uploading ? 'Subiendo...' : 'Usar foto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
