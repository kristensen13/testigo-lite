import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildHistory, isUuid, statusButtons } from "@/domain/order-detail";
import { formatDateTime } from "@/domain/format";
import { workshopLabel } from "@/domain/order-status";
import { fetchOrderLines } from "@/lib/order-lines";
import { fetchOrderDetail, fetchOrderEvents } from "@/lib/order-detail";
import { createClient } from "@/lib/supabase/server";
import { fetchLinkInfo } from "@/lib/public-link";
import { EnlaceCliente } from "./enlace-cliente";
import { Presupuesto } from "./presupuesto";
import { StatusButtons } from "./status-buttons";

export const metadata = { title: "Ficha de la orden" };

const kmFmt = new Intl.NumberFormat("es-ES");

async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [order, events, lines, link] = await Promise.all([
    fetchOrderDetail(supabase, id),
    fetchOrderEvents(supabase, id),
    fetchOrderLines(supabase, id),
    fetchLinkInfo(supabase, id),
  ]);
  if (!order) notFound();

  const history = buildHistory(events);
  const buttons = statusButtons(order.status);

  return (
    <>
      <header className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="font-display text-3xl font-semibold uppercase">
          <span className="tabular">{order.plate}</span>
          <span className="ml-2 text-lg text-muted">Orden n.º {order.number}</span>
        </h1>
        <p className="text-sm text-muted">Entrada: {formatDateTime(order.createdAt)}</p>
      </header>

      <section aria-labelledby="estado" className="mt-4 rounded-md border-2 border-ink bg-paper p-4">
        <h2 id="estado" className="text-sm font-medium text-muted">
          Estado actual
        </h2>
        <p
          data-testid="estado-actual"
          className="mt-1 inline-flex items-center gap-2 rounded-sm bg-ink px-3 py-1 font-display text-2xl font-semibold uppercase text-paper"
        >
          <span aria-hidden="true">■</span>
          {workshopLabel(order.status)}
        </p>
        <div className="mt-4">
          {buttons.length === 0 ? (
            <p className="text-muted">
              La orden está entregada: no admite más cambios de estado.
            </p>
          ) : (
            <>
              <p className="mb-2 text-sm font-medium">Cambiar estado</p>
              <StatusButtons orderId={order.id} buttons={buttons} />
            </>
          )}
        </div>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section aria-labelledby="cliente" className="rounded-md border border-line bg-paper p-4">
          <h2 id="cliente" className="font-display text-xl font-semibold uppercase">
            Cliente
          </h2>
          <dl className="mt-2 space-y-1">
            <div>
              <dt className="text-sm text-muted">Nombre</dt>
              <dd className="font-medium">{order.customerName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Teléfono</dt>
              <dd className="tabular font-medium">{order.customerPhone}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="vehiculo" className="rounded-md border border-line bg-paper p-4">
          <h2 id="vehiculo" className="font-display text-xl font-semibold uppercase">
            Vehículo
          </h2>
          <dl className="mt-2 space-y-1">
            <div>
              <dt className="text-sm text-muted">Matrícula</dt>
              <dd className="tabular font-medium">{order.plate}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Marca y modelo</dt>
              <dd className="font-medium">{order.makeModel}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Kilómetros de entrada</dt>
              <dd className="tabular font-medium">{kmFmt.format(order.kmIn)} km</dd>
            </div>
          </dl>
        </section>
      </div>

      <section aria-labelledby="averia" className="mt-4 rounded-md border border-line bg-paper p-4">
        <h2 id="averia" className="font-display text-xl font-semibold uppercase">
          Avería que cuenta el cliente
        </h2>
        <p className="mt-2 whitespace-pre-wrap break-words">{order.complaint}</p>
      </section>

      {/* Hueco reservado: T9 (presupuesto) y T11 (enlace para el cliente). */}
      <div data-slot="presupuesto-y-enlace" className="mt-4 space-y-4">
        <Presupuesto orderId={order.id} rows={lines} />
        <EnlaceCliente
          orderId={order.id}
          link={link}
          customerName={order.customerName}
          customerPhone={order.customerPhone}
          plate={order.plate}
        />
      </div>

      <section aria-labelledby="historial" className="mt-4 rounded-md border border-line bg-paper p-4">
        <h2 id="historial" className="font-display text-xl font-semibold uppercase">
          Historial
        </h2>
        {history.length === 0 ? (
          <p className="mt-2 text-muted">Esta orden todavía no tiene eventos.</p>
        ) : (
          <ol className="mt-2 divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="py-2">
                <p className="font-medium">{h.title}</p>
                <p className="text-sm text-muted">
                  <time dateTime={h.iso}>{h.when}</time> · {h.actor}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

export default function OrdenPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-medium underline">
        Volver al tablero
      </Link>
      <Suspense
        fallback={
          <p role="status" className="mt-4 text-muted">
            Cargando orden…
          </p>
        }
      >
        <Ficha params={params} />
      </Suspense>
    </main>
  );
}
