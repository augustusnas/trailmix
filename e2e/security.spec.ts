import { expect, test } from "@playwright/test";
import { makeSharedMix } from "./helpers";
import { SCREENS, open } from "./screens";

for (const s of SCREENS) {
  test(`${s.name}: security headers, and no cookies but the sign-in session`, async ({ page, request }) => {
    const res = await request.get(s.path);
    const headers = res.headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["set-cookie"]).toBeUndefined();

    await open(page, s);
    // Pages never set cookies; the only one is the sign-in session (N7), set by Google sign-in.
    for (const c of await page.context().cookies()) expect(c.name).toBe("trailmix-session");
  });
}

test("the shared mix page tells search engines to skip it", async ({ page, request }) => {
  const { id } = await makeSharedMix(request);
  const res = await request.get(`/m/${id}`);
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
  await page.goto(`/m/${id}`);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
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
