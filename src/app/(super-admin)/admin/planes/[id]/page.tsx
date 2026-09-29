import { PlanForm } from '@/features/plans/components/PlanForm';

export default function EditarPlanPage({ params }: { params: { id: string } }) {
  return <PlanForm planId={params.id} />;
}
