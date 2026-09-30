import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import type { AppUser, Restaurant, UserRole } from '@/types';
import { getSubscriptionInfo } from '@/lib/subscription/subscription';

export const authService = {
  async signIn(email: string, password: string): Promise<void> {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const { uid } = credential.user;

    // Check if this user belongs to a restaurant with a suspended subscription
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const userData = userSnap.data() as AppUser;
      if (userData.restaurantId && userData.role !== 'super_admin') {
        const restaurantSnap = await getDoc(doc(db, 'restaurants', userData.restaurantId));
        if (restaurantSnap.exists()) {
          const restaurantData = { ...restaurantSnap.data(), id: restaurantSnap.id } as Restaurant;
          // Fetch the plan to get billingPeriod
          let billingPeriod: 'monthly' | 'yearly' | undefined;
          if (restaurantData.planId) {
            const planSnap = await getDoc(doc(db, 'plans', restaurantData.planId));
            if (planSnap.exists()) {
              billingPeriod = (planSnap.data() as { billingPeriod: 'monthly' | 'yearly' }).billingPeriod;
            }
          }
          const info = getSubscriptionInfo(restaurantData, billingPeriod);
          if (info.status === 'suspended') {
            await firebaseSignOut(auth);
            throw new Error(
              'Tu cuenta está suspendida por falta de pago. Contactá a soporte para reactivarla.',
            );
          }
        }
      }
    }
  },

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  },

  async getUserData(uid: string): Promise<AppUser | null> {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docSnap.data() as AppUser;
  },

  async createUser(data: {
    email: string;
    password: string;
    displayName: string;
    role: UserRole;
    restaurantId?: string;
  }): Promise<string> {
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const { uid } = userCredential.user;

    await updateProfile(userCredential.user, { displayName: data.displayName });

    const now = new Date().toISOString();
    const userData: AppUser = {
      uid,
      email: data.email,
      displayName: data.displayName,
      role: data.role,
      restaurantId: data.restaurantId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, 'users', uid), userData);
    return uid;
  },
};
