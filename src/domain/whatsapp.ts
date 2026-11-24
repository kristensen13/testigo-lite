import { err, ok, type Result } from "./result";

/** Devuelve el teléfono en formato internacional sin "+" (p. ej. "34600111222"). */
export function normalizePhone(raw: string): Result<string> {
  let s = (raw ?? "").trim();
  if (s === "") return err("Introduce un teléfono");
  if (!/^[+\d\s\-().]+$/.test(s)) return err("El teléfono contiene caracteres no válidos");
  const hadPlus = s.startsWith("+");
  s = s.replace(/[^\d]/g, "");
  let international = hadPlus;
  if (!hadPlus && s.startsWith("00")) {
    s = s.slice(2);
    international = true;
  } else if (hadPlus && s.startsWith("00")) return err("Teléfono no válido");
  // Sin prefijo internacional solo se admiten números españoles de 9 dígitos.
  if (!international && !/^\d{9}$/.test(s)) return err("Teléfono no válido (9 dígitos)");
  if (/^\d{9}$/.test(s) && !international) s = `34${s}`;
  if (!/^[1-9]\d{7,14}$/.test(s)) return err("Teléfono no válido");
  if (s.startsWith("34") && s.length !== 11) return err("Teléfono español no válido (9 dígitos)");
  return ok(s);
}

export function whatsappUrl(phone: string, text: string): Result<string> {
  const p = normalizePhone(phone);
  if (!p.ok) return p;
  return ok(`https://wa.me/${p.value}?text=${encodeURIComponent(text)}`);
}
