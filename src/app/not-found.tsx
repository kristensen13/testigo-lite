import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página no encontrada · Testigo Lite",
  robots: { index: false },
};

/** 404 general (rutas que no existen). Las órdenes tienen la suya en ordenes/[id]/not-found.tsx. */
export default function NoEncontrada() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <h1 className="font-display text-3xl font-semibold uppercase">404 · Página no encontrada</h1>
      <p className="mt-2 text-muted">La dirección que has abierto no existe o ha cambiado.</p>
      <Link
        href="/"
        className="mt-4 inline-flex min-h-12 items-center justify-center self-start rounded-md bg-ink px-4 font-display text-lg font-semibold uppercase text-paper"
      >
        Ir al inicio
      </Link>
    </main>
  );
}
