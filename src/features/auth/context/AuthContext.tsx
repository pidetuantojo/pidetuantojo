'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import type { Permission } from '@/constants/permissions';
import { auth, db } from '@/lib/firebase/config';
import { can as canWith, canAny as canAnyWith, legacyPermissions, normalizePermissions } from '@/lib/permissions/permissions';
import type { AppUser } from '@/types';

import { authService } from '../services/auth.service';
import type { AuthContextType } from '../types/auth.types';

const AuthContext = createContext<AuthContextType | null>(null);

/** Permisos efectivos del usuario (o los legados si aún no fue migrado). */
function permissionsOf(user: AppUser | null): Permission[] {
  if (!user) return [];
  return user.effectivePermissions ? normalizePermissions(user.effectivePermissions) : legacyPermissions(user.role);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeUser?.();
      unsubscribeUser = null;
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      // En tiempo real: si el admin cambia los permisos o desactiva al usuario, se aplica sin reiniciar sesión
      unsubscribeUser = onSnapshot(
        doc(db, 'users', firebaseUser.uid),
        (snap) => {
          const data = snap.exists() ? (snap.data() as AppUser) : null;
          if (data && data.isActive === false) {
            void authService.signOut();
            setUser(null);
          } else {
            setUser(data);
          }
          setLoading(false);
        },
        () => {
          setUser(null);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeUser?.();
      unsubscribeAuth();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    await authService.signIn(email, password);
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
  };

  const permissions = useMemo(() => permissionsOf(user), [user]);
  const can = useCallback((p: Permission) => canWith(permissions, p), [permissions]);
  const canAny = useCallback((ps: readonly Permission[]) => canAnyWith(permissions, ps), [permissions]);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, permissions, can, canAny }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

/** Atajo para componentes que solo necesitan permisos. */
export function usePermissions() {
  const { permissions, can, canAny } = useAuth();
  return { permissions, can, canAny };
}
