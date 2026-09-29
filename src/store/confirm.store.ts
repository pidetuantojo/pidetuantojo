import { create } from 'zustand';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
}

interface ConfirmStore {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  resolve: ((val: boolean) => void) | null;
  showConfirm: (opts: ConfirmOptions | string) => Promise<boolean>;
  respond: (val: boolean) => void;
}

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  isOpen: false,
  title: '¿Estás seguro?',
  message: '',
  confirmLabel: 'Eliminar',
  resolve: null,

  showConfirm: (opts) => {
    const { title, message, confirmLabel } =
      typeof opts === 'string'
        ? { title: '¿Estás seguro?', message: opts, confirmLabel: 'Eliminar' }
        : { title: opts.title ?? '¿Estás seguro?', message: opts.message, confirmLabel: opts.confirmLabel ?? 'Eliminar' };

    return new Promise<boolean>((resolve) => {
      set({ isOpen: true, title, message, confirmLabel, resolve });
    });
  },

  respond: (val) => {
    get().resolve?.(val);
    set({ isOpen: false, resolve: null });
  },
}));
