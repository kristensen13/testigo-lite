"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  NOTICE_TTL_MS,
  REFRESH_DEBOUNCE_MS,
  dismissNotice,
  interpretChange,
  pushNotice,
  type LiveNotice,
} from "@/domain/live-updates";
import { createClient } from "@/lib/supabase/browser";

/**
 * Avisos en vivo para el taller (Supabase Realtime).
 *
 * Escucha, con la sesión del usuario (las políticas select por taller filtran
 * lo que llega; aquí no se filtra por taller):
 *  - order_events INSERT, de los que solo cuenta type = 'decision' (se filtra
 *    en interpretChange; el filtro de servidor no es posible, ver abajo), y
 *  - order_lines UPDATE (una fila con decisión distinta de 'pendiente' solo
 *    puede venir de una decisión del cliente; trae el nombre del trabajo).
 * Los eventos enlace_creado / enlace_revocado no llegan ni se interpretan.
 *
 * Si el canal falla, la app sigue funcionando sin avisos.
 */
export function LiveUpdates() {
  const router = useRouter();
  const [notices, setNotices] = useState<LiveNotice[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback((id: string) => {
    setNotices((current) => dismissNotice(current, id));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const pendingTimers = timers.current;

    function scheduleRefresh() {
      if (refreshTimer.current !== null) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    }

    function handle(table: string, eventType: string, row: unknown) {
      const change = interpretChange(table, eventType, row);
      if (change.refresh) scheduleRefresh();
      if (change.notice) {
        const id = `aviso-${++seq.current}`;
        const notice: LiveNotice = { id, ...change.notice };
        setNotices((current) => pushNotice(current, notice));
        const timer = setTimeout(() => {
          pendingTimers.delete(timer);
          close(id);
        }, NOTICE_TTL_MS);
        pendingTimers.add(timer);
      }
    }

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function start() {
      // Realtime debe unirse con el JWT de la sesión (si se une antes de resolverlo,
      // lo hace con la clave anónima y RLS descarta todos los cambios con un 401).
      // setAuth() sin argumentos lee el token de la sesión y supabase-js lo mantiene
      // al día al refrescarse la sesión.
      await supabase.realtime.setAuth();
      if (cancelled) return;

      // Un canal por montaje, con nombre único: ni choques ni canales huérfanos
      // si React monta y desmonta dos veces en desarrollo.
      channel = supabase
        .channel(`taller-en-vivo-${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          // Sin filtro de servidor: Realtime solo admite filtrar por columnas con SELECT
          // para el rol anon (aquí revocado), y si no, rechaza toda la suscripción.
          // El tipo se filtra en cliente con interpretChange (solo 'decision').
          { event: "INSERT", schema: "public", table: "order_events" },
          (payload) => handle(payload.table, payload.eventType, payload.new),
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "order_lines" },
          (payload) => handle(payload.table, payload.eventType, payload.new),
        )
        .subscribe((status) => {
          if (
            process.env.NODE_ENV !== "production" &&
            (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          ) {
            console.warn(`[en vivo] canal no disponible (${status}); la app sigue sin avisos`);
          }
        });
    }

    start().catch(() => {
      // Sin Realtime la app sigue funcionando, solo sin avisos.
    });

    return () => {
      cancelled = true;
      if (refreshTimer.current !== null) clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
      pendingTimers.forEach(clearTimeout);
      pendingTimers.clear();
      if (channel !== null) void supabase.removeChannel(channel);
    };
  }, [router, close]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      data-testid="avisos-en-vivo"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
    >
      {notices.map((notice) => (
        <div
          key={notice.id}
          data-testid="aviso-en-vivo"
          className="pointer-events-auto flex w-full items-center justify-between gap-2 rounded-md border-2 border-paper bg-ink py-1 pl-4 pr-1 text-paper shadow-lg"
        >
          <p className="py-2 font-medium">{notice.text}</p>
          <button
            type="button"
            onClick={() => close(notice.id)}
            aria-label="Cerrar aviso"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-xl text-paper focus-visible:outline-paper"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>
  );
}
