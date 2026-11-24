/** Resultado tipado: las funciones de dominio no lanzan por entrada inválida. */
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
export const err = <E = string>(error: E): { ok: false; error: E } => ({
  ok: false,
  error,
});
