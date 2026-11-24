// Tablero provisional: T6 lo sustituirá por el tablero real.
export default function TableroPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <h1 className="font-display text-3xl font-semibold uppercase">Tablero</h1>
      <div className="mt-6 rounded-md border border-dashed border-line bg-paper p-6">
        <p className="font-medium">Todavía no hay órdenes que mostrar.</p>
        <p className="mt-1 text-muted">
          Cuando crees una orden de reparación aparecerá aquí, agrupada por
          estado.
        </p>
      </div>
    </main>
  );
}
