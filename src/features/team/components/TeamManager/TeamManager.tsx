'use client';

import { useState } from 'react';

import { PermissionsEditor } from '@/components/permissions/PermissionsEditor';
import { PERMISSION_TEMPLATES, type Permission } from '@/constants/permissions';
import { useAuth } from '@/features/auth';
import { expandRequires, getPermissionDefinition, normalizePermissions } from '@/lib/permissions/permissions';

import { useTeam, useTeamMutations } from '../../hooks/useTeam';
import type { TeamData, TeamMember } from '../../services/team.service';

const sg = 'var(--font-sans, sans-serif)';
const sm = 'var(--font-mono, monospace)';
const ORANGE = '#FF6A1A';

// ─── UI básica ────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.08em', color: 'var(--t-text-3)', textTransform: 'uppercase' }}>{children}</span>;
}

function TextField({ label, value, onChange, type = 'text', placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Label>{label}</Label>
      <input
        type={type} value={value} placeholder={placeholder} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--t-input-border)', background: disabled ? 'var(--t-surface-2)' : 'var(--t-input-bg)', fontFamily: sg, fontSize: 14, color: 'var(--t-text-1)', outline: 'none', boxSizing: 'border-box' }}
      />
    </label>
  );
}

function Button({ children, onClick, type = 'button', variant = 'primary', loading, disabled }: {
  children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit';
  variant?: 'primary' | 'ghost' | 'danger'; loading?: boolean; disabled?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'linear-gradient(135deg, #FF8A2B, #EA3B2E)', color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: 'var(--t-text-3)', border: '1.5px solid var(--t-border)' },
    danger: { background: 'transparent', color: '#ef4444', border: '1.5px solid #fecaca' },
  };
  return (
    <button
      type={type} onClick={onClick} disabled={loading || disabled}
      style={{ ...styles[variant], padding: '10px 20px', borderRadius: 999, fontFamily: sg, fontSize: 14, fontWeight: 600, cursor: loading || disabled ? 'not-allowed' : 'pointer', opacity: loading || disabled ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
    >
      {loading && <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />}
      {children}
    </button>
  );
}

function Card({ title, danger, children }: { title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${danger ? '#fecaca' : 'var(--t-border-2)'}`, background: 'var(--t-surface)', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <span style={{ fontFamily: sm, fontSize: 10, letterSpacing: '.08em', color: danger ? '#ef4444' : 'var(--t-text-3)', textTransform: 'uppercase' }}>{title}</span>
      {children}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return <p role="alert" style={{ fontSize: 13, color: '#ef4444', margin: 0, padding: '10px 14px', background: '#fef2f2', borderRadius: 8 }}>{message}</p>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: sg, fontSize: 13, fontWeight: 600, color: 'var(--t-text-3)', padding: 0, marginBottom: 24 }}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
      Volver al equipo
    </button>
  );
}

// ─── Selector de acceso (completo / específico + plantillas) ─────────────────

interface Access { fullAccess: boolean; permissions: Permission[] }

function AccessSelector({ value, onChange, team, disabled }: {
  value: Access; onChange: (a: Access) => void; team: TeamData; disabled?: boolean;
}) {
  const grantable = team.grantable as Permission[];
  const grantableSet = new Set<string>(grantable);
  // Plantillas recortadas a lo que se puede otorgar (con sus dependencias disponibles)
  const templates = PERMISSION_TEMPLATES
    .map((t) => ({ ...t, permissions: expandRequires(t.permissions).filter((p) => grantableSet.has(p)) }))
    .filter((t) => t.permissions.length > 0);

  const option = (active: boolean): React.CSSProperties => ({
    flex: 1, minWidth: 200, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12,
    border: `2px solid ${active ? ORANGE : 'var(--t-border-2)'}`, background: active ? 'rgba(255,106,26,.08)' : 'var(--t-surface)',
    cursor: disabled ? 'default' : 'pointer',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {team.canGrantFullAccess && (
          <label style={option(value.fullAccess)}>
            <input type="radio" checked={value.fullAccess} disabled={disabled} onChange={() => onChange({ ...value, fullAccess: true })} style={{ accentColor: ORANGE, marginTop: 2 }} />
            <span>
              <strong style={{ fontSize: 14, color: 'var(--t-text-1)' }}>Acceso completo</strong>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--t-text-3)' }}>
                Todos los permisos de tu plan{team.planName ? ` (${team.planName})` : ''}. Si el plan cambia, se actualiza solo.
              </span>
            </span>
          </label>
        )}
        <label style={option(!value.fullAccess)}>
          <input type="radio" checked={!value.fullAccess} disabled={disabled} onChange={() => onChange({ ...value, fullAccess: false })} style={{ accentColor: ORANGE, marginTop: 2 }} />
          <span>
            <strong style={{ fontSize: 14, color: 'var(--t-text-1)' }}>Permisos específicos</strong>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--t-text-3)' }}>Elige qué puede ver y hacer.</span>
          </span>
        </label>
      </div>

      {!value.fullAccess && (
        <>
          {templates.length > 0 && !disabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label>Plantillas rápidas</Label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {templates.map((t) => (
                  <button
                    key={t.id} type="button" title={t.description}
                    onClick={() => onChange({ fullAccess: false, permissions: t.permissions })}
                    style={{ padding: '6px 14px', borderRadius: 999, border: '1.5px solid var(--t-border)', background: 'var(--t-surface)', fontFamily: sg, fontSize: 13, fontWeight: 600, color: 'var(--t-text-2)', cursor: 'pointer' }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <PermissionsEditor
            value={value.permissions}
            onChange={(permissions) => onChange({ fullAccess: false, permissions })}
            available={grantable}
            disabled={disabled}
            unavailableLabel="No lo puedes otorgar (no está en el plan o no lo tienes)"
          />
        </>
      )}
    </div>
  );
}

function accessSummary(m: TeamMember): string {
  if (m.fullAccess) return 'Acceso completo';
  const n = normalizePermissions(m.grantedPermissions).length;
  return n ? `${n} permiso${n === 1 ? '' : 's'}` : 'Sin permisos';
}

// ─── Vistas ───────────────────────────────────────────────────────────────────

function CreateView({ restaurantId, team, onBack, onDone }: { restaurantId: string; team: TeamData; onBack: () => void; onDone: () => void }) {
  const { create } = useTeamMutations(restaurantId);
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [access, setAccess] = useState<Access>({ fullAccess: false, permissions: [] });
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.displayName.trim() || !form.email.trim()) { setError('Nombre y correo son obligatorios'); return; }
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    if (!access.fullAccess && access.permissions.length === 0) { setError('Elige al menos un permiso o "Acceso completo"'); return; }
    try {
      await create.mutateAsync({ restaurantId, ...form, fullAccess: access.fullAccess, grantedPermissions: access.permissions });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario');
    }
  }

  return (
    <div>
      <BackButton onClick={onBack} />
      <h1 style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', color: 'var(--t-text-1)', margin: '0 0 20px' }}>Agregar usuario</h1>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card title="Datos de acceso">
          <TextField label="Nombre completo" value={form.displayName} onChange={(v) => setForm((f) => ({ ...f, displayName: v }))} placeholder="Ej: María López" />
          <TextField label="Correo" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="maria@ejemplo.com" />
          <TextField label="Contraseña" type="password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} placeholder="Mínimo 6 caracteres" />
        </Card>
        <Card title="Qué puede hacer">
          <AccessSelector value={access} onChange={setAccess} team={team} />
        </Card>
        <ErrorBox message={error} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onBack}>Cancelar</Button>
          <Button type="submit" loading={create.isPending}>Crear usuario</Button>
        </div>
      </form>
    </div>
  );
}

function EditView({ restaurantId, team, member, onBack, onDone }: {
  restaurantId: string; team: TeamData; member: TeamMember; onBack: () => void; onDone: () => void;
}) {
  const { update, remove } = useTeamMutations(restaurantId);
  const canEdit = member.canManage && team.can.update;
  const [name, setName] = useState(member.displayName ?? '');
  const [email, setEmail] = useState(member.email);
  const [access, setAccess] = useState<Access>({ fullAccess: member.fullAccess, permissions: normalizePermissions(member.grantedPermissions) });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(key: string, fn: () => Promise<unknown>, okMessage: string) {
    setErrors((e) => ({ ...e, [key]: '' }));
    setSaved('');
    try { await fn(); setSaved(okMessage); } catch (err) { setErrors((e) => ({ ...e, [key]: err instanceof Error ? err.message : 'Error inesperado' })); }
  }

  const saveInfo = () => run('info', () => update.mutateAsync({
    uid: member.uid,
    ...(name.trim() !== (member.displayName ?? '') ? { displayName: name.trim() } : {}),
    ...(email.trim() !== member.email ? { email: email.trim() } : {}),
  }), 'Datos guardados');

  const saveAccess = () => {
    if (!access.fullAccess && access.permissions.length === 0) {
      setErrors((e) => ({ ...e, access: 'Elige al menos un permiso o "Acceso completo"' }));
      return;
    }
    return run('access', () => update.mutateAsync({ uid: member.uid, fullAccess: access.fullAccess, grantedPermissions: access.permissions }), 'Permisos actualizados');
  };

  const savePassword = () => {
    if (password.length < 6) { setErrors((e) => ({ ...e, pass: 'La contraseña debe tener al menos 6 caracteres' })); return; }
    if (password !== confirm) { setErrors((e) => ({ ...e, pass: 'Las contraseñas no coinciden' })); return; }
    return run('pass', async () => { await update.mutateAsync({ uid: member.uid, password }); setPassword(''); setConfirm(''); }, 'Contraseña actualizada');
  };

  const toggleActive = () => run('active', () => update.mutateAsync({ uid: member.uid, isActive: !member.isActive }), member.isActive ? 'Usuario desactivado' : 'Usuario activado');

  const doDelete = () => run('delete', async () => { await remove.mutateAsync(member.uid); onDone(); }, '');

  return (
    <div>
      <BackButton onClick={onBack} />
      <h1 style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', color: 'var(--t-text-1)', margin: 0 }}>{member.displayName ?? member.email}</h1>
      <p style={{ fontFamily: sm, fontSize: 12, color: 'var(--t-text-3)', margin: '4px 0 20px' }}>{member.email}</p>

      {!member.canManage && (
        <p style={{ fontSize: 13, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', margin: '0 0 16px' }}>
          Este usuario tiene permisos que tú no tienes: solo puedes verlo.
        </p>
      )}
      {saved && <p role="status" style={{ fontSize: 13, color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: '10px 14px', margin: '0 0 16px' }}>{saved}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card title="Datos del usuario">
          <TextField label="Nombre completo" value={name} onChange={setName} disabled={!canEdit} />
          <TextField label="Correo" type="email" value={email} onChange={setEmail} disabled={!canEdit} />
          <ErrorBox message={errors.info ?? ''} />
          {canEdit && <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={saveInfo} loading={update.isPending}>Guardar datos</Button></div>}
        </Card>

        <Card title="Qué puede hacer">
          <AccessSelector value={access} onChange={setAccess} team={team} disabled={!canEdit} />
          <ErrorBox message={errors.access ?? ''} />
          {canEdit && <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={saveAccess} loading={update.isPending}>Guardar permisos</Button></div>}
        </Card>

        {member.canManage && team.can.resetPassword && (
          <Card title="Cambiar contraseña">
            <TextField label="Nueva contraseña" type="password" value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres" />
            <TextField label="Confirmar contraseña" type="password" value={confirm} onChange={setConfirm} placeholder="Repite la contraseña" />
            <ErrorBox message={errors.pass ?? ''} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={savePassword} loading={update.isPending}>Cambiar contraseña</Button></div>
          </Card>
        )}

        {canEdit && (
          <Card title="Estado">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, color: 'var(--t-text-1)' }}>
                {member.isActive ? 'Activo: puede iniciar sesión.' : 'Inactivo: no puede iniciar sesión.'}
              </span>
              <Button variant="ghost" onClick={toggleActive} loading={update.isPending}>{member.isActive ? 'Desactivar' : 'Activar'}</Button>
            </div>
            <ErrorBox message={errors.active ?? ''} />
          </Card>
        )}

        {member.canManage && team.can.delete && (
          <Card title="Zona de peligro" danger>
            {!confirmDelete ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ fontSize: 13, color: 'var(--t-text-3)' }}>Eliminar el usuario. No se puede deshacer.</span>
                <Button variant="danger" onClick={() => setConfirmDelete(true)}>Eliminar</Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 14, color: 'var(--t-text-1)' }}>¿Eliminar a <strong>{member.displayName ?? member.email}</strong>?</span>
                <ErrorBox message={errors.delete ?? ''} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
                  <Button variant="danger" onClick={doDelete} loading={remove.isPending}>Sí, eliminar</Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

type View = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; uid: string };

/** Equipo del restaurante: empleados con permisos (fullAccess o específicos). */
export function TeamManager() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? '';
  const { data: team, isLoading, error } = useTeam(restaurantId || undefined);
  const [view, setView] = useState<View>({ mode: 'list' });

  if (!restaurantId) return null;
  if (isLoading) return <p style={{ fontFamily: sg, color: 'var(--t-text-3)' }}>Cargando equipo…</p>;
  if (error || !team) {
    return <p role="alert" style={{ fontFamily: sg, fontSize: 13, color: '#ef4444', padding: '10px 14px', background: '#fef2f2', borderRadius: 8 }}>Error al cargar el equipo: {(error as Error)?.message}</p>;
  }

  const back = () => setView({ mode: 'list' });
  const member = view.mode === 'edit' ? team.employees.find((m) => m.uid === view.uid) : undefined;
  const atLimit = team.limit !== null && team.employees.length >= team.limit;

  return (
    <div style={{ fontFamily: sg, maxWidth: 760, margin: '0 auto' }}>
      {view.mode === 'create' && <CreateView restaurantId={restaurantId} team={team} onBack={back} onDone={back} />}
      {view.mode === 'edit' && member && <EditView key={member.uid} restaurantId={restaurantId} team={team} member={member} onBack={back} onDone={back} />}

      {(view.mode === 'list' || (view.mode === 'edit' && !member)) && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <Label>Equipo</Label>
            <h1 style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', color: 'var(--t-text-1)', margin: '6px 0 0' }}>Usuarios del restaurante</h1>
            <p style={{ fontSize: 13, color: 'var(--t-text-3)', margin: '4px 0 0' }}>
              Da a cada persona solo los permisos que necesita.
              {team.limit !== null ? ` Tu plan permite hasta ${team.limit} usuarios.` : ''}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {team.employees.length === 0 ? (
              <div style={{ borderRadius: 16, border: '1.5px dashed var(--t-border)', background: 'var(--t-surface)', padding: '40px 24px', textAlign: 'center', fontSize: 14, color: 'var(--t-text-3)' }}>
                Todavía no hay usuarios.
              </div>
            ) : team.employees.map((m) => (
              <button
                key={m.uid} type="button" onClick={() => setView({ mode: 'edit', uid: m.uid })}
                style={{ display: 'flex', alignItems: 'center', gap: 14, borderRadius: 999, border: '1px solid var(--t-border-2)', background: 'var(--t-surface)', padding: '14px 18px', width: '100%', cursor: 'pointer', textAlign: 'left', fontFamily: sg, opacity: m.isActive ? 1 : 0.6 }}
              >
                <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #FFB02E, #EA3B2E)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 17, color: '#fff' }}>
                  {(m.displayName ?? m.email)[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--t-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.displayName ?? '—'}</div>
                  <div style={{ fontFamily: sm, fontSize: 11, color: 'var(--t-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                </div>
                {!m.isActive && <span style={badge('#fef2f2', '#b91c1c')}>Inactivo</span>}
                <span style={badge(m.fullAccess ? 'rgba(255,106,26,.12)' : 'var(--t-surface-2)', m.fullAccess ? ORANGE : 'var(--t-text-3)')}>{accessSummary(m)}</span>
              </button>
            ))}
          </div>

          {team.can.create && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Button onClick={() => setView({ mode: 'create' })} disabled={atLimit || team.grantable.length === 0}>+ Agregar usuario</Button>
              {atLimit && <span style={{ fontSize: 13, color: 'var(--t-text-3)' }}>Límite de {team.limit} usuarios alcanzado</span>}
            </div>
          )}

          {team.grantable.length > 0 && (
            <details style={{ marginTop: 24, fontSize: 13, color: 'var(--t-text-3)' }}>
              <summary style={{ cursor: 'pointer' }}>Permisos que puedes otorgar ({team.grantable.length})</summary>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, columns: 2 }}>
                {team.grantable.map((p) => <li key={p}>{getPermissionDefinition(p)?.label ?? p}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function badge(bg: string, color: string): React.CSSProperties {
  return { fontFamily: sm, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color, background: bg, borderRadius: 6, padding: '4px 9px', flexShrink: 0 };
}
