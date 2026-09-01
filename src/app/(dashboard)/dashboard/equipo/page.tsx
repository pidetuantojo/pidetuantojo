'use client';

import { useState } from 'react';
import {
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { db } from '@/lib/firebase/config';
import type { AppUser } from '@/types';

const sg = "var(--font-space-grotesk, 'Inter', sans-serif)";
const sm = 'var(--font-space-mono, monospace)';
const MAX_VIEW_USERS = 2;

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchViewUsers(restaurantId: string): Promise<AppUser[]> {
  const res = await fetch(`/api/users?restaurantId=${restaurantId}`);
  const data = (await res.json()) as { users?: AppUser[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Error al obtener usuarios');
  return data.users ?? [];
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiCreateUser(payload: { email: string; password: string; displayName: string }) {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { uid?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Error al crear el usuario');
  return data.uid!;
}

async function apiUpdateUser(payload: {
  uid: string;
  email?: string;
  password?: string;
  displayName?: string;
}) {
  const res = await fetch('/api/users', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Error al actualizar el usuario');
}

async function apiDeleteUser(uid: string) {
  const res = await fetch('/api/users', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Error al eliminar el usuario');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.08em', color: '#9a8f86', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Field({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '11px 14px',
        borderRadius: 10,
        border: '1.5px solid #E7DED6',
        background: disabled ? '#f5f0ec' : '#fff',
        fontFamily: sg,
        fontSize: 14,
        color: '#1B1512',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color .15s',
        cursor: disabled ? 'not-allowed' : 'text',
      }}
      onFocus={(e) => { if (!disabled) e.target.style.borderColor = '#FF6A1A'; }}
      onBlur={(e) => { e.target.style.borderColor = '#E7DED6'; }}
    />
  );
}


function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: sg, fontSize: 13, fontWeight: 600, color: '#9a8f86',
        padding: 0, marginBottom: 24,
      }}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 5l-7 7 7 7" />
      </svg>
      Volver al equipo
    </button>
  );
}

function ActionButton({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  isLoading = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'ghost' | 'danger';
  isLoading?: boolean;
  disabled?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg, #FF8A2B, #EA3B2E)',
      color: '#fff',
      border: 'none',
    },
    ghost: {
      background: 'transparent',
      color: '#9a8f86',
      border: '1.5px solid #E7DED6',
    },
    danger: {
      background: 'transparent',
      color: '#ef4444',
      border: '1.5px solid #fecaca',
    },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isLoading || disabled}
      style={{
        ...styles[variant],
        padding: '10px 20px',
        borderRadius: 10,
        fontFamily: sg,
        fontSize: 14,
        fontWeight: 600,
        cursor: isLoading || disabled ? 'not-allowed' : 'pointer',
        opacity: isLoading || disabled ? 0.6 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'opacity .15s',
      }}
    >
      {isLoading && (
        <span style={{
          width: 14, height: 14, borderRadius: '50%',
          border: '2px solid currentColor', borderTopColor: 'transparent',
          display: 'inline-block', animation: 'spin 0.6s linear infinite',
        }} />
      )}
      {children}
    </button>
  );
}

// ─── Vista: Crear usuario ─────────────────────────────────────────────────────

interface CreateViewProps {
  restaurantId: string;
  onBack: () => void;
  onCreated: () => void;
}

