import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, requireRole } from '@/lib/auth/serverAuth';
import { adminAuth } from '@/lib/firebase/admin';

// Todas las operaciones son del super admin (Authorization: Bearer <idToken>).

interface FirebaseAuthError {
  error?: {
    message?: string;
    code?: number;
  };
}

interface FirebaseSignUpResponse {
  localId: string;
}

async function createFirebaseUser(email: string, password: string): Promise<string> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    }
  );

  if (!res.ok) {
    const err = (await res.json()) as FirebaseAuthError;
    const msg = err.error?.message ?? 'Error al crear el usuario';
    if (msg === 'EMAIL_EXISTS') throw new Error('Ya existe un usuario con ese correo');
    throw new Error(msg);
  }

  const data = (await res.json()) as FirebaseSignUpResponse;
  return data.localId;
}

// POST: crea el usuario admin del restaurante en Firebase Auth y devuelve el uid
// El batch de Firestore lo hace el cliente (que sí tiene auth context)
export async function POST(request: NextRequest) {
  try {
    await requireRole(request, ['super_admin']);
    const { adminEmail, adminPassword } = (await request.json()) as {
      adminEmail: string;
      adminPassword: string;
    };

    const adminUid = await createFirebaseUser(adminEmail, adminPassword);
    return NextResponse.json({ adminUid });
  } catch (error) {
    if (error instanceof Error && error.message === 'Ya existe un usuario con ese correo') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(error, 'Error interno del servidor');
  }
}

// DELETE: rollback — borra el usuario de Auth si el batch de Firestore falló
export async function DELETE(request: NextRequest) {
  try {
    await requireRole(request, ['super_admin']);
    const { uid } = (await request.json()) as { uid: string };
    await adminAuth.deleteUser(uid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'Error al eliminar usuario');
  }
}

// PATCH: cambia la contraseña del admin del restaurante
export async function PATCH(request: NextRequest) {
  try {
    await requireRole(request, ['super_admin']);
    const { uid, newPassword } = (await request.json()) as { uid: string; newPassword: string };
    await adminAuth.updateUser(uid, { password: newPassword });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'Error interno del servidor');
  }
}
