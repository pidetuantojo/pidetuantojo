export interface ReasonDialogProps {
  title: string;
  description?: string;
  confirmLabel: string;
  isPending?: boolean;
  /** Recibe el motivo ya validado; cerrar el diálogo es responsabilidad del padre. */
  onConfirm: (reason: string) => void;
  onClose: () => void;
}
