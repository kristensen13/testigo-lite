import { Suspense } from "react";
import type { Metadata } from "next";
import { PortalUnavailable, PortalView } from "@/components/portal-view";
import { fetchPortal } from "@/lib/portal";

// Título y robots idénticos con cualquier token: nada delata si existe.
export const metadata: Metadata = {
  title: "Estado de tu coche",
  robots: { index: false, follow: false },
};

async function Portal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await fetchPortal(token);
  return view ? <PortalView view={view} /> : <PortalUnavailable />;
}

export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<Cargando />}>
      <Portal params={params} />
    </Suspense>
  );
}

function Cargando() {
  return (
    <main className="mx-auto w-full max-w-[42rem] flex-1 px-4 py-4" aria-busy="true">
      <p role="status" className="rounded-md bg-ink px-5 py-6 text-base text-paper">
        Cargando el estado de tu coche…
      </p>
    </main>
  );
}
