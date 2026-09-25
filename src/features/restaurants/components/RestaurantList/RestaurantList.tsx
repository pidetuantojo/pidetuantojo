'use client';

import { Utensils } from 'lucide-react';

import { RestaurantCard } from '../RestaurantCard';
import type { RestaurantListProps } from './RestaurantList.types';

export function RestaurantList({
  restaurants,
  onEdit,
  onToggleActive,
  onDelete,
  togglingId,
  deletingId,
}: RestaurantListProps) {
  if (restaurants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Utensils className="h-12 w-12 text-[var(--t-text-4)]" />
        <h3 className="mt-4 text-lg font-medium text-[var(--t-text-1)]">Sin restaurantes</h3>
        <p className="mt-1 text-sm text-[var(--t-text-3)]">
          Creá el primer restaurante para empezar.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {restaurants.map((restaurant) => (
        <RestaurantCard
          key={restaurant.id}
          restaurant={restaurant}
          onEdit={onEdit}
          onToggleActive={onToggleActive}
          onDelete={onDelete}
          isToggling={togglingId === restaurant.id}
          isDeleting={deletingId === restaurant.id}
        />
      ))}
    </div>
  );
}
