import type { DecisionView, PortalStep, PortalView } from "@/domain/portal";

const SHELL = "mx-auto w-full max-w-[42rem]";

/** Página genérica: idéntica para token inválido, caducado o revocado. */
export function PortalUnavailable() {
  return (
    <main className={`${SHELL} flex-1 px-4 py-10`}>
      <div className="rounded-md bg-ink px-5 py-8 text-paper">
        <h1 className="font-display text-3xl font-semibold uppercase leading-tight">
          Este enlace ya no está disponible
        </h1>
        <p className="mt-3 text-base text-line">
          Pide al taller que te envíe uno nuevo.
        </p>
      </div>
      <PortalFooter />
    </main>
  );
}

export function PortalFooter() {
  return (
    <footer className="py-6 text-center text-base text-muted">
      con <span className="font-display font-semibold uppercase">Testigo</span>
    </footer>
  );
}

function StepIcon({ state }: { state: PortalStep["state"] }) {
  // Forma distinta por estado: relleno con marca (hecho), anillo grueso con
  // punto (actual) y contorno discontinuo vacío (pendiente).
  if (state === "hecho") {
    return (
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-base font-bold text-paper"
      >
        ✓
      </span>
    );
  }
  if (state === "actual") {
    return (
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-ink bg-paper"
      >
        <span className="h-3 w-3 rounded-full bg-ink" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="h-8 w-8 shrink-0 rounded-full border-2 border-dashed border-muted bg-paper"
    />
  );
}

const STEP_TEXT: Record<PortalStep["state"], string> = {
  hecho: "Hecho",
  actual: "Ahora",
  pendiente: "Pendiente",
};

function Progress({ steps }: { steps: PortalStep[] }) {
  return (
    <section aria-labelledby="progreso" className="mt-4 rounded-md bg-paper p-4">
      <h2 id="progreso" className="font-display text-xl font-semibold uppercase">
        Progreso
      </h2>
      <ol className="mt-3 space-y-3" data-testid="portal-progreso">
        {steps.map((s) => (
          <li
            key={s.status}
            data-state={s.state}
            aria-current={s.state === "actual" ? "step" : undefined}
            className="flex min-h-8 items-center gap-3"
          >
            <StepIcon state={s.state} />
            <span className={s.state === "actual" ? "font-bold" : undefined}>{s.label}</span>
            <span className="ml-auto text-base text-muted">{STEP_TEXT[s.state]}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DecisionBadge({ decision }: { decision: DecisionView }) {
  const base =
    "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-base font-semibold";
  const style =
    decision.decision === "aprobada"
      ? "bg-ink text-paper"
      : decision.decision === "rechazada"
        ? "border-2 border-ink bg-paper text-ink"
        : "border-2 border-dashed border-muted bg-paper text-ink";
  const icon = decision.decision === "aprobada" ? "✓" : decision.decision === "rechazada" ? "✕" : "○";
  return (
    <p className="mt-2" data-testid="portal-decision">
      <span className={`${base} ${style}`}>
        <span aria-hidden="true">{icon}</span>
        {decision.label}
      </span>
      {decision.decidedAt ? (
        <span className="ml-2 text-base text-muted">el {decision.decidedAt}</span>
      ) : null}
    </p>
  );
}

function Lines({ view }: { view: PortalView }) {
  return (
    <section aria-labelledby="trabajos" className="mt-4 rounded-md bg-paper p-4">
      <h2 id="trabajos" className="font-display text-xl font-semibold uppercase">
        Trabajos
      </h2>
      {view.lines.length === 0 ? (
        <p className="mt-3 text-base text-muted">Todavía no hay trabajos en el presupuesto.</p>
      ) : (
        <>
          <p className="mt-1 text-base text-muted">Los precios de cada trabajo van sin IVA.</p>
          <ul className="mt-3 divide-y divide-line">
            {view.lines.map((l) => (
              <li key={l.id} data-testid="portal-linea" className="py-3 first:pt-0 last:pb-0">
                <p className="font-semibold">{l.description}</p>
                <p className="text-base text-muted">{l.kindLabel}</p>
                <p className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 text-base">
                  <span className="tabular">
                    {l.qtyText} × {l.unitPrice}
                  </span>
                  <span className="tabular font-display text-xl font-semibold">{l.lineTotal}</span>
                </p>
                <DecisionBadge decision={l.decision} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Totals({ view }: { view: PortalView }) {
  const row = "flex items-baseline justify-between gap-3";
  return (
    <section aria-labelledby="totales" className="mt-4 rounded-md bg-paper p-4">
      <h2 id="totales" className="font-display text-xl font-semibold uppercase">
        Totales
      </h2>
      <dl className="mt-3 space-y-2">
        <div className={row}>
          <dt className="text-muted">Base del presupuesto</dt>
          <dd className="tabular" data-testid="portal-total-base">{view.totals.base}</dd>
        </div>
        <div className={row}>
          <dt className="text-muted">IVA ({view.vatPercentText})</dt>
          <dd className="tabular" data-testid="portal-total-iva">{view.totals.vat}</dd>
        </div>
        <div className={`${row} border-t border-line pt-2`}>
          <dt className="font-semibold">Total del presupuesto (con IVA)</dt>
          <dd className="tabular font-display text-2xl font-semibold" data-testid="portal-total">
            {view.totals.total}
          </dd>
        </div>
        <div className={`${row} border-t border-line pt-2`}>
          <dt className="font-semibold">Total aprobado (con IVA)</dt>
          <dd className="tabular font-display text-2xl font-semibold" data-testid="portal-total-aprobado">
            {view.totals.approvedTotal}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function PortalView({ view }: { view: PortalView }) {
  return (
    <main className={`${SHELL} flex-1 px-4 py-4`}>
      <section aria-labelledby="titulo-estado" className="rounded-md bg-ink px-5 py-6 text-paper">
        <p className="text-base text-line">{view.workshopName}</p>
        <h1 id="titulo-estado" className="sr-only">
          Estado de tu coche
        </h1>
        <p className="mt-2 font-display text-4xl font-semibold uppercase leading-none tabular" data-testid="portal-matricula">
          {view.plate}
        </p>
        <p className="mt-1 text-base text-line" data-testid="portal-vehiculo">
          {view.makeModel}
        </p>
        <p
          data-testid="portal-estado"
          className={`mt-4 inline-block rounded-sm px-3 py-1 font-display text-3xl font-semibold uppercase leading-tight ${
            view.needsAttention ? "bg-accent text-ink" : "border-2 border-paper text-paper"
          }`}
        >
          {view.statusLabel}
        </p>
        {view.needsAttention ? (
          <p className="mt-2 text-base font-semibold">Requiere tu atención</p>
        ) : null}
      </section>

      <Progress steps={view.steps} />
      <Lines view={view} />
      <Totals view={view} />

      <section aria-labelledby="taller" className="mt-4 rounded-md bg-paper p-4">
        <h2 id="taller" className="font-display text-xl font-semibold uppercase">
          Tu taller
        </h2>
        <p className="mt-2 font-semibold" data-testid="portal-taller">{view.workshopName}</p>
        {view.telHref ? (
          <a
            href={view.telHref}
            className="mt-3 flex min-h-12 items-center justify-center rounded-md bg-ink px-4 font-display text-lg font-semibold uppercase text-paper"
          >
            <span>
              Llamar al taller<span className="tabular"> · {view.workshopPhone}</span>
            </span>
          </a>
        ) : (
          <p className="mt-2 tabular">{view.workshopPhone}</p>
        )}
      </section>

      <p className="mt-4 text-center text-base text-muted" data-testid="portal-caducidad">
        Este enlace es válido hasta el {view.expiresAt}.
      </p>
      <PortalFooter />
    </main>
  );
}
