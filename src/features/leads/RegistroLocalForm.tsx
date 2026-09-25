'use client';

import { useState, CSSProperties } from 'react';
import Link from 'next/link';

import { COLOMBIA_LOCATIONS, RESTAURANT_CATEGORIES } from '@/constants/colombia-locations';
import { Select } from '@/components/ui/Select';
import { leadsService } from './leads.service';
import { Logo, LogoMark } from '@/components/ui/Logo';

// ─── design tokens ────────────────────────────────────────────────────────────

const sg = "var(--font-sans, sans-serif)";


// ─── benefits ─────────────────────────────────────────────────────────────────

const BENEFITS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>
      </svg>
    ),
    title: 'Menú digital propio',
    desc: 'Carta online con tu marca, fotos y precios siempre actualizados.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
    title: 'Pedidos en tiempo real',
    desc: 'Recibís cada pedido al instante con notificaciones y panel de gestión.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: 'Pedidos por WhatsApp',
    desc: 'Tus clientes te piden directo al WhatsApp sin apps ni comisiones.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>
      </svg>
    ),
    title: 'Estadísticas y contabilidad',
    desc: 'Controlá ventas, productos más pedidos y rendimiento del negocio.',
  },
];

// ─── types ────────────────────────────────────────────────────────────────────

type FormData = {
  nombre: string;
  whatsapp: string;
  email: string;
  instagram: string;
  nombreNegocio: string;
  tipoNegocio: string;
  departamento: string;
  ciudad: string;
  mensaje: string;
};

const EMPTY_FORM: FormData = {
  nombre: '', whatsapp: '', email: '', instagram: '',
  nombreNegocio: '', tipoNegocio: '', departamento: '', ciudad: '', mensaje: '',
};

// ─── component ────────────────────────────────────────────────────────────────

