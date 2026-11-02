import { WaTemplateForm } from '@/features/wa-templates/components/WaTemplateForm';

export default function EditarPlantillaPage({ params }: { params: { id: string } }) {
  return <WaTemplateForm templateId={decodeURIComponent(params.id)} />;
}
