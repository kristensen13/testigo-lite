"use client";

import { useActionState } from "react";
import { type NewOrderField } from "@/domain/new-order";
import { createOrderAction, type NewOrderState } from "./actions";

const initial: NewOrderState = {
  values: {
    customerName: "",
    customerPhone: "",
    plate: "",
    makeModel: "",
    km: "",
    complaint: "",
  },
  errors: {},
};

const campo =
  "mt-1 block min-h-12 w-full rounded-md border border-ink-soft bg-paper px-3 text-base text-ink";

export function NuevaOrdenForm() {
  const [state, formAction, pending] = useActionState(createOrderAction, initial);
  const { values, errors, formError } = state;

  function aria(name: NewOrderField) {
    return {
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
    };
  }
  function error(name: NewOrderField) {
    return errors[name] ? (
      <p id={`${name}-error`} role="alert" className="mt-1 text-sm font-medium text-rust">
        {errors[name]}
      </p>
    ) : null;
  }

  return (
    <form action={formAction} noValidate className="mt-6 space-y-5">
      {formError ? (
        <p role="alert" className="rounded-md border border-rust bg-paper px-3 py-2 font-medium text-rust">
          {formError}
        </p>
      ) : null}

      <fieldset className="min-w-0 space-y-5">
        <legend className="font-display text-xl font-semibold uppercase">Cliente</legend>
        <div>
          <label htmlFor="customerName" className="font-medium">Nombre</label>
          <input id="customerName" name="customerName" type="text" autoComplete="off"
            defaultValue={values.customerName} {...aria("customerName")} className={campo} />
          {error("customerName")}
        </div>
        <div>
          <label htmlFor="customerPhone" className="font-medium">Teléfono</label>
          <input id="customerPhone" name="customerPhone" type="tel" autoComplete="off"
            defaultValue={values.customerPhone} {...aria("customerPhone")} className={campo} />
          {error("customerPhone")}
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-5">
        <legend className="font-display text-xl font-semibold uppercase">Vehículo</legend>
        <div>
          <label htmlFor="plate" className="font-medium">Matrícula</label>
          <input id="plate" name="plate" type="text" autoComplete="off" autoCapitalize="characters"
            defaultValue={values.plate} {...aria("plate")} className={campo} />
          {error("plate")}
        </div>
        <div>
          <label htmlFor="makeModel" className="font-medium">Marca y modelo</label>
          <input id="makeModel" name="makeModel" type="text" autoComplete="off"
            defaultValue={values.makeModel} {...aria("makeModel")} className={campo} />
          {error("makeModel")}
        </div>
        <div>
          <label htmlFor="km" className="font-medium">Kilómetros</label>
          <input id="km" name="km" type="text" inputMode="numeric" autoComplete="off"
            defaultValue={values.km} {...aria("km")} className={campo} />
          {error("km")}
        </div>
      </fieldset>

      <div>
        <label htmlFor="complaint" className="font-medium">Avería que cuenta el cliente</label>
        <textarea id="complaint" name="complaint" rows={4}
          defaultValue={values.complaint} {...aria("complaint")} className={`${campo} py-2`} />
        {error("complaint")}
      </div>

      <button type="submit" disabled={pending}
        className="min-h-12 w-full rounded-md bg-ink px-4 font-display text-lg font-semibold uppercase tracking-wide text-paper disabled:opacity-70">
        {pending ? "Creando…" : "Crear orden"}
      </button>
    </form>
  );
}
