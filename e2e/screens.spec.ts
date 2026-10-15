import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { SCREENS } from "./screens";

// N8: screenshots of every screen at 320, 390 and 430 wide, plus large iOS text,
// with automatic checks for clipped text and sideways scrolling.
const WIDTHS = [320, 390, 430];
const LARGE_TEXT_PX = 23; // the biggest standard iPhone text size (default is 17)
const OUT = "screenshots";

async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const root = document.documentElement;
    const vw = root.clientWidth;
    if (root.scrollWidth > vw) problems.push(`page scrolls sideways (${root.scrollWidth}px content in ${vw}px)`);

    const inSideScroller = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === "auto" || o === "scroll") return true;
      }
      return false;
    };
    const describe = (el: Element) =>
      `<${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}"> "${(el.textContent ?? "").trim().slice(0, 40)}"`;

    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      if (el.closest("[aria-hidden=true], .sr-only, svg")) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if ((r.right > vw + 1 || r.left < -1) && !inSideScroller(el)) problems.push(`off-screen: ${describe(el)}`);
      if (["hidden", "clip"].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1)
        problems.push(`clipped sideways: ${describe(el)}`);
      if (["hidden", "clip"].includes(cs.overflowY) && el.scrollHeight > el.clientHeight + 1)
        problems.push(`clipped top/bottom: ${describe(el)}`);
      // Sticks out of its parent's box (e.g. a label wider than its tile).
      const parent = el.parentElement;
      if (parent && cs.position !== "absolute" && cs.position !== "fixed" && !inSideScroller(el)) {
        const pr = parent.getBoundingClientRect();
        if (r.right > pr.right + 1 || r.left < pr.left - 1) problems.push(`sticks out of its box: ${describe(el)}`);
      }
      // Text that runs past its own box (a word too long to wrap).
      if (el.children.length === 0 && el.textContent?.trim() && el.scrollWidth > el.clientWidth + 1 && cs.display !== "inline")
        problems.push(`text overflows: ${describe(el)}`);
    }

    // A single word split across two lines ("Indoo / r walk").
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parentEl = node.parentElement;
      if (!parentEl || parentEl.closest("[aria-hidden=true], .sr-only, script, style")) continue;
      const text = node.textContent ?? "";
      for (const m of text.matchAll(/[^\s\-–]+/g)) {
        const range = document.createRange();
        range.setStart(node, m.index!);
        range.setEnd(node, m.index! + m[0].length);
        const tops = new Set([...range.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top)));
        if (tops.size > 1) problems.push(`word broken across lines: "${m[0]}" in ${describe(parentEl)}`);
      }
    }
    return problems;
  });
}

for (const width of WIDTHS) {
  for (const s of SCREENS) {
    test(`${s.name} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(s.path);
      await page.evaluate(() => document.fonts.ready);
      expect(await layoutProblems(page)).toEqual([]);
      const file = `${width}/${s.name}.png`;
      mkdirSync(`${OUT}/${width}`, { recursive: true });
      await page.screenshot({ path: `${OUT}/${file}`, fullPage: true, scale: "css" });
    });
  }
}

for (const width of [320, 390]) {
  for (const s of SCREENS) {
    test(`${s.name} at ${width}px with large text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(s.path);
      await page.addStyleTag({ content: `html { font-size: ${LARGE_TEXT_PX}px !important; }` });
      await page.evaluate(() => document.fonts.ready);
      expect(await layoutProblems(page)).toEqual([]);
      const file = `large-text-${width}/${s.name}.png`;
      mkdirSync(`${OUT}/large-text-${width}`, { recursive: true });
      await page.screenshot({ path: `${OUT}/${file}`, fullPage: true, scale: "css" });
    });
  }
}

test.afterAll(() => {
  // A simple page that lays the screenshots out side by side on GitHub.
  const cols = ["320", "390", "430", "large-text-320", "large-text-390"];
  const lines = [
    "# Screenshots (N8)",
    "",
    "Every screen at 320, 390 and 430px wide, plus the biggest standard iPhone text size. Regenerate with `npm run screenshots`.",
    "",
    `| Screen | ${cols.join(" | ")} |`,
    `| --- | ${cols.map(() => "---").join(" | ")} |`,
    ...SCREENS.map((s) => `| ${s.name} | ${cols.map((c) => `<img src="${c}/${s.name}.png" width="160">`).join(" | ")} |`),
    "",
  ];
  writeFileSync(`${OUT}/README.md`, lines.join("\n"));
});
