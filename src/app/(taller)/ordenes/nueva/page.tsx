import Link from "next/link";
import { NuevaOrdenForm } from "./nueva-orden-form";

export const metadata = { title: "Nueva orden" };

export default function NuevaOrdenPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-medium underline">
        Volver al tablero
      </Link>
      <h1 className="font-display text-3xl font-semibold uppercase">Nueva orden</h1>
      <NuevaOrdenForm />
    </main>
  );
}
