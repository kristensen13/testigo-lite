import { linkStatus, linkStatusText, type LinkInfo } from "@/domain/public-link";
import { EnlaceAcciones } from "./enlace-acciones";

/** Sección "Enlace para el cliente": estado (texto) y acciones. Nunca recibe el token. */
export function EnlaceCliente({
  orderId,
  link,
  customerName,
  customerPhone,
  plate,
}: {
  orderId: string;
  link: LinkInfo | null;
  customerName: string;
  customerPhone: string;
  plate: string;
}) {
  const status = linkStatus(link, new Date());
  return (
    <section aria-labelledby="enlace" className="rounded-md border border-line bg-paper p-4">
      <h2 id="enlace" className="font-display text-xl font-semibold uppercase">
        Enlace para el cliente
      </h2>
      <p data-testid="estado-enlace" className="mt-2 font-medium">
        <span aria-hidden="true">{status.kind === "activo" ? "● " : "○ "}</span>
        {linkStatusText(status)}
      </p>
      <div className="mt-3">
        <EnlaceAcciones
          orderId={orderId}
          hasLink={status.kind !== "ninguno"}
          canRevoke={status.kind === "activo"}
          customerName={customerName}
          customerPhone={customerPhone}
          plate={plate}
        />
      </div>
    </section>
  );
}
