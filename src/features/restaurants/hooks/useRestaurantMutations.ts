import { useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, doc, writeBatch } from 'firebase/firestore';

import { db } from '@/lib/firebase/config';
import { QUERY_KEYS } from '@/constants/query-keys';
import type { AppUser, CreateRestaurantData, Restaurant, UpdateRestaurantData } from '@/types';
import { authFetch } from '@/lib/auth/authFetch';
import { BASE_ORDER_STATUSES } from '@/types';

import { restaurantsService } from '../services/restaurants.service';

export function useCreateRestaurant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<CreateRestaurantData, 'adminUserId'>) => {
      const { adminEmail, adminPassword, adminName, ...restaurantData } = data;

      // 1. Crear usuario en Firebase Auth via API route (server-side, no desloguea al super admin)
      const res = await authFetch('/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail, adminPassword }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? 'Error al crear el usuario administrador');
      }

      const { adminUid } = (await res.json()) as { adminUid: string };

      // 2. Batch write en Firestore desde el cliente (tiene auth context del super admin)
      const now = new Date().toISOString();
      const restaurantRef = doc(collection(db, 'restaurants'));

      const restaurant: Restaurant = {
        id: restaurantRef.id,
        ...restaurantData,
        adminUserId: adminUid,
        createdAt: now,
        updatedAt: now,
      };

      const userDoc: AppUser = {
        uid: adminUid,
        email: adminEmail,
        displayName: adminName,
        role: 'restaurant_admin',
        restaurantId: restaurantRef.id,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      const batch = writeBatch(db);
      batch.set(restaurantRef, restaurant);
      batch.set(doc(db, 'users', adminUid), userDoc);

      BASE_ORDER_STATUSES.forEach((status) => {
        const statusRef = doc(collection(db, 'restaurants', restaurantRef.id, 'orderStatuses'));
        batch.set(statusRef, {
          ...status,
          id: statusRef.id,
          restaurantId: restaurantRef.id,
          createdAt: now,
          updatedAt: now,
        });
      });

      try {
        await batch.commit();
      } catch (firestoreError) {
        // Rollback: borrar el usuario de Auth para evitar estado huérfano
        await authFetch('/api/restaurants', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: adminUid }),
        });
        throw firestoreError;
      }

      return { id: restaurantRef.id };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.restaurants });
    },
  });
}

export function useUpdateRestaurant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRestaurantData }) =>
      restaurantsService.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.restaurants });
    },
  });
}

export function useToggleRestaurantActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      restaurantsService.toggleActive(id, isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.restaurants });
    },
  });
}

export function useDeleteRestaurant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => restaurantsService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.restaurants });
    },
  });
}
