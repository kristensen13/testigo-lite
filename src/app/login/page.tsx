import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <h1 className="font-display text-3xl font-semibold uppercase">
        Entrar al taller
      </h1>
      <p className="mt-2 text-muted">
        Accede con el email y la contraseña de tu taller.
      </p>
      <LoginForm />
    </main>
  );
}
