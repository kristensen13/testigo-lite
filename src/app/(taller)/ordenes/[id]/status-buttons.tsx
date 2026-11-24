"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { StatusButton } from "@/domain/order-detail";
import { changeStatusAction, type ChangeStatusState } from "./actions";

function Buttons({ buttons }: { buttons: StatusButton[] }) {
  const { pending, data } = useFormStatus();
  const sending = pending ? String(data?.get("to") ?? "") : null;
  return (
    <div className="flex flex-wrap gap-2">
      {buttons.map((b) => (
        <button
          key={b.to}
          type="submit"
          name="to"
          value={b.to}
          disabled={pending}
          aria-label={b.label}
          className="min-h-11 rounded-md bg-ink px-4 font-display text-lg font-semibold uppercase text-paper disabled:opacity-70"
        >
          {sending === b.to ? "Cambiando…" : b.label}
        </button>
      ))}
    </div>
  );
}

export function StatusButtons({ orderId, buttons }: { orderId: string; buttons: StatusButton[] }) {
  const [state, formAction] = useActionState<ChangeStatusState, FormData>(changeStatusAction, {});
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={orderId} />
      <Buttons buttons={buttons} />
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-rust">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
