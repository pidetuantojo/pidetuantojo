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
