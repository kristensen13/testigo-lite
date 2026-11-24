"use client";

export default function LoginError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <h1 className="font-display text-2xl font-semibold uppercase">
        No se ha podido cargar el acceso
      </h1>
      <p role="alert" className="mt-2 text-muted">
        Ha ocurrido un error inesperado. Inténtalo de nuevo.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 min-h-12 rounded-md bg-ink px-4 font-display text-lg font-semibold uppercase text-paper"
      >
        Reintentar
      </button>
    </main>
  );
}
