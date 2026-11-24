import Link from "next/link";
import { ageLabel, decisionChipLabel, type BoardOrder } from "@/domain/board";

/** Tarjeta de una orden en el tablero: toda ella es un enlace a la ficha. */
export function OrderCard({ order, now }: { order: BoardOrder; now: Date }) {
  const chip = decisionChipLabel(order.decisions);
  return (
    <Link
      href={`/ordenes/${order.id}`}
      className="block min-h-11 rounded-md border border-line bg-paper p-3 hover:border-ink"
    >
      <span className="tabular block font-display text-xl font-semibold uppercase leading-tight">
        {order.plate}
      </span>
      <span className="mt-0.5 block font-medium">{order.customerName}</span>
      {order.makeModel !== "" && (
        <span className="block text-sm text-muted">{order.makeModel}</span>
      )}
      <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        <span>{ageLabel(order.createdAt, now)}</span>
        {chip !== null && (
          <span className="rounded-sm bg-accent px-2 py-0.5 font-medium text-ink">
            {chip}
          </span>
        )}
      </span>
    </Link>
  );
}
