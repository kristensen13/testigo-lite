import { Suspense } from "react";
import Link from "next/link";
import { OrderCard } from "@/components/order-card";
import { groupByStatus, parseBoardSearch } from "@/domain/board";
import { ORDER_STATUSES, workshopLabel } from "@/domain/order-status";
import { fetchBoardOrders } from "@/lib/board";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ q?: string | string[] }>;

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-md px-4 font-display text-lg font-semibold uppercase";

async function Board({ searchParams }: { searchParams: SearchParams }) {
  const q = parseBoardSearch(await searchParams);
  const supabase = await createClient();
  const orders = await fetchBoardOrders(supabase, q);
  const groups = groupByStatus(orders);
  const now = new Date();

  return (
    <>
      <form action="/" method="get" role="search" className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor="q" className="block text-sm font-medium">
            Buscar por matrícula o cliente
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={80}
            autoComplete="off"
            className="mt-1 min-h-11 w-full rounded-md border border-ink-soft bg-paper px-3"
          />
        </div>
        <button type="submit" className={`${buttonClass} bg-ink text-paper`}>
          Buscar
        </button>
        {q !== "" && orders.length > 0 && (
          <Link href="/" className={`${buttonClass} border border-ink`}>
            Limpiar búsqueda
          </Link>
        )}
      </form>

      {orders.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-line bg-paper p-6">
          {q === "" ? (
            <>
              <p className="font-medium">Todavía no hay órdenes que mostrar.</p>
              <p className="mt-1 text-muted">
                Cuando crees una orden de reparación aparecerá aquí, agrupada por estado.
              </p>
              <Link href="/ordenes/nueva" className={`${buttonClass} mt-4 bg-ink text-paper`}>
                Nueva orden
              </Link>
            </>
          ) : (
            <>
              <p className="font-medium">No hay órdenes que coincidan con «{q}».</p>
              <p className="mt-1 text-muted">
                Prueba con otra matrícula o con parte del nombre del cliente.
              </p>
              <Link href="/" className={`${buttonClass} mt-4 bg-ink text-paper`}>
                Limpiar búsqueda
              </Link>
            </>
          )}
        </div>
      ) : (
        <p role="status" className="mt-4 text-sm text-muted">
          {orders.length === 1 ? "1 orden" : `${orders.length} órdenes`}
          {q !== "" && ` para «${q}»`}
        </p>
      )}

      {orders.length > 0 && (
        <div className="mt-2 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {ORDER_STATUSES.map((status) => (
            <section key={status} aria-labelledby={`col-${status}`} className="min-w-0">
              <h2
                id={`col-${status}`}
                className="flex items-baseline justify-between border-b-2 border-ink pb-1 font-display text-lg font-semibold uppercase"
              >
                {workshopLabel(status)}
                <span className="tabular text-base text-muted">{groups[status].length}</span>
              </h2>
              {groups[status].length === 0 ? (
                <p className="mt-2 text-sm text-muted">Sin órdenes</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {groups[status].map((order) => (
                    <li key={order.id}>
                      <OrderCard order={order} now={now} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

export default function TableroPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold uppercase">Tablero</h1>
        <Link href="/ordenes/nueva" className={`${buttonClass} bg-ink text-paper`}>
          Nueva orden
        </Link>
      </div>
      <Suspense
        fallback={
          <p role="status" className="mt-6 text-muted">
            Cargando órdenes…
          </p>
        }
      >
        <Board searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