function CreateView({ restaurantId, onBack, onCreated }: CreateViewProps) {
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field: keyof typeof form) {
    return (v: string) => setForm((f) => ({ ...f, [field]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.displayName.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Todos los campos son obligatorios');
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      const uid = await apiCreateUser({
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim(),
      });
      const now = new Date().toISOString();
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: form.email.trim(),
        displayName: form.displayName.trim(),
        role: 'restaurant_view',
        restaurantId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      } satisfies AppUser);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
      setLoading(false);
    }
  }

  return (
    <div>
      <BackButton onClick={onBack} />

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.1em', color: '#9a8f86', textTransform: 'uppercase', marginBottom: 6 }}>
          Equipo · Nuevo usuario
        </div>
        <h1 style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', color: '#1B1512', margin: 0 }}>
          Agregar usuario
        </h1>
        <p style={{ fontSize: 13, color: '#9a8f86', margin: '4px 0 0' }}>
          Este usuario podrá ver pedidos y contabilidad, pero no podrá modificar la configuración del restaurante.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{
          borderRadius: 16, border: '1px solid #EFE7DF', background: '#fff',
          padding: '24px', display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          <FieldGroup label="Nombre completo">
            <Field value={form.displayName} onChange={set('displayName')} placeholder="Ej: María López" />
          </FieldGroup>

          <FieldGroup label="Email">
            <Field value={form.email} onChange={set('email')} placeholder="maria@ejemplo.com" type="email" />
          </FieldGroup>

          <FieldGroup label="Contraseña">
            <Field value={form.password} onChange={set('password')} placeholder="Mínimo 6 caracteres" type="password" />
          </FieldGroup>

          {error && (
            <p style={{ fontSize: 13, color: '#ef4444', margin: 0, padding: '10px 14px', background: '#fef2f2', borderRadius: 8 }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <ActionButton variant="ghost" onClick={onBack}>Cancelar</ActionButton>
            <ActionButton type="submit" isLoading={loading}>Crear usuario</ActionButton>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── Vista: Editar usuario ────────────────────────────────────────────────────

interface EditViewProps {
  user: AppUser;
  onBack: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

function EditView({ user, onBack, onUpdated, onDeleted }: EditViewProps) {
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [infoError, setInfoError] = useState('');
  const [passError, setPassError] = useState('');
  const [infoLoading, setInfoLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    setInfoError('');
    if (!displayName.trim() || !email.trim()) {
      setInfoError('Nombre y email son obligatorios');
      return;
    }
    setInfoLoading(true);
    try {
      const updates: { uid: string; displayName?: string; email?: string } = { uid: user.uid };
      if (displayName.trim() !== user.displayName) updates.displayName = displayName.trim();
      if (email.trim() !== user.email) updates.email = email.trim();

      await apiUpdateUser(updates);
      const firestoreUpdates: Partial<AppUser> = { updatedAt: new Date().toISOString() };
      if (updates.displayName) firestoreUpdates.displayName = updates.displayName;
      if (updates.email) firestoreUpdates.email = updates.email;
      await updateDoc(doc(db, 'users', user.uid), firestoreUpdates);
      onUpdated();
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : 'Error inesperado');
      setInfoLoading(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassError('');
    if (password.length < 6) {
      setPassError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setPassError('Las contraseñas no coinciden');
      return;
    }
    setPassLoading(true);
    try {
      await apiUpdateUser({ uid: user.uid, password });
      setPassword('');
      setConfirmPassword('');
      onUpdated();
    } catch (err) {
      setPassError(err instanceof Error ? err.message : 'Error inesperado');
      setPassLoading(false);
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      await apiDeleteUser(user.uid);
      await deleteDoc(doc(db, 'users', user.uid));
      onDeleted();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error inesperado');
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      <BackButton onClick={onBack} />

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.1em', color: '#9a8f86', textTransform: 'uppercase', marginBottom: 6 }}>
          Equipo · Editar usuario
        </div>
        <h1 style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', color: '#1B1512', margin: 0 }}>
          {user.displayName ?? user.email}
        </h1>
        <p style={{ fontFamily: sm, fontSize: 12, color: '#9a8f86', margin: '4px 0 0' }}>
          {user.email}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Datos */}
        <form onSubmit={handleSaveInfo}>
          <div style={{ borderRadius: 16, border: '1px solid #EFE7DF', background: '#fff', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.08em', color: '#9a8f86', textTransform: 'uppercase' }}>
              Datos del usuario
            </div>

            <FieldGroup label="Nombre completo">
              <Field value={displayName} onChange={setDisplayName} />
            </FieldGroup>

            <FieldGroup label="Email">
              <Field value={email} onChange={setEmail} type="email" />
            </FieldGroup>

            {infoError && (
              <p style={{ fontSize: 13, color: '#ef4444', margin: 0, padding: '10px 14px', background: '#fef2f2', borderRadius: 8 }}>
                {infoError}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <ActionButton type="submit" isLoading={infoLoading}>Guardar cambios</ActionButton>
            </div>
          </div>
        </form>

        {/* Contraseña */}
        <form onSubmit={handleSavePassword}>
          <div style={{ borderRadius: 16, border: '1px solid #EFE7DF', background: '#fff', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.08em', color: '#9a8f86', textTransform: 'uppercase' }}>
              Cambiar contraseña
            </div>

            <FieldGroup label="Nueva contraseña">
              <Field value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres" type="password" />
            </FieldGroup>

            <FieldGroup label="Confirmar contraseña">
              <Field value={confirmPassword} onChange={setConfirmPassword} placeholder="Repetí la contraseña" type="password" />
            </FieldGroup>

            {passError && (
              <p style={{ fontSize: 13, color: '#ef4444', margin: 0, padding: '10px 14px', background: '#fef2f2', borderRadius: 8 }}>
                {passError}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <ActionButton type="submit" isLoading={passLoading}>Cambiar contraseña</ActionButton>
            </div>
          </div>
        </form>

        {/* Zona de peligro */}
        <div style={{ borderRadius: 16, border: '1px solid #fecaca', background: '#fff', padding: 24 }}>
          <div style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.08em', color: '#ef4444', textTransform: 'uppercase', marginBottom: 12 }}>
            Zona de peligro
          </div>

          {!confirmDelete ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1B1512', margin: '0 0 2px' }}>Eliminar usuario</p>
                <p style={{ fontSize: 13, color: '#9a8f86', margin: 0 }}>Esta acción no se puede deshacer.</p>
              </div>
              <ActionButton variant="danger" onClick={() => setConfirmDelete(true)}>
                Eliminar
              </ActionButton>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 14, color: '#1B1512', margin: 0 }}>
                ¿Confirmás que querés eliminar a <strong>{user.displayName ?? user.email}</strong>?
              </p>
              {deleteError && (
                <p style={{ fontSize: 13, color: '#ef4444', margin: 0, padding: '10px 14px', background: '#fef2f2', borderRadius: 8 }}>
                  {deleteError}
                </p>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <ActionButton variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</ActionButton>
                <ActionButton variant="danger" isLoading={deleteLoading} onClick={handleDelete}>
                  Sí, eliminar
                </ActionButton>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Vista: Lista de usuarios ─────────────────────────────────────────────────

type View = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; user: AppUser };

interface ListViewProps {
  restaurantId: string;
  users: AppUser[];
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (user: AppUser) => void;
}

function ListView({ users, isLoading, onAdd, onEdit }: ListViewProps) {
  const atLimit = users.length >= MAX_VIEW_USERS;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.1em', color: '#9a8f86', textTransform: 'uppercase', marginBottom: 6 }}>
          Equipo
        </div>
        <h1 style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', color: '#1B1512', margin: 0 }}>
          Usuarios de acceso
        </h1>
        <p style={{ fontSize: 13, color: '#9a8f86', margin: '4px 0 0' }}>
          Podés agregar hasta {MAX_VIEW_USERS} usuarios con acceso limitado (pedidos y contabilidad).
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <span style={{
              width: 26, height: 26, borderRadius: '50%',
              border: '3px solid #FF6A1A', borderTopColor: 'transparent',
              display: 'block', animation: 'spin 0.7s linear infinite',
            }} />
          </div>
        ) : users.length === 0 ? (
          <div style={{
            borderRadius: 16, border: '1.5px dashed #E7DED6', background: '#fff',
            padding: '40px 24px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, color: '#9a8f86', margin: 0 }}>
              Todavía no hay usuarios de acceso. Agregá hasta {MAX_VIEW_USERS}.
            </p>
          </div>
        ) : (
          users.map((u) => (
            <button
              key={u.uid}
              onClick={() => onEdit(u)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                borderRadius: 14, border: '1px solid #EFE7DF', background: '#fff',
                padding: '14px 18px', width: '100%', cursor: 'pointer',
                textAlign: 'left', transition: 'border-color .15s, box-shadow .15s',
                fontFamily: sg,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#FF6A1A';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 3px rgba(255,106,26,.08)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#EFE7DF';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #FFB02E, #EA3B2E)',
                display: 'grid', placeItems: 'center',
                fontWeight: 700, fontSize: 17, color: '#fff',
              }}>
                {(u.displayName ?? u.email)[0].toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1B1512', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.displayName ?? '—'}
                </div>
                <div style={{ fontFamily: sm, fontSize: 11, color: '#9a8f86', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.email}
                </div>
              </div>

              {/* Badge */}
              <div style={{
                fontFamily: sm, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase',
                color: '#9a8f86', background: '#f5f0ec', borderRadius: 6,
                padding: '4px 9px', flexShrink: 0,
              }}>
                Solo lectura
              </div>

              {/* Arrow */}
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#c4b8af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ActionButton onClick={onAdd} disabled={atLimit}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Agregar usuario
        </ActionButton>
        {atLimit && (
          <span style={{ fontSize: 13, color: '#9a8f86' }}>
            Límite de {MAX_VIEW_USERS} usuarios alcanzado
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EquipoPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const restaurantId = user?.restaurantId ?? '';
  const [view, setView] = useState<View>({ mode: 'list' });

  const { data: viewUsers = [], isLoading, error } = useQuery({
    queryKey: ['view-users', restaurantId],
    queryFn: () => fetchViewUsers(restaurantId),
    enabled: !!restaurantId,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['view-users', restaurantId] });
  }

  function goList() {
    setView({ mode: 'list' });
    refresh();
  }

  if (!user?.restaurantId) return null;

  return (
    <div style={{ fontFamily: sg, maxWidth: 560, margin: '0 auto' }}>
      {view.mode === 'list' && (
        <>
          {error && (
            <p style={{ fontSize: 13, color: '#ef4444', padding: '10px 14px', background: '#fef2f2', borderRadius: 8, marginBottom: 16 }}>
              Error al cargar usuarios: {(error as Error).message}
            </p>
          )}
          <ListView
            restaurantId={restaurantId}
            users={viewUsers}
            isLoading={isLoading}
            onAdd={() => setView({ mode: 'create' })}
            onEdit={(u) => setView({ mode: 'edit', user: u })}
          />
        </>
      )}

      {view.mode === 'create' && (
        <CreateView
          restaurantId={restaurantId}
          onBack={() => setView({ mode: 'list' })}
          onCreated={goList}
        />
      )}

      {view.mode === 'edit' && (
        <EditView
          user={view.user}
          onBack={() => setView({ mode: 'list' })}
          onUpdated={goList}
          onDeleted={goList}
        />
      )}
    </div>
  );
}
