import { expect, test } from "@playwright/test";

test.describe("SnipLink Dev — Smoke E2E", () => {
  test("shortens a URL without login, renders /demo and /dashboard, and serves /api/health and /api/docs with zero console errors", async ({
    page,
    request,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(
      page.getByRole("heading", {
        name: /Shorten, track & expire links in seconds/i,
      }),
    ).toBeVisible();

    const uniqueUrl = `https://example.com/sniplink-e2e-${Date.now()}`;
    await page.locator("#target-url").fill(uniqueUrl);
    await page.getByRole("button", { name: /Shorten URL/i }).click();

    await expect(
      page.getByRole("button", { name: /Copy Short URL/i }),
    ).toBeVisible();

    await page.goto("/demo");
    await expect(
      page.getByRole("heading", { name: /SnipLink Dev — Interactive Demo/i }),
    ).toBeVisible();

    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /Analytics Dashboard/i }),
    ).toBeVisible();
    await expect(page.getByText("/nextjs-15").first()).toBeVisible();

    const healthRes = await request.get("/api/health");
    expect(healthRes.status()).toBe(200);
    const healthJson = (await healthRes.json()) as {
      status: string;
      service: string;
      dbLatencyMs: number;
    };
    expect(healthJson.status).toBe("ok");
    expect(healthJson.service).toBe("sniplink-dev");
    expect(healthJson.dbLatencyMs).toBeGreaterThanOrEqual(0);

    const docsRes = await request.get("/api/docs");
    expect(docsRes.status()).toBe(200);
    const docsHtml = await docsRes.text();
    expect(docsHtml).toContain("SnipLink Dev API");
    expect(docsHtml).toContain("OpenAPI 3.1.0");

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
