import { EMPTY_LINE_VALUES, toLineView, totalsView, type OrderLineRow } from "@/domain/order-lines";
import { AddLineForm, LineActions } from "./linea-forms";

/** Sección "Presupuesto" de la ficha: líneas, alta y totales calculados por el dominio. */
export function Presupuesto({ orderId, rows }: { orderId: string; rows: OrderLineRow[] }) {
  const lines = rows.map(toLineView);
  const totals = totalsView(rows);

  return (
    <section aria-labelledby="presupuesto" className="rounded-md border border-line bg-paper p-4">
      <h2 id="presupuesto" className="font-display text-xl font-semibold uppercase">
        Presupuesto
      </h2>

      {lines.length === 0 ? (
        <p className="mt-2 text-muted">
          Todavía no hay trabajos ni recambios. Añade la primera línea con el formulario de abajo.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-line" aria-label="Líneas del presupuesto">
          {lines.map((l) => (
            <li key={l.id} data-testid="linea" className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 break-words font-medium">
                  <span className="mr-2 text-sm font-normal text-muted">{l.kindLabel}</span>
                  {l.description}
                </p>
                <p className="tabular font-medium">{l.lineTotalText}</p>
              </div>
              <p className="tabular text-sm text-muted">
                {l.qtyText} × {l.unitPriceText} sin IVA
              </p>
              <p className="mt-1 text-sm">
                <span className="font-medium">Decisión del cliente: </span>
                <span data-testid="decision">{l.decisionLabel}</span>
              </p>
              {l.locked ? (
                <p className="mt-1 text-sm text-muted">
                  Decidida por el cliente
                  {l.decidedAtText ? <> el {l.decidedAtText}</> : null}
                </p>
              ) : (
                <LineActions
                  orderId={orderId}
                  lineId={l.id}
                  description={l.description}
                  values={l.values}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-3 space-y-1 border-t border-line pt-3" aria-label="Totales del presupuesto">
        <div className="flex justify-between gap-4">
          <dt>Base imponible</dt>
          <dd data-testid="total-base" className="tabular font-medium">{totals.base}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>IVA (21 %)</dt>
          <dd data-testid="total-iva" className="tabular font-medium">{totals.vat}</dd>
        </div>
        <div className="flex justify-between gap-4 text-lg font-semibold">
          <dt>Total del presupuesto</dt>
          <dd data-testid="total-presupuesto" className="tabular">{totals.total}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Total aprobado</dt>
          <dd data-testid="total-aprobado" className="tabular font-medium">{totals.approvedTotal}</dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-line pt-4">
        <h3 className="font-display text-lg font-semibold uppercase">Añadir línea</h3>
        <div className="mt-2">
          <AddLineForm orderId={orderId} initial={EMPTY_LINE_VALUES} />
        </div>
      </div>
    </section>
  );
}
