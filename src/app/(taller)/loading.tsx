export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-6xl flex-1 px-4 py-8"
      aria-busy="true"
    >
      <p role="status" className="text-muted">
        Cargando…
      </p>
    </main>
  );
}
