import type { Permission } from '@/constants/permissions';
import type { AppUser } from '@/types';

export interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  // Permisos efectivos del usuario (src/lib/permissions)
  permissions: Permission[];
  can: (permission: Permission) => boolean;
  canAny: (permissions: readonly Permission[]) => boolean;
}
