"use client";

export default function PortalError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-[42rem] flex-1 px-4 py-10">
      <div className="rounded-md bg-ink px-5 py-8 text-paper">
        <h1 className="font-display text-3xl font-semibold uppercase leading-tight">
          No hemos podido cargar tu coche
        </h1>
        <p role="alert" className="mt-3 text-base text-line">
          Ha habido un problema al consultar el estado. Inténtalo de nuevo en un momento.
        </p>
      </div>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 min-h-12 rounded-md bg-ink px-5 font-display text-lg font-semibold uppercase text-paper"
      >
        Reintentar
      </button>
    </main>
  );
}
