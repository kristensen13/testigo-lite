"use client";

/**
 * Último recurso: error en el layout raíz. Sustituye al layout, así que define su propio
 * <html> y <body> (sin estilos globales ni fuentes) y mantiene el castellano.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "3rem 1rem" }}>
        <main style={{ maxWidth: "28rem", margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.5rem" }}>Algo ha ido mal</h1>
          <p role="alert" style={{ color: "#444" }}>
            No hemos podido cargar la aplicación. Inténtalo de nuevo.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ minHeight: "3rem", padding: "0 1rem", fontSize: "1rem", cursor: "pointer" }}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
