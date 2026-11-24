export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[42rem] flex-1 px-4 py-4" aria-busy="true">
      <p role="status" className="rounded-md bg-ink px-5 py-6 text-base text-paper motion-safe:animate-pulse">
        Cargando el estado de tu coche…
      </p>
    </main>
  );
}