export function RegistroLocalForm() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [autoriza, setAutoriza] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const ciudades = form.departamento ? (COLOMBIA_LOCATIONS[form.departamento] ?? []) : [];

  function set(field: keyof FormData, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'departamento') next.ciudad = '';
      return next;
    });
    if (errors[field]) setErrors((e) => ({ ...e, [field]: '' }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.nombre.trim()) e.nombre = 'Campo requerido';
    if (!form.whatsapp.trim()) e.whatsapp = 'Campo requerido';
    if (!form.nombreNegocio.trim()) e.nombreNegocio = 'Campo requerido';
    if (!form.tipoNegocio) e.tipoNegocio = 'Seleccioná un tipo';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setSubmitError('');
    try {
      await leadsService.create({ ...form });
      setStep('success');
    } catch {
      setSubmitError('Hubo un error al enviar. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm(EMPTY_FORM);
    setAutoriza(false);
    setErrors({});
    setSubmitError('');
    setStep('form');
  }

  // ── field style helpers ──────────────────────────────────────────────────

  const input = (error?: string): CSSProperties => ({
    width: '100%', fontFamily: sg, fontSize: 14, color: 'var(--t-text-1)',
    background: 'var(--t-input-bg)', border: `1.5px solid ${error ? '#EA3B2E' : 'var(--t-input-border)'}`,
    borderRadius: 10, padding: '11px 14px', outline: 'none', boxSizing: 'border-box',
  });

  const label: CSSProperties = {
    fontFamily: sg, fontSize: 11, fontWeight: 700, color: 'var(--t-text-2)',
    letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, display: 'block',
  };

  const errTxt: CSSProperties = { fontFamily: sg, fontSize: 11, color: '#EA3B2E', marginTop: 4 };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        body { margin: 0; background: var(--t-bg); }
        .rl-layout { display: flex; min-height: 100vh; }
        .rl-panel { width: 400px; min-width: 400px; position: sticky; top: 0; height: 100vh; overflow: hidden; }
        .rl-main { flex: 1; display: flex; flex-direction: column; min-height: 100vh; overflow-y: auto; }
        .rl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .rl-full { grid-column: 1 / -1; }
        .rl-inp:focus { border-color: #FF6A1A !important; box-shadow: 0 0 0 3px rgba(255,106,26,.12); }
        .rl-btn-primary:hover { opacity: .92; transform: translateY(-1px); }
        .rl-btn-primary:active { transform: translateY(0); opacity: 1; }
        .rl-btn-primary { transition: opacity .15s, transform .15s; }
        .rl-header { padding: 14px 32px; }
        .rl-benefits { display: flex; flex-direction: column; gap: 20px; }
        .rl-panel-inner { padding: 48px 40px; }
        .rl-form-area { padding: 40px 40px; }
        @media (max-width: 860px) {
          .rl-layout { flex-direction: column; }
          .rl-panel { width: 100%; min-width: 0; height: auto; position: static; }
          .rl-panel-inner { padding: 28px 20px 32px; }
          .rl-benefits { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .rl-grid { grid-template-columns: 1fr; }
          .rl-full { grid-column: 1; }
          .rl-header { padding: 12px 16px; }
          .rl-form-area { padding: 28px 20px 48px; }
        }
      ` }} />

      {/* ── header ── */}
      <div className="rl-header" style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--t-nav-glass)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--t-border)',
      }}>
        <Logo variant="light" size={15} />
        <Link href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: sg, fontSize: 13, fontWeight: 600, color: 'var(--t-text-2)',
          textDecoration: 'none', padding: '8px 14px',
          border: '1.5px solid var(--t-border)', borderRadius: 10, background: 'var(--t-surface)',
        }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Volver al inicio
        </Link>
      </div>

      {step === 'success' ? (
        // ── success ──────────────────────────────────────────────────────────
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '60px 24px', background: 'var(--t-bg)',
        }}>
          <div style={{
            background: 'var(--t-surface)', borderRadius: 24, padding: '52px 48px',
            maxWidth: 500, width: '100%', textAlign: 'center',
            boxShadow: '0 24px 60px -20px rgba(27,21,18,.12)',
            border: '1px solid var(--t-border)',
          }}>
            {/* checkmark */}
            <div style={{
              width: 80, height: 80, borderRadius: '50%', margin: '0 auto 28px',
              background: 'linear-gradient(135deg,#FF8A2B,#FF6A1A 55%,#EA3B2E)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 16px 40px -12px rgba(255,106,26,.5)',
            }}>
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>

            <h1 style={{
              fontFamily: sg, fontSize: 28, fontWeight: 700,
              color: 'var(--t-text-1)', letterSpacing: '-0.03em', margin: '0 0 12px',
            }}>
              ¡Tu solicitud llegó!
            </h1>
            <p style={{ fontFamily: sg, fontSize: 15, color: 'var(--t-text-2)', lineHeight: 1.6, margin: '0 0 8px' }}>
              Nos ponemos en contacto por WhatsApp en las próximas <strong style={{ color: 'var(--t-text-1)' }}>24 horas</strong> para mostrarte todo lo que Pide Tu Antojo puede hacer por <strong style={{ color: 'var(--t-text-1)' }}>{form.nombreNegocio}</strong>.
            </p>
            <p style={{ fontFamily: sg, fontSize: 13, color: 'var(--t-text-3)', margin: '0 0 36px' }}>
              Revisá tu WhatsApp: <strong style={{ color: 'var(--t-text-2)' }}>{form.whatsapp}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link href="/" style={{
                display: 'block', width: '100%', textAlign: 'center', boxSizing: 'border-box',
                fontFamily: sg, fontWeight: 700, fontSize: 15, color: '#fff',
                background: 'linear-gradient(135deg,#FF8A2B,#FF6A1A 55%,#EA3B2E)',
                border: 'none', borderRadius: 12, padding: '14px 0',
                textDecoration: 'none', boxShadow: '0 8px 24px -8px rgba(255,106,26,.5)',
              }}>
                Ir al inicio
              </Link>
              <button onClick={handleReset} style={{
                width: '100%', fontFamily: sg, fontWeight: 600, fontSize: 14, color: 'var(--t-text-2)',
                background: 'transparent', border: '1.5px solid var(--t-border)', borderRadius: 12,
                padding: '13px 0', cursor: 'pointer',
              }}>
                Registrar otro local
              </button>
            </div>
          </div>
        </div>
      ) : (
        // ── form layout ──────────────────────────────────────────────────────
        <div className="rl-layout">

          {/* ── left panel ── */}
          <div className="rl-panel" style={{
            background: 'linear-gradient(155deg,#FF8A2B 0%,#FF6A1A 45%,#EA3B2E 100%)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* decorative circles */}
            <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -40, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />

            <div className="rl-panel-inner" style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ marginBottom: 28 }}>
                <LogoMark style={{ width: 36, height: 36, color: 'white' }} />
              </div>

              <h2 style={{
                fontFamily: sg, fontSize: 28, fontWeight: 700, color: '#fff',
                letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 12px',
              }}>
                Tu restaurante,<br />online hoy.
              </h2>
              <p style={{ fontFamily: sg, fontSize: 13.5, color: 'rgba(255,255,255,.8)', lineHeight: 1.6, margin: '0 0 28px' }}>
                Unite a la plataforma que conecta restaurantes con sus clientes directo por WhatsApp. Sin comisiones por pedido.
              </p>

              <div className="rl-benefits">
                {BENEFITS.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{
                      flexShrink: 0, width: 40, height: 40, borderRadius: 12,
                      background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                    }}>
                      {b.icon}
                    </div>
                    <div>
                      <div style={{ fontFamily: sg, fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 3 }}>{b.title}</div>
                      <div style={{ fontFamily: sg, fontSize: 12.5, color: 'rgba(255,255,255,.75)', lineHeight: 1.5 }}>{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── right: form ── */}
          <div className="rl-main" style={{ background: 'var(--t-bg)' }}>
            <div className="rl-form-area" style={{ maxWidth: 600, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

              <h1 style={{
                fontFamily: sg, fontSize: 30, fontWeight: 700,
                color: 'var(--t-text-1)', letterSpacing: '-0.03em', margin: '0 0 6px',
              }}>
                Registrá tu local
              </h1>
              <p style={{ fontFamily: sg, fontSize: 14, color: 'var(--t-text-3)', margin: '0 0 32px', lineHeight: 1.6 }}>
                Completá el formulario y te contactamos en menos de 24 horas.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="rl-grid">

                  {/* nombre */}
                  <div>
                    <label style={label}>Nombre completo <span style={{ color: '#EA3B2E' }}>*</span></label>
                    <input className="rl-inp" style={input(errors.nombre)} placeholder="Tu nombre y apellido"
                      value={form.nombre} onChange={(e) => set('nombre', e.target.value)} />
                    {errors.nombre && <p style={errTxt}>{errors.nombre}</p>}
                  </div>

                  {/* whatsapp */}
                  <div>
                    <label style={label}>WhatsApp <span style={{ color: '#EA3B2E' }}>*</span></label>
                    <input className="rl-inp" style={input(errors.whatsapp)} placeholder="300 123 4567"
                      value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
                    {errors.whatsapp && <p style={errTxt}>{errors.whatsapp}</p>}
                  </div>

                  {/* email */}
                  <div>
                    <label style={label}>Correo electrónico</label>
                    <input className="rl-inp" style={input()} type="email" placeholder="tu@correo.com"
                      value={form.email} onChange={(e) => set('email', e.target.value)} />
                  </div>

                  {/* instagram */}
                  <div>
                    <label style={label}>Instagram</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{
                        position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                        fontFamily: sg, fontSize: 14, color: 'var(--t-text-4)', pointerEvents: 'none',
                      }}>@</span>
                      <input className="rl-inp" style={{ ...input(), paddingLeft: 26 }} placeholder="tunegocio"
                        value={form.instagram} onChange={(e) => set('instagram', e.target.value)} />
                    </div>
                  </div>

                  {/* nombre negocio */}
                  <div className="rl-full">
                    <label style={label}>Nombre del negocio <span style={{ color: '#EA3B2E' }}>*</span></label>
                    <input className="rl-inp" style={input(errors.nombreNegocio)} placeholder="El nombre de tu restaurante o local"
                      value={form.nombreNegocio} onChange={(e) => set('nombreNegocio', e.target.value)} />
                    {errors.nombreNegocio && <p style={errTxt}>{errors.nombreNegocio}</p>}
                  </div>

                  {/* tipo negocio */}
                  <div>
                    <label style={label}>Tipo de negocio <span style={{ color: '#EA3B2E' }}>*</span></label>
                    <Select
                      value={form.tipoNegocio}
                      onChange={(v) => set('tipoNegocio', v)}
                      placeholder="Seleccioná una opción"
                      error={errors.tipoNegocio}
                      options={RESTAURANT_CATEGORIES.map((c) => ({ value: c, label: c }))}
                    />
                  </div>

                  {/* departamento */}
                  <div>
                    <label style={label}>Departamento</label>
                    <Select
                      value={form.departamento}
                      onChange={(v) => set('departamento', v)}
                      placeholder="Seleccioná departamento"
                      options={Object.keys(COLOMBIA_LOCATIONS).sort().map((d) => ({ value: d, label: d }))}
                    />
                  </div>

                  {/* ciudad */}
                  <div>
                    <label style={label}>Ciudad</label>
                    <Select
                      value={form.ciudad}
                      onChange={(v) => set('ciudad', v)}
                      placeholder="Seleccioná ciudad"
                      disabled={ciudades.length === 0}
                      options={ciudades.map((c) => ({ value: c, label: c }))}
                    />
                  </div>

                  {/* mensaje */}
                  <div className="rl-full">
                    <label style={label}>¿Algo que quieras contarnos?</label>
                    <textarea className="rl-inp" style={{ ...input(), resize: 'none', height: 96 }}
                      placeholder="Contanos sobre tu negocio, cuántos pedidos recibís, qué esperás de la plataforma..."
                      value={form.mensaje} onChange={(e) => set('mensaje', e.target.value)} />
                  </div>

                  {/* autoriza */}
                  <div className="rl-full" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 4 }}>
                    <input type="checkbox" id="rl-auth" checked={autoriza} onChange={(e) => setAutoriza(e.target.checked)}
                      style={{ marginTop: 3, accentColor: '#FF6A1A', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                    <label htmlFor="rl-auth" style={{ fontFamily: sg, fontSize: 12.5, color: 'var(--t-text-2)', lineHeight: 1.55, cursor: 'pointer' }}>
                      Autorizo a <strong style={{ color: 'var(--t-text-1)' }}>Pide Tu Antojo</strong> a contactarme por WhatsApp y correo electrónico con información sobre la plataforma.{' '}
                      <span style={{ color: 'var(--t-text-4)' }}>Ley 1581 de 2012 — Protección de datos personales.</span>
                    </label>
                  </div>

                  {/* error global */}
                  {submitError && (
                    <div className="rl-full" style={{
                      fontFamily: sg, fontSize: 13, color: '#EA3B2E',
                      background: '#fff0ee', border: '1px solid #fcc', borderRadius: 10, padding: '11px 14px',
                    }}>
                      {submitError}
                    </div>
                  )}

                  {/* submit */}
                  <div className="rl-full" style={{ marginTop: 8 }}>
                    <button type="submit" disabled={loading} className="rl-btn-primary" style={{
                      width: '100%', fontFamily: sg, fontWeight: 700, fontSize: 15, color: '#fff',
                      background: loading ? '#ccc' : 'linear-gradient(135deg,#FF8A2B,#FF6A1A 55%,#EA3B2E)',
                      border: 'none', borderRadius: 12, padding: '15px 0', cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: loading ? 'none' : '0 10px 28px -8px rgba(255,106,26,.5)',
                    }}>
                      {loading ? 'Enviando...' : 'Registrarme'}
                    </button>
                    <p style={{ fontFamily: sg, fontSize: 11.5, color: 'var(--t-text-4)', textAlign: 'center', marginTop: 10 }}>
                      Tus datos están seguros con nosotros
                    </p>
                  </div>

                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
