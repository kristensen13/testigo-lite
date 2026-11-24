"use client";

import { useActionState, useState } from "react";
import { KIND_LABELS, LINE_KINDS, type LineField, type LineValues } from "@/domain/order-lines";
import {
  createLineAction,
  deleteLineAction,
  updateLineAction,
  type LineState,
} from "./lineas-actions";

const campo =
  "mt-1 block min-h-11 w-full rounded-md border border-ink-soft bg-paper px-3 text-base text-ink";
const boton =
  "inline-flex min-h-11 items-center justify-center rounded-md px-4 font-medium disabled:opacity-70";

function Campos({
  prefix,
  state,
}: {
  prefix: string;
  state: LineState;
}) {
  const { values, errors } = state;
  const id = (f: LineField) => `${prefix}-${f}`;
  const aria = (f: LineField) => ({
    "aria-invalid": errors[f] ? true : undefined,
    "aria-describedby": errors[f] ? `${id(f)}-error` : undefined,
  });
  const err = (f: LineField) =>
    errors[f] ? (
      <p id={`${id(f)}-error`} role="alert" className="mt-1 text-sm font-medium text-rust">
        {errors[f]}
      </p>
    ) : null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={id("kind")} className="font-medium">Tipo</label>
        <select id={id("kind")} name="kind" defaultValue={values.kind} {...aria("kind")} className={campo}>
          {LINE_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABELS[k]}</option>
          ))}
        </select>
        {err("kind")}
      </div>
      <div>
        <label htmlFor={id("description")} className="font-medium">Descripción</label>
        <input id={id("description")} name="description" type="text" autoComplete="off"
          defaultValue={values.description} {...aria("description")} className={campo} />
        {err("description")}
      </div>
      <div>
        <label htmlFor={id("qty")} className="font-medium">Cantidad</label>
        <input id={id("qty")} name="qty" type="text" inputMode="decimal" autoComplete="off"
          defaultValue={values.qty} {...aria("qty")} className={campo} />
        {err("qty")}
      </div>
      <div>
        <label htmlFor={id("price")} className="font-medium">Precio unitario sin IVA (€)</label>
        <input id={id("price")} name="price" type="text" inputMode="decimal" autoComplete="off"
          defaultValue={values.price} {...aria("price")} className={campo} />
        {err("price")}
      </div>
    </div>
  );
}

function FormError({ state }: { state: LineState }) {
  return state.formError ? (
    <p role="alert" className="rounded-md border border-rust bg-paper px-3 py-2 font-medium text-rust">
      {state.formError}
    </p>
  ) : null;
}

export function AddLineForm({ orderId, initial }: { orderId: string; initial: LineValues }) {
  const [state, formAction, pending] = useActionState<LineState, FormData>(createLineAction, {
    values: initial,
    errors: {},
  });
  return (
    <form action={formAction} noValidate className="space-y-3" aria-label="Añadir línea">
      <input type="hidden" name="orderId" value={orderId} />
      <FormError state={state} />
      <Campos prefix="nueva" state={state} />
      <button type="submit" disabled={pending} className={`${boton} w-full bg-ink text-paper sm:w-auto`}>
        {pending ? "Añadiendo…" : "Añadir línea"}
      </button>
    </form>
  );
}

export function LineActions({
  orderId,
  lineId,
  description,
  values,
}: {
  orderId: string;
  lineId: string;
  description: string;
  values: LineValues;
}) {
  const [editing, setEditing] = useState(false);
  const [editState, editAction, editPending] = useActionState<LineState, FormData>(
    async (prev, fd) => {
      const next = await updateLineAction(prev, fd);
      if (next.done) setEditing(false);
      return next;
    },
    { values, errors: {} },
  );
  const [delState, delAction, delPending] = useActionState<LineState, FormData>(deleteLineAction, {
    values,
    errors: {},
  });

  return (
    <div className="mt-2">
      {!editing ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing(true)}
            aria-label={`Editar «${description}»`}
            className={`${boton} border border-ink bg-paper text-ink`}>
            Editar
          </button>
          <form action={delAction}>
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="lineId" value={lineId} />
            <button type="submit" disabled={delPending}
              aria-label={`Borrar «${description}»`}
              className={`${boton} border border-rust bg-paper text-rust`}>
              {delPending ? "Borrando…" : "Borrar"}
            </button>
          </form>
        </div>
      ) : (
        <form action={editAction} noValidate className="space-y-3" aria-label={`Editar línea «${description}»`}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="lineId" value={lineId} />
          <FormError state={editState} />
          <Campos prefix={`edit-${lineId}`} state={editState} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={editPending} className={`${boton} bg-ink text-paper`}>
              {editPending ? "Guardando…" : "Guardar cambios"}
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className={`${boton} border border-ink bg-paper text-ink`}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {delState.formError ? (
        <p role="alert" className="mt-2 text-sm font-medium text-rust">{delState.formError}</p>
      ) : null}
    </div>
  );
}
