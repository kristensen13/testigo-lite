import { z } from "zod";
import { formatDateTime } from "./format";
import { err, ok, type Result } from "./result";
import { lineBaseCents, VAT_BP } from "./totals";

export const CLIENT_DECISIONS = ["aprobada", "rechazada"] as const;
export type ClientDecision = (typeof CLIENT_DECISIONS)[number];

/** Entrada de la acción decideLine: solo token, línea y decisión; nunca importes ni estados. */
export const decideInputSchema = z.strictObject({
  token: z.string().regex(/^[0-9a-f]{64}$/, "Enlace no válido"),
  lineId: z.uuid("Trabajo no válido"),
  decision: z.enum(CLIENT_DECISIONS, "Decisión no válida"),
});

export type DecideInput = z.infer<typeof decideInputSchema>;

export function parseDecideInput(raw: unknown): Result<DecideInput> {
  const parsed = decideInputSchema.safeParse(raw);
  return parsed.success
    ? ok(parsed.data)
    : err(parsed.error.issues[0]?.message ?? "Datos no válidos");
}

/** Respuesta exacta de portal_decide. */
export const decideResponseSchema = z.strictObject({
  id: z.uuid(),
  decision: z.enum(CLIENT_DECISIONS),
  decided_at: z.iso.datetime({ offset: true }),
});

export const ERR_ENLACE = "Este enlace ya no está disponible";
export const ERR_NO_ESPERA = "El taller todavía no espera tu respuesta para este trabajo";
export const ERR_YA_DECIDIDA = "Este trabajo ya tiene una respuesta";
export const ERR_NO_ENCONTRADA = "No encontramos este trabajo en tu presupuesto";
export const ERR_GENERICO = "No hemos podido guardar tu respuesta. Inténtalo de nuevo";

/** Traduce el mensaje estable de la RPC a castellano, sin filtrar detalles internos. */
export function decideErrorMessage(code: unknown): string {
  switch (code) {
    case "enlace_no_valido":
      return ERR_ENLACE;
    case "orden_no_esperando_aprobacion":
      return ERR_NO_ESPERA;
    case "linea_ya_decidida":
      return ERR_YA_DECIDIDA;
    case "linea_no_encontrada":
      return ERR_NO_ENCONTRADA;
    default:
      // decision_invalida, errores de red o de servidor, mensajes desconocidos.
      return ERR_GENERICO;
  }
}

/**
 * Total de UNA línea con IVA, en céntimos: base (half-up) + IVA de esa base
 * (half-up). Solo enteros, sin coma flotante.
 */
export function lineTotalWithVatCents(
  qtyMilli: number,
  unitPriceCents: number,
  vatBp: number = VAT_BP,
): number {
  const base = lineBaseCents(qtyMilli, unitPriceCents);
  const vat = (BigInt(2) * BigInt(base) * BigInt(vatBp) + BigInt(10000)) / BigInt(20000);
  return base + Number(vat);
}

const VERB: Record<ClientDecision, string> = { aprobada: "Apruebas", rechazada: "Rechazas" };

/** "¿Apruebas «Pastillas» por 88,94 €?" */
export function confirmationQuestion(
  decision: ClientDecision,
  description: string,
  amountText: string,
): string {
  return `¿${VERB[decision]} «${description}» por ${amountText}?`;
}

export const VAT_INCLUDED_TEXT = "IVA incluido";

export const CONFIRM_LABEL: Record<ClientDecision, string> = {
  aprobada: "Sí, apruébalo",
  rechazada: "Sí, recházalo",
};

const DECIDED_LABEL: Record<ClientDecision, string> = {
  aprobada: "Aprobado",
  rechazada: "Rechazado",
};

/** "Aprobado el 5 ene 2030, 09:30" */
export function decisionSummary(decision: ClientDecision, decidedAtIso: string): string {
  return `${DECIDED_LABEL[decision]} el ${formatDateTime(decidedAtIso)}`;
}
