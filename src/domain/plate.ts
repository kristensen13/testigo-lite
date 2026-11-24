/**
 * Igual que normalize_plate en 0001_init.sql:
 * upper(regexp_replace(p, '[\s-]+', '', 'g')). Solo se quitan espacios en blanco
 * y guiones ASCII; otros separadores y acentos se conservan (como en la BD).
 */
export function normalizePlate(plate: string): string {
  return (plate ?? "").replace(/[\s-]+/g, "").toUpperCase();
}
