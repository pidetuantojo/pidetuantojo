import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
} from 'firebase/firestore';

import { db } from '@/lib/firebase/config';

export interface RestaurantLead {
  id: string;
  nombre: string;
  whatsapp: string;
  email: string;
  instagram: string;
  nombreNegocio: string;
  tipoNegocio: string;
  departamento: string;
  ciudad: string;
  mensaje: string;
  status: 'pending' | 'contacted' | 'active';
  createdAt: string;
}

export type CreateLeadData = Omit<RestaurantLead, 'id' | 'status' | 'createdAt'>;

export const leadsService = {
  async create(data: CreateLeadData): Promise<string> {
    const ref = await addDoc(collection(db, 'restaurant_leads'), {
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    return ref.id;
  },

  async getAll(): Promise<RestaurantLead[]> {
    const q = query(collection(db, 'restaurant_leads'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as RestaurantLead);
  },

  async updateStatus(id: string, status: RestaurantLead['status']): Promise<void> {
    await updateDoc(doc(db, 'restaurant_leads', id), { status });
  },
};
