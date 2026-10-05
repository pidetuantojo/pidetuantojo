import { RestaurantCategoryForm } from '@/features/restaurant-categories/components/RestaurantCategoryForm';

export default function EditarCategoriaPage({ params }: { params: { id: string } }) {
  return <RestaurantCategoryForm categoryId={params.id} />;
}
