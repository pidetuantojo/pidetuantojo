export interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  aspectRatio?: 'square' | 'wide' | 'banner';
  objectFit?: 'cover' | 'contain';
  hint?: string;
}
