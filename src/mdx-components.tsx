import type { MDXComponents } from 'mdx/types';

import { Callout, GuideCard, GuideLink, Step, Steps, Ui } from '@/features/help/components/mdx/MdxBlocks';
import { ChecklistBlock } from '@/features/help/components/mdx/ChecklistBlock';
import { OrderFlowSimulator } from '@/features/help/simulations/order-flow/OrderFlowSimulator';

// Requerido por @next/mdx en el App Router: estilos de las guías del centro de ayuda
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: (props) => <h2 style={{ margin: '32px 0 8px', fontSize: 20, fontWeight: 800, letterSpacing: '-.01em', color: 'var(--t-text-1)' }} {...props} />,
    h3: (props) => <h3 style={{ margin: '24px 0 6px', fontSize: 16, fontWeight: 800, color: 'var(--t-text-1)' }} {...props} />,
    p: (props) => <p style={{ margin: '0 0 12px', fontSize: 15, lineHeight: 1.65, color: 'var(--t-text-2)' }} {...props} />,
    ul: (props) => <ul style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 15, lineHeight: 1.65, color: 'var(--t-text-2)', display: 'flex', flexDirection: 'column', gap: 6 }} {...props} />,
    ol: (props) => <ol style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 15, lineHeight: 1.65, color: 'var(--t-text-2)', display: 'flex', flexDirection: 'column', gap: 6 }} {...props} />,
    strong: (props) => <strong style={{ color: 'var(--t-text-1)', fontWeight: 700 }} {...props} />,
    a: (props) => <a style={{ color: '#FF6A1A', fontWeight: 700 }} {...props} />,
    table: (props) => (
      <div style={{ overflowX: 'auto', margin: '0 0 16px', border: '1px solid var(--t-border)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, lineHeight: 1.5 }} {...props} />
      </div>
    ),
    th: (props) => <th style={{ textAlign: 'left', padding: '10px 12px', background: 'var(--t-surface-2)', color: 'var(--t-text-1)', fontWeight: 700, borderBottom: '1px solid var(--t-border)' }} {...props} />,
    td: (props) => <td style={{ padding: '10px 12px', color: 'var(--t-text-2)', borderBottom: '1px solid var(--t-border)', verticalAlign: 'top' }} {...props} />,
    code: (props) => <code style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.9em', background: 'var(--t-surface-2)', border: '1px solid var(--t-border)', borderRadius: 6, padding: '1px 6px', color: 'var(--t-text-1)' }} {...props} />,
    pre: (props) => <pre style={{ margin: '0 0 16px', padding: '12px 14px', background: 'var(--t-surface-2)', border: '1px solid var(--t-border)', borderRadius: 12, overflowX: 'auto', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }} {...props} />,
    Callout,
    Steps,
    Step,
    Ui,
    GuideLink,
    GuideCard,
    Checklist: ChecklistBlock,
    OrderFlowSimulator,
    ...components,
  };
}
