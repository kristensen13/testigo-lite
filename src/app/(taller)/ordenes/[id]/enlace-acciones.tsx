"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { shareText } from "@/domain/public-link";
import { whatsappUrl } from "@/domain/whatsapp";
import { enlaceAction, type EnlaceState } from "./enlace-actions";

const BTN =
  "inline-flex min-h-11 items-center justify-center rounded-md px-4 font-display text-lg font-semibold uppercase disabled:opacity-70";

function Botones({ hasLink, canRevoke }: { hasLink: boolean; canRevoke: boolean }) {
  const { pending, data } = useFormStatus();
  const intent = pending ? String(data?.get("intent") ?? "") : "";
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="submit"
        name="intent"
        value="crear"
        disabled={pending}
        className={`${BTN} bg-ink text-paper`}
      >
        {intent === "crear" ? "Creando…" : hasLink ? "Generar enlace nuevo" : "Enlace para el cliente"}
      </button>
      {canRevoke ? (
        <button
          type="submit"
          name="intent"
          value="revocar"
          disabled={pending}
          className={`${BTN} border-2 border-ink bg-paper text-ink`}
        >
          {intent === "revocar" ? "Revocando…" : "Revocar enlace"}
        </button>
      ) : null}
    </div>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Se prueba el respaldo.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const done = document.execCommand("copy");
    document.body.removeChild(area);
    return done;
  } catch {
    return false;
  }
}

export function EnlaceAcciones({
  orderId,
  hasLink,
  canRevoke,
  customerName,
  customerPhone,
  plate,
}: {
  orderId: string;
  hasLink: boolean;
  canRevoke: boolean;
  customerName: string;
  customerPhone: string;
  plate: string;
}) {
  const [state, formAction] = useActionState<EnlaceState, FormData>(enlaceAction, {});
  const [copyMsg, setCopyMsg] = useState("");
  const url = state.url;
  const wa = url ? whatsappUrl(customerPhone, shareText(customerName, plate, url)) : null;

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="orderId" value={orderId} />
        <Botones hasLink={hasLink} canRevoke={canRevoke} />
        {state.error ? (
          <p role="alert" className="text-sm font-medium text-rust">
            {state.error}
          </p>
        ) : null}
        {state.done === "revocado" ? (
          <p role="status" className="text-sm">
            Enlace revocado: el cliente ya no puede usarlo.
          </p>
        ) : null}
      </form>

      {url ? (
        <div className="space-y-2 rounded-md border border-line p-3">
          <p className="text-sm font-medium">Enlace para enviar al cliente (solo se muestra ahora)</p>
          <p data-testid="url-cliente" className="tabular break-all font-medium">
            {url}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`${BTN} border-2 border-ink bg-paper text-ink`}
              onClick={async () =>
                setCopyMsg(
                  (await copyText(url))
                    ? "Enlace copiado"
                    : "No se pudo copiar: selecciona el enlace y cópialo a mano",
                )
              }
            >
              Copiar enlace
            </button>
            {wa?.ok ? (
              <a
                href={wa.value}
                target="_blank"
                rel="noopener noreferrer"
                className={`${BTN} bg-ink text-paper`}
              >
                Compartir por WhatsApp
              </a>
            ) : null}
          </div>
          <p role="status" aria-live="polite" className="min-h-5 text-sm">
            {copyMsg}
          </p>
          {wa && !wa.ok ? (
            <p role="alert" className="text-sm font-medium text-rust">
              No podemos compartir por WhatsApp: el teléfono del cliente no es válido ({wa.error}).
              Copia el enlace y envíalo por otro medio.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
