import { expect, test } from "@playwright/test";

const SIN_SESION = { cookies: [], origins: [] };

test.describe("sin sesión", () => {
  test.use({ storageState: SIN_SESION });

  test("criterio 2: cualquier ruta del taller redirige a /login", async ({ page }) => {
    for (const ruta of ["/", "/ordenes/nueva", "/ordenes/123"]) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("criterio 1: credenciales incorrectas no pierden el email", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nadie@ejemplo.es");
    await page.getByLabel("Contraseña").fill("contraseña-mala-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator("form [role=alert]")).toHaveText("Email o contraseña incorrectos", { timeout: 20_000 });
    await expect(page.getByLabel("Email")).toHaveValue("nadie@ejemplo.es");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("criterio 4: email mal formado muestra error junto al campo", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("esto-no-es-un-email");
    await page.getByLabel("Contraseña").fill("lo-que-sea");
    await page.getByRole("button", { name: "Entrar" }).click();
    const error = page.locator("#email-error");
    await expect(error).toContainText("email válido");
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-describedby", "email-error");
    await expect(page.getByLabel("Email")).toHaveValue("esto-no-es-un-email");
  });

  test("criterio 5: usable a 360 px y solo con teclado", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/login");

    const sinScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(sinScroll).toBe(true);

    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email")).toBeFocused();
    const outline = await page
      .getByLabel("Email")
      .evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
    await page.keyboard.type("nadie@ejemplo.es");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Contraseña")).toBeFocused();
    await page.keyboard.type("contraseña-mala-123");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("form [role=alert]")).toHaveText("Email o contraseña incorrectos", { timeout: 20_000 });
  });
});

test.describe("con sesión", () => {
  test("criterio 1: la sesión guardada lleva al tablero con el nombre del taller", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Tablero" })).toBeVisible();
    await expect(page.getByTestId("workshop-name")).not.toBeEmpty({ timeout: 20_000 });
  });
});

test.describe("login y logout reales", () => {
  test.use({ storageState: SIN_SESION });

  test("criterios 1 y 3: entrar, cerrar sesión y volver atrás no muestra datos", async ({ page }) => {
    const email = process.env.E2E_EMAIL ?? "";
    const password = process.env.E2E_PASSWORD ?? "";
    expect(email).not.toBe("");

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByTestId("workshop-name")).not.toBeEmpty({ timeout: 20_000 });

    // La pantalla del taller no se cachea.
    const res = await page.request.get("/");
    expect(res.headers()["cache-control"]).toContain("no-store");

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId("workshop-name")).toHaveCount(0);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId("workshop-name")).toHaveCount(0);
  });
});
