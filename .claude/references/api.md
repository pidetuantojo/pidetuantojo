# API Routes y Services — Convenciones

## Separación: Route Handler vs Service

```
app/api/orders/route.ts   → Solo HTTP: parsear request, llamar service, devolver response
features/orders/services/orders.service.ts → Lógica de negocio y acceso a datos
```

---

## API Route Handler (App Router)

```ts
// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getOrders, createOrder } from '@/features/orders/services/orders.service';
import { createOrderSchema } from '@/features/orders/services/orders.schemas';
import type { ApiResponse, PaginatedResponse } from '@/types/api.types';
import type { Order } from '@/features/orders/types/order.types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status') ?? undefined;
    const page = Number(searchParams.get('page') ?? '1');
    qu;

    const result = await getOrders({ status, page });

    return NextResponse.json<PaginatedResponse<Order>>(result);
  } catch (error) {
    console.error('[GET /api/orders]', error);
    return NextResponse.json({ message: 'Error al obtener pedidos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Datos inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const order = await createOrder(parsed.data);
    return NextResponse.json<ApiResponse<Order>>({ data: order }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/orders]', error);
    return NextResponse.json({ message: 'Error al crear pedido' }, { status: 500 });
  }
}
```

---

## Service — Lógica de negocio

```ts
// features/orders/services/orders.service.ts
import { apiClient } from '@/lib/axios';
import type { Order, OrderFilters } from '../types/order.types';
import type { PaginatedResponse } from '@/types/api.types';

export async function getOrders(filters?: OrderFilters): Promise<PaginatedResponse<Order>> {
  const { data } = await apiClient.get<PaginatedResponse<Order>>('/orders', {
    params: filters,
  });
  return data;
}

export async function getOrderById(id: string): Promise<Order> {
  const { data } = await apiClient.get<{ data: Order }>(`/orders/${id}`);
  return data.data;
}

export async function updateOrderStatus(id: string, status: Order['status']): Promise<Order> {
  const { data } = await apiClient.patch<{ data: Order }>(`/orders/${id}/status`, { status });
  return data.data;
}
```

---

## Schemas de validación (separados del service)

```ts
// features/orders/services/orders.schemas.ts
import { z } from 'zod';

export const createOrderSchema = z.object({
  customerName: z.string().min(2),
  customerPhone: z.string().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
      })
    )
    .min(1, 'Debe incluir al menos un item'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
```

---

## Axios instance compartida

```ts
// lib/axios.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api',
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de errores global
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log centralizado, manejo de 401, etc.
    return Promise.reject(error);
  }
);
```

---

## Server Actions (alternativa a API routes para mutaciones)

```ts
// features/menu/actions/menu.actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createMenuItemSchema } from '../services/menu.schemas';
import { createMenuItem } from '../services/menu.service';

export async function createMenuItemAction(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = createMenuItemSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  await createMenuItem(parsed.data);
  revalidatePath('/menu'); // Invalida cache de la ruta
  return { success: true };
}
```

### Cuándo usar Server Actions vs API Routes

| Caso                                               | Preferir                               |
| -------------------------------------------------- | -------------------------------------- |
| Mutaciones desde formularios Next.js               | Server Actions                         |
| Endpoints consumidos por apps externas / mobile    | API Routes                             |
| Fetch de datos en Server Components                | `async/await` directo en el componente |
| Mutaciones con React Query desde Client Components | API Routes + React Query               |
