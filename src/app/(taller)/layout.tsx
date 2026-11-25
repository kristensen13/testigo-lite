import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LiveUpdates } from "@/components/live-updates";
import { getWorkshopName } from "@/lib/session";

async function WorkshopName() {
  const name = await getWorkshopName();
  if (name === null) redirect("/login");
  return (
    <span data-testid="workshop-name" className="font-display text-xl font-semibold uppercase">
      {name}
    </span>
  );
}

export default function TallerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="bg-ink text-paper">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Suspense
            fallback={<span className="font-display text-xl uppercase">Cargando…</span>}
          >
            <WorkshopName />
          </Suspense>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="min-h-11 rounded-md border border-paper px-4 font-medium text-paper focus-visible:outline-paper"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>
      {children}
      {/* Una sola vez para tablero y ficha: el layout persiste al navegar entre ellas. */}
      <LiveUpdates />
    </>
  );
}
