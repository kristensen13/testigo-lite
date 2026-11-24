const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

/** Formatea céntimos enteros como euros en es-ES (p. ej. 8894 -> "88,94 €"). */
export function formatEuros(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new RangeError("El importe debe ser un número entero de céntimos");
  }
  return eur.format(cents / 100);
}

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

const dateTimeFmt = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

export function formatDate(value: Date | string): string {
  return dateFmt.format(new Date(value));
}

export function formatDateTime(value: Date | string): string {
  return dateTimeFmt.format(new Date(value));
}
