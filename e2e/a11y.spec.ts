import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { SCREENS, open } from "./screens";

// N11 baseline: automated accessibility scan (contrast, labels, tap target size) on every screen.
for (const s of SCREENS) {
  test(`${s.name}: no accessibility problems`, async ({ page }) => {
    await open(page, s);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    const problems = results.violations.map(
      (v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => `${n.target.join(" ")}: ${n.failureSummary ?? ""}`).join("\n  ")}`,
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  test(`${s.name}: every tap target is at least 44×44`, async ({ page }) => {
    await open(page, s);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("a, button, input, [role=button]")]
        .filter((el) => el.offsetParent !== null && !el.closest("[aria-hidden=true]"))
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width < 44 || r.height < 44)
        .map(({ el, r }) => `${el.tagName} "${el.textContent?.trim() || el.getAttribute("aria-label")}" ${r.width}×${r.height}`),
    );
    expect(small).toEqual([]);
  });
}
