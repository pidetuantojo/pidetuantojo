import type { PettyAttachment } from '../../types/cash.petty.types';

export interface AttachmentUploadProps {
  /** Adjuntos ya cargados (se muestran como chips). */
  value: readonly PettyAttachment[];
  /** Se llama con cada archivo subido correctamente. */
  onUploaded: (attachment: PettyAttachment) => void | Promise<void>;
  /** Si viene, los chips muestran el botón para quitar. */
  onRemove?: (index: number) => void;
  max?: number;
  disabled?: boolean;
  label?: string;
}
