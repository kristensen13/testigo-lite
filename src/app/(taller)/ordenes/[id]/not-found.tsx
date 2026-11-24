import Link from "next/link";

export default function OrdenNoEncontrada() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="font-display text-3xl font-semibold uppercase">404 · Orden no encontrada</h1>
      <p className="mt-2 text-muted">
        La orden no existe o no pertenece a tu taller.
      </p>
      <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-ink px-4 font-display text-lg font-semibold uppercase text-paper">
        Volver al tablero
      </Link>
    </main>
  );
}
