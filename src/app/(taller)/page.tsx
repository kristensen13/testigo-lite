import { Suspense } from "react";
import Link from "next/link";
import { OrderCard } from "@/components/order-card";
import { LimitNotices, PreviousDeliveredLink } from "@/components/board-notices";
import { groupByStatus, parseBoardSearch } from "@/domain/board";
import {
  BOARD_HREF,
  DELIVERED_WINDOW_DAYS,
  limitNotices,
  parseBoardView,
  previousDeliveredHref,
} from "@/domain/board-limits";
import { ORDER_STATUSES, workshopLabel } from "@/domain/order-status";
import { fetchBoard, fetchPreviousDelivered } from "@/lib/board";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ q?: string | string[]; entregadas?: string | string[] }>;

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-md px-4 font-display text-lg font-semibold uppercase";

function SearchForm({ q, previous, showClear }: { q: string; previous: boolean; showClear: boolean }) {
  return (
    <form action="/" method="get" role="search" className="mt-4 flex flex-wrap items-end gap-2">
      {previous && <input type="hidden" name="entregadas" value="anteriores" />}
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
      {q !== "" && showClear && (
        <Link
          href={previous ? previousDeliveredHref("") : BOARD_HREF}
          className={`${buttonClass} border border-ink`}
        >
          Limpiar búsqueda
        </Link>
      )}
    </form>
  );
}

function countLabel(n: number, q: string) {
  return `${n === 1 ? "1 orden" : `${n} órdenes`}${q !== "" ? ` para «${q}»` : ""}`;
}

async function Board({ q }: { q: string }) {
  const supabase = await createClient();
  const now = new Date();
  const board = await fetchBoard(supabase, q, now);
  const orders = board.orders;
  const groups = groupByStatus(orders);
  const notices = limitNotices({
    abiertas: board.openTruncated,
    entregadas_recientes: board.recentTruncated,
  });

  return (
    <>
      <SearchForm q={q} previous={false} showClear={orders.length > 0} />
      <PreviousDeliveredLink show={board.hasPrevious} q={q} />
      <LimitNotices notices={notices} />

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
                {board.hasPrevious && " También puedes buscar entre las entregadas anteriores."}
              </p>
              <Link href={BOARD_HREF} className={`${buttonClass} mt-4 bg-ink text-paper`}>
                Limpiar búsqueda
              </Link>
            </>
          )}
        </div>
      ) : (
        <p role="status" className="mt-4 text-sm text-muted">
          {countLabel(orders.length, q)}
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

async function PreviousDelivered({ q }: { q: string }) {
  const supabase = await createClient();
  const now = new Date();
  const { orders, truncated } = await fetchPreviousDelivered(supabase, q, now);
  const notices = limitNotices({ entregadas_anteriores: truncated });

  return (
    <>
      <p className="mt-1">
        <Link
          href={BOARD_HREF}
          className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
        >
          Volver al tablero
        </Link>
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold uppercase">Entregadas anteriores</h2>
      <p className="text-muted">
        Órdenes entregadas hace más de {DELIVERED_WINDOW_DAYS} días, de la más reciente a la más
        antigua.
      </p>
      <SearchForm q={q} previous showClear />
      <LimitNotices notices={notices} />

      {orders.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-line bg-paper p-6">
          {q === "" ? (
            <p className="font-medium">No hay entregadas anteriores.</p>
          ) : (
            <>
              <p className="font-medium">No hay entregadas anteriores que coincidan con «{q}».</p>
              <p className="mt-1 text-muted">
                Prueba con otra matrícula o con parte del nombre del cliente.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <p role="status" className="mt-4 text-sm text-muted">
            {countLabel(orders.length, q)}
          </p>
          <section aria-labelledby="col-anteriores" className="mt-2 max-w-xl">
            <h2
              id="col-anteriores"
              className="flex items-baseline justify-between border-b-2 border-ink pb-1 font-display text-lg font-semibold uppercase"
            >
              {workshopLabel("entregado")}
              <span className="tabular text-base text-muted">{orders.length}</span>
            </h2>
            <ul className="mt-2 space-y-2">
              {orders.map((order) => (
                <li key={order.id}>
                  <OrderCard order={order} now={now} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}

async function BoardContent({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const q = parseBoardSearch(raw);
  return parseBoardView(raw) === "anteriores" ? <PreviousDelivered q={q} /> : <Board q={q} />;
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
        <BoardContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
