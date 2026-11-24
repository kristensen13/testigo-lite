export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6" aria-busy="true">
      <p role="status" className="text-muted">Cargando formulario…</p>
    </main>
  );
}
