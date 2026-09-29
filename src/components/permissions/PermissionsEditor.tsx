'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Checkbox } from '@/components/ui/Checkbox';

import { PERMISSION_MODULES, type Permission } from '@/constants/permissions';
import {
  ALL_PERMISSIONS, expandRequires, getPermissionDefinition, isSelectable, sortPermissions, togglePermission,
} from '@/lib/permissions/permissions';

const sg = 'var(--font-sans, sans-serif)';
const sm = 'var(--font-mono, monospace)';
const ORANGE = '#FF6A1A';

interface PermissionsEditorProps {
  value: readonly Permission[];
  onChange: (next: Permission[]) => void;
  // Permisos que se pueden marcar (ej. los del plan). Por defecto, todos.
  available?: readonly Permission[];
  disabled?: boolean;
  // Texto para permisos no disponibles
  unavailableLabel?: string;
}

type Module = (typeof PERMISSION_MODULES)[number];

/**
 * Editor de permisos por módulo: checkbox de módulo (todos / ninguno / parcial),
 * dependencias automáticas al marcar y bajas en cadena al desmarcar.
 * Se usa en Planes (super admin) y en Equipo (empleados).
 */
export function PermissionsEditor({
  value, onChange, available = ALL_PERMISSIONS, disabled = false,
  unavailableLabel = 'No incluido en el plan',
}: PermissionsEditorProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const selected = useMemo(() => new Set(value), [value]);
  const availableSet = useMemo(() => new Set(available), [available]);

  const modules = PERMISSION_MODULES.filter((m) => m.kind === 'user')
    // Módulos sin nada disponible no se muestran (ej. en Equipo, lo que el plan no incluye)
    .filter((m) => m.permissions.some((p) => availableSet.has(p.key as Permission)));

  const selectableIn = (m: Module) =>
    m.permissions.map((p) => p.key as Permission).filter((k) => isSelectable(k, available));

  const allSelectable = modules.flatMap(selectableIn);
  const selectedCount = allSelectable.filter((k) => selected.has(k)).length;

  function toggleModule(m: Module, check: boolean) {
    const keys = selectableIn(m);
    let next = [...value];
    if (check) {
      next = sortPermissions([...next, ...expandRequires(keys)].filter((k) => availableSet.has(k)));
    } else {
      keys.forEach((k) => { next = togglePermission(next, k, false, available); });
    }
    onChange(next);
  }

  function setAll(check: boolean) {
    onChange(check ? sortPermissions(expandRequires(allSelectable).filter((k) => availableSet.has(k))) : []);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: sg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--t-text-3)' }}>
          <strong style={{ color: 'var(--t-text-1)' }}>{selectedCount}</strong> de {allSelectable.length} permisos seleccionados
        </span>
        {!disabled && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => setAll(true)} style={linkButton}>Seleccionar todo</button>
            <button type="button" onClick={() => setAll(false)} style={linkButton}>Quitar todo</button>
          </div>
        )}
      </div>

      {modules.map((m) => {
        const keys = selectableIn(m);
        const count = keys.filter((k) => selected.has(k)).length;
        const all = keys.length > 0 && count === keys.length;
        const some = count > 0 && !all;
        const isOpen = open[m.id] ?? some;
        return (
          <div key={m.id} style={{ border: `1.5px solid ${count ? `${ORANGE}55` : 'var(--t-border-2)'}`, borderRadius: 14, background: 'var(--t-surface)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
              <Checkbox
                checked={all}
                indeterminate={some}
                disabled={disabled || keys.length === 0}
                onChange={(e) => toggleModule(m, e.target.checked)}
              />
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [m.id]: !isOpen }))}
                aria-expanded={isOpen}
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: sg }}
              >
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: 'var(--t-text-1)' }}>
                  {m.label}
                  {m.kind === 'feature' && <span style={{ marginLeft: 8, fontFamily: sm, fontSize: 10, color: ORANGE }}>PLAN</span>}
                </span>
                <span style={{ fontFamily: sm, fontSize: 11, color: 'var(--t-text-3)' }}>{count}/{keys.length}</span>
                {isOpen ? <ChevronDown size={16} color="var(--t-text-3)" /> : <ChevronRight size={16} color="var(--t-text-3)" />}
              </button>
            </div>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--t-border-2)', padding: '6px 12px 10px 38px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {m.permissions.map((p) => {
                  const key = p.key as Permission;
                  const selectable = isSelectable(key, available);
                  const def = getPermissionDefinition(key);
                  const missing = (def?.requires ?? []).filter((r) => !availableSet.has(r as Permission));
                  return (
                    <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', cursor: disabled || !selectable ? 'default' : 'pointer', opacity: selectable ? 1 : 0.5 }}>
                      <Checkbox
                        checked={selected.has(key)}
                        disabled={disabled || !selectable}
                        onChange={(e) => onChange(togglePermission(value, key, e.target.checked, available))}
                        style={{ marginTop: 2 }}
                      />
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-1)' }}>{p.label}</span>
                        {'description' in p && p.description && (
                          <span style={{ fontSize: 12, color: 'var(--t-text-3)' }}>{p.description}</span>
                        )}
                        {!selectable && (
                          <span style={{ fontSize: 11, color: 'var(--t-text-3)' }}>
                            {availableSet.has(key) && missing.length
                              ? `Requiere: ${missing.map((r) => getPermissionDefinition(r as Permission)?.label ?? r).join(', ')}`
                              : unavailableLabel}
                          </span>
                        )}
                        <span style={{ fontFamily: sm, fontSize: 10, color: 'var(--t-text-4)' }}>{key}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const linkButton: React.CSSProperties = {
  background: 'none', border: '1.5px solid var(--t-border)', borderRadius: 999, padding: '4px 12px',
  fontFamily: sg, fontSize: 12, fontWeight: 600, color: 'var(--t-text-2)', cursor: 'pointer',
};
