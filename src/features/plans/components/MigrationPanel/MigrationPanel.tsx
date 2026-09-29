'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';

import { plansService, type MigrationReport } from '../../services/plans.service';

const sm = 'var(--font-mono, monospace)';
const ORANGE = '#FF6A1A';

/**
 * Migración al sistema de planes y permisos (Fase 7). Primero simula y muestra qué cambiaría;
 * ejecutar es idempotente y conserva el acceso que cada usuario tenía antes.
 */
export function MigrationPanel() {
  const qc = useQueryClient();
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [running, setRunning] = useState<'simulate' | 'execute' | null>(null);
  const [error, setError] = useState('');

  async function run(execute: boolean) {
    if (execute && !confirm('¿Ejecutar la migración? Asigna el plan "Completo" a los restaurantes sin plan, convierte los usuarios "view" en empleados y recalcula los permisos de todos.')) return;
    setRunning(execute ? 'execute' : 'simulate');
    setError('');
    try {
      const result = await plansService.migrate(execute);
      setReport(result);
      if (execute) {
        void qc.invalidateQueries({ queryKey: QUERY_KEYS.plans });
        void qc.invalidateQueries({ queryKey: QUERY_KEYS.restaurants });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar');
    } finally {
      setRunning(null);
    }
  }

  const nothingToDo = report && !report.createFullPlan && report.restaurantsToAssign.length === 0
    && report.usersToConvert.length === 0 && report.usersPendingSync === 0;

  return (
    <section style={{ marginTop: 12, background: 'var(--t-surface)', border: '1.5px solid var(--t-border)', borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--t-text-1)' }}>Migración de permisos</h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--t-text-3)' }}>
          Pasa los restaurantes y usuarios creados antes de los planes al sistema nuevo sin quitarle acceso a nadie.
          Simula primero para ver qué cambiaría; se puede ejecutar varias veces.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => run(false)} disabled={running !== null} style={button(false)}>
          {running === 'simulate' ? 'Simulando…' : 'Simular'}
        </button>
        <button type="button" onClick={() => run(true)} disabled={running !== null || !report} title={!report ? 'Simula primero' : undefined} style={button(true, !report)}>
          {running === 'execute' ? 'Ejecutando…' : 'Ejecutar migración'}
        </button>
      </div>

      {error && <div role="alert" style={{ fontSize: 13, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px' }}>{error}</div>}

      {report && (
        <div role="status" style={{ fontSize: 13, color: 'var(--t-text-2)', background: 'var(--t-surface-2)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <strong style={{ color: report.executed ? '#059669' : 'var(--t-text-1)' }}>
            {report.executed ? (report.ok ? 'Migración aplicada' : 'Migración aplicada con errores') : 'Simulación (no se cambió nada)'}
          </strong>
          <span>{report.restaurants} restaurante(s) · {report.users} usuario(s) revisados</span>
          {nothingToDo && !report.executed && <span>Todo está migrado. Ejecutar solo recalculará los permisos.</span>}
          {report.createFullPlan && <span>• Se crea el plan <b>Completo</b> (todas las funcionalidades).</span>}
          {report.restaurantsToAssign.length > 0 && (
            <span>• Plan Completo para: {report.restaurantsToAssign.map((r) => r.name ?? r.id).join(', ')}</span>
          )}
          {report.usersToConvert.length > 0 && (
            <span>• Pasan a empleado (con los mismos permisos de antes): {report.usersToConvert.map((u) => u.email ?? u.uid).join(', ')}</span>
          )}
          {report.usersPendingSync > 0 && <span>• {report.usersPendingSync} usuario(s) reciben sus permisos calculados.</span>}
          {report.executed && (
            <span>• Recalculados: {report.syncedRestaurants ?? 0} restaurante(s), {report.syncedUsers ?? 0} usuario(s).</span>
          )}
          {[...report.warnings, ...(report.syncErrors ?? [])].map((w) => (
            <span key={w} style={{ fontFamily: sm, fontSize: 11, color: '#92400e' }}>⚠ {w}</span>
          ))}
        </div>
      )}
    </section>
  );
}

function button(primary: boolean, disabled = false): React.CSSProperties {
  return {
    padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    border: primary ? 'none' : '1.5px solid var(--t-border)',
    background: primary ? ORANGE : 'var(--t-surface)',
    color: primary ? '#fff' : 'var(--t-text-2)',
    opacity: disabled ? 0.5 : 1,
  };
}
