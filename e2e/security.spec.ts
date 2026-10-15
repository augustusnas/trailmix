import { expect, test } from "@playwright/test";
import { SCREENS } from "./screens";

for (const s of SCREENS) {
  test(`${s.name}: security headers and no cookies`, async ({ page, request }) => {
    const res = await request.get(s.path);
    const headers = res.headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["set-cookie"]).toBeUndefined();

    await page.goto(s.path);
    expect(await page.context().cookies()).toEqual([]);
  });
}

test("the shared mix page tells search engines to skip it", async ({ page, request }) => {
  const res = await request.get("/m/demo");
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
  await page.goto("/m/demo");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("installable: manifest and iPhone tags", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({
    name: "Trailmix",
    short_name: "Trailmix",
    display: "standalone",
    orientation: "portrait",
    background_color: "#16130F",
    theme_color: "#16130F",
  });
  for (const icon of manifest.icons) {
    const r = await request.get(icon.src);
    expect(r.status(), icon.src).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/png");
  }
  expect((await request.get("/apple-touch-icon.png")).status()).toBe(200);

  await page.goto("/home");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
  await expect(page.locator('link[rel="apple-touch-icon"][sizes="180x180"]')).toHaveCount(1);
});
