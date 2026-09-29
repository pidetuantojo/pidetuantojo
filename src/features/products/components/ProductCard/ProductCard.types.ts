import type { Category, Product } from '@/types';

export interface ProductCardProps {
  product: Product;
  category?: Category;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onEdit?: (product: Product) => void;
  onToggleAvailable?: (id: string, isAvailable: boolean) => void;
  onDelete?: (id: string, name: string) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  isToggling?: boolean;
  isDeleting?: boolean;
  isMoving?: boolean;
}
