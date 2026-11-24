"use client";

import Link from "next/link";

export default function OrdenError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="font-display text-2xl font-semibold uppercase">No se pudo cargar la orden</h1>
      <p role="alert" className="mt-2 text-muted">
        Ha ocurrido un error al leer la ficha. Inténtalo de nuevo.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="min-h-11 rounded-md bg-ink px-4 font-display text-lg font-semibold uppercase text-paper"
        >
          Reintentar
        </button>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-md border border-ink px-4 font-medium">
          Volver al tablero
        </Link>
      </div>
    </main>
  );
}
