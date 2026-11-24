"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = { email: "", errors: {} };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);
  const { errors, formError } = state;

  const campo =
    "mt-1 block min-h-12 w-full rounded-md border border-ink-soft bg-paper px-3 text-base text-ink";

  return (
    <form action={formAction} noValidate className="mt-6 space-y-5">
      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-rust bg-paper px-3 py-2 font-medium text-rust"
        >
          {formError}
        </p>
      ) : null}

      <div>
        <label htmlFor="email" className="font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state.email}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={campo}
        />
        {errors.email ? (
          <p id="email-error" role="alert" className="mt-1 text-sm font-medium text-rust">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="password" className="font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "password-error" : undefined}
          className={campo}
        />
        {errors.password ? (
          <p id="password-error" role="alert" className="mt-1 text-sm font-medium text-rust">
            {errors.password}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-md bg-ink px-4 font-display text-lg font-semibold uppercase tracking-wide text-paper disabled:opacity-70"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
