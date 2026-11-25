import Link from "next/link";
import { previousDeliveredHref } from "@/domain/board-limits";

/** Avisos de límite del tablero: texto visible (y anunciado), nunca solo color. */
export function LimitNotices({ notices }: { notices: readonly string[] }) {
  if (notices.length === 0) return null;
  return (
    <div role="status" data-testid="aviso-limite" className="mt-4 space-y-2">
      {notices.map((text) => (
        <p key={text} className="rounded-md border-2 border-ink bg-paper p-3 text-sm font-medium">
          <span className="font-display uppercase">Aviso: </span>
          {text}
        </p>
      ))}
    </div>
  );
}

/** Enlace a la vista de entregadas hace más de 30 días; solo si existen. */
export function PreviousDeliveredLink({ show, q }: { show: boolean; q: string }) {
  if (!show) return null;
  return (
    <p className="mt-3">
      <Link
        href={previousDeliveredHref(q)}
        className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
      >
        Ver entregadas anteriores
      </Link>
    </p>
  );
}
