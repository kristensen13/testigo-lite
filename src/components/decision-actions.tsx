"use client";

import { useEffect, useId, useRef, useState } from "react";
import { decideLine } from "@/app/p/[token]/actions";
import {
  CONFIRM_LABEL,
  confirmationQuestion,
  ERR_GENERICO,
  VAT_INCLUDED_TEXT,
  type ClientDecision,
} from "@/domain/portal-decision";

const BTN = "min-h-12 min-w-[8rem] flex-1 rounded-md px-4 font-display text-lg font-semibold uppercase disabled:opacity-60";
const SOLID = `${BTN} bg-ink text-paper`;
const OUTLINE = `${BTN} border-2 border-ink bg-paper text-ink`;

/**
 * Aprobar / rechazar un trabajo pendiente. Pulsar abre una confirmación dentro
 * de la tarjeta; solo "Sí, ..." guarda. Es el único componente cliente del portal.
 */
export function DecisionActions({
  token,
  lineId,
  description,
  amountText,
}: {
  token: string;
  lineId: string;
  description: string;
  /** Importe de ESTA línea con IVA incluido, ya formateado. */
  amountText: string;
}) {
  const questionId = useId();
  const [pending, setPending] = useState<ClientDecision | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const approveRef = useRef<HTMLButtonElement>(null);
  const rejectRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const restoreTo = useRef<ClientDecision | null>(null);

  // Al abrir el panel, el foco va al botón de confirmar; al cancelar, vuelve al que lo abrió.
  useEffect(() => {
    if (pending) {
      confirmRef.current?.focus();
    } else if (restoreTo.current) {
      (restoreTo.current === "aprobada" ? approveRef : rejectRef).current?.focus();
      restoreTo.current = null;
    }
  }, [pending]);

  function open(decision: ClientDecision) {
    setError(null);
    setPending(decision);
  }

  function cancel() {
    restoreTo.current = pending;
    setError(null);
    setPending(null);
  }

  async function confirm() {
    if (!pending || saving) return;
    setSaving(true);
    setError(null);
    try {
      const r = await decideLine({ token, lineId, decision: pending });
      if (r.ok) {
        setDone(r.summary);
        setPending(null);
        // La Server Action ya ha revalidado la ruta: la página se refresca sola con los totales nuevos.
      } else {
        setError(r.error);
      }
    } catch {
      // Red caída o respuesta 5xx de la Server Action: el panel sigue abierto para reintentar.
      setError(ERR_GENERICO);
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="mt-3 text-base font-semibold">
        {done}
      </p>
    );
  }

  if (!pending) {
    return (
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          ref={approveRef}
          type="button"
          className={SOLID}
          aria-label={`Aprobar «${description}»`}
          onClick={() => open("aprobada")}
        >
          <span aria-hidden="true">✓ </span>Aprobar
        </button>
        <button
          ref={rejectRef}
          type="button"
          className={OUTLINE}
          aria-label={`Rechazar «${description}»`}
          onClick={() => open("rechazada")}
        >
          <span aria-hidden="true">✕ </span>Rechazar
        </button>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-labelledby={questionId}
      data-testid="portal-confirmacion"
      className="mt-3 rounded-md border-2 border-ink p-3"
    >
      <p id={questionId} className="font-semibold">
        {confirmationQuestion(pending, description, amountText)}
      </p>
      <p className="text-base text-muted">{VAT_INCLUDED_TEXT}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          ref={confirmRef}
          type="button"
          className={SOLID}
          disabled={saving}
          aria-describedby={questionId}
          onClick={confirm}
        >
          {CONFIRM_LABEL[pending]}
        </button>
        <button type="button" className={OUTLINE} disabled={saving} onClick={cancel}>
          Volver
        </button>
      </div>
      {saving ? (
        <p role="status" className="mt-2 text-base">
          Guardando…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-base font-semibold text-rust">
          {error}
        </p>
      ) : null}
    </div>
  );
}
