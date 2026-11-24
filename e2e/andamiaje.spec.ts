import { expect, test } from "@playwright/test";

test("sin sesión, / redirige a /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("/p/x lleva las cabeceras de privacidad", async ({ request }) => {
  const res = await request.get("/p/x");
  const headers = res.headers();
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["x-robots-tag"]).toContain("noindex");
  expect(headers["cache-control"]).toContain("no-store");
});
