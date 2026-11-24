import { expect, test as setup } from "@playwright/test";

const archivo = "e2e/.auth/user.json";

setup("iniciar sesión una vez y guardar la sesión", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  expect(email, "Falta E2E_EMAIL").toBeTruthy();
  expect(password, "Falta E2E_PASSWORD").toBeTruthy();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Contraseña").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByTestId("workshop-name")).toBeVisible({ timeout: 30_000 });
  await page.context().storageState({ path: archivo });
});
