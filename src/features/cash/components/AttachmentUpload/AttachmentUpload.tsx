'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/auth/authFetch';

import { attachmentKindOf, MAX_ATTACHMENTS } from '../../helpers/petty-forms.helpers';

import type { AttachmentUploadProps } from './AttachmentUpload.types';

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

/** Sube imágenes o PDF al almacenamiento (con la sesión del usuario) y los muestra como chips. */
export function AttachmentUpload({
  value,
  onUploaded,
  onRemove,
  max = MAX_ATTACHMENTS,
  disabled,
  label = 'Soportes (imagen o PDF)',
}: AttachmentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = value.length >= max;

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    setError(null);
    const kind = attachmentKindOf(file.type);
    if (!kind) {
      setError('Usá una imagen JPG, PNG, WebP o un PDF.');
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await authFetch('/api/cloudinary/upload', { method: 'POST', body });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? 'No se pudo subir el archivo.');
      }
      const { url } = (await response.json()) as { url: string };
      await onUploaded({ url, kind, name: file.name.slice(0, 120) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo subir el archivo.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[var(--t-text-2)]">{label}</p>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((attachment, index) => (
            <li
              key={`${attachment.url}-${index}`}
              className="flex items-center gap-2 rounded-full border border-[var(--t-border)] bg-[var(--t-surface)] px-3 py-1 text-xs text-[var(--t-text-1)]"
            >
              <a
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="max-w-[10rem] truncate font-medium hover:underline"
              >
                {attachment.kind === 'pdf' ? 'PDF · ' : 'Imagen · '}
                {attachment.name}
              </a>
              {onRemove && (
                <button
                  type="button"
                  aria-label={`Quitar ${attachment.name}`}
                  className="text-[var(--t-text-3)] hover:text-red-600"
                  onClick={() => onRemove(index)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        data-testid="attachment-input"
        onChange={handleChange}
        disabled={disabled || uploading || full}
      />
      <Button
        size="sm"
        variant="secondary"
        isLoading={uploading}
        disabled={disabled || full}
        onClick={() => inputRef.current?.click()}
      >
        {full ? `Máximo ${max} adjuntos` : 'Adjuntar archivo'}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
