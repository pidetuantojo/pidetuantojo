import Link from 'next/link';

export default function RestaurantNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <p className="text-6xl">🍽️</p>
      <h1 className="text-2xl font-bold text-gray-900">Restaurante no encontrado</h1>
      <p className="text-gray-500">
        El menú que buscas no existe o no está disponible por el momento.
      </p>
      <Link href="/" className="text-sm font-medium text-orange-600 hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}
