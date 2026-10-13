import { notFound } from 'next/navigation';

import { HELP_GUIDES, HelpGuideShell, findGuide } from '@/features/help';
import { GUIDE_CONTENT } from '@/features/help/content/loaders';

export function generateStaticParams() {
  return HELP_GUIDES.map((g) => ({ seccion: g.section, guia: g.slug }));
}

export default async function GuiaPage({ params }: { params: { seccion: string; guia: string } }) {
  const guide = findGuide(HELP_GUIDES, params.seccion, params.guia);
  const load = GUIDE_CONTENT[`${params.seccion}/${params.guia}`];
  if (!guide || !load) notFound();

  const { default: Content } = await load();
  return (
    <HelpGuideShell guide={guide}>
      <Content />
    </HelpGuideShell>
  );
}
