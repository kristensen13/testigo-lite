import { z } from "zod";
import { normalizePhone } from "./whatsapp";
import { normalizePlate } from "./plate";

/** Límites iguales a los checks de 0001_init.sql. */
export const LIMITS = {
  name: 120,
  phone: 30,
  plate: 20,
  makeModel: 120,
  km: 3_000_000,
  complaint: 2000,
} as const;

export const NEW_ORDER_FIELDS = [
  "customerName",
  "customerPhone",
  "plate",
  "makeModel",
  "km",
  "complaint",
] as const;
export type NewOrderField = (typeof NEW_ORDER_FIELDS)[number];

/** Valores tal cual los escribió el usuario (para conservarlos ante errores). */
export type NewOrderValues = Record<NewOrderField, string>;
export type NewOrderErrors = Partial<Record<NewOrderField, string>>;

export interface NewOrderInput {
  customerName: string;
  customerPhone: string;
  plate: string;
  makeModel: string;
  km: number;
  complaint: string;
}

const text = (obligatorio: string, max: number, largo: string) =>
  z.string().trim().min(1, obligatorio).max(max, largo);

export const newOrderSchema = z.object({
  customerName: text("Escribe el nombre del cliente", LIMITS.name, `El nombre admite como máximo ${LIMITS.name} caracteres`),
  customerPhone: z
    .string()
    .trim()
    .min(1, "Escribe el teléfono del cliente")
    .max(LIMITS.phone, `El teléfono admite como máximo ${LIMITS.phone} caracteres`)
    .superRefine((v, ctx) => {
      const r = normalizePhone(v);
      if (!r.ok) ctx.addIssue({ code: "custom", message: r.error });
    }),
  plate: z
    .string()
    .trim()
    .max(LIMITS.plate, `La matrícula admite como máximo ${LIMITS.plate} caracteres`)
    .superRefine((v, ctx) => {
      const n = normalizePlate(v);
      if (n.length === 0) ctx.addIssue({ code: "custom", message: "Escribe la matrícula" });
    }),
  makeModel: text("Escribe la marca y el modelo", LIMITS.makeModel, `La marca y modelo admiten como máximo ${LIMITS.makeModel} caracteres`),
  km: z
    .string()
    .trim()
    .min(1, "Escribe los kilómetros")
    .regex(/^\d+$/, "Los kilómetros deben ser un número entero igual o mayor que 0")
    .refine((v) => v.length <= 7 && Number(v) <= LIMITS.km, `Los kilómetros no pueden pasar de ${LIMITS.km.toLocaleString("es-ES")}`)
    .transform(Number),
  complaint: text("Cuenta la avería del cliente", LIMITS.complaint, `La avería admite como máximo ${LIMITS.complaint} caracteres`),
});

export type NewOrderParse =
  | { ok: true; value: NewOrderInput }
  | { ok: false; errors: NewOrderErrors };

/** Convierte cualquier entrada a texto por campo (para reponer el formulario). */
export function toValues(raw: Record<string, unknown>): NewOrderValues {
  const out = {} as NewOrderValues;
  for (const f of NEW_ORDER_FIELDS) {
    const v = raw[f];
    out[f] = typeof v === "string" ? v : "";
  }
  return out;
}

/** Valida el formulario y devuelve un error en castellano por campo. */
export function parseNewOrder(raw: Record<string, unknown>): NewOrderParse {
  const parsed = newOrderSchema.safeParse(toValues(raw));
  if (parsed.success) return { ok: true, value: parsed.data };
  const errors: NewOrderErrors = {};
  for (const issue of parsed.error.issues) {
    const campo = issue.path[0] as NewOrderField;
    if (!errors[campo]) errors[campo] = issue.message;
  }
  return { ok: false, errors };
}
