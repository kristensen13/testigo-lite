"use client";

export default function TallerError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <h1 className="font-display text-2xl font-semibold uppercase">
        Algo ha ido mal
      </h1>
      <p role="alert" className="mt-2 text-muted">
        No hemos podido cargar esta pantalla. Inténtalo de nuevo.
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
