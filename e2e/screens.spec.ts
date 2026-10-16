import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { fontsReady, layoutProblems } from "./layout";
import { SCREENS, open } from "./screens";

// N8: screenshots of every screen at 320, 390 and 430 wide, plus large iOS text,
// with automatic checks for clipped text and sideways scrolling.
const WIDTHS = [320, 390, 430];
const OUT = "screenshots";

for (const width of WIDTHS) {
  for (const s of SCREENS) {
    test(`${s.name} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await open(page, s);
      await fontsReady(page);
      mkdirSync(`${OUT}/${width}`, { recursive: true });
      await page.screenshot({ path: `${OUT}/${width}/${s.name}.png`, fullPage: true, scale: "css" });
      expect(await layoutProblems(page)).toEqual([]);
    });
  }
}

// Bigger iPhone text sizes (Settings > Accessibility > Display & Text Size > Larger Text).
// iOS body text is 17px by default; 23px is the biggest standard size and 53px the biggest accessibility size.
const TEXT_SIZES = [
  { folder: "large-text", px: 23, widths: [320, 390] },
  { folder: "largest-text", px: 53, widths: [320, 390, 430] },
];

for (const size of TEXT_SIZES) {
  for (const width of size.widths) {
    for (const s of SCREENS) {
      test(`${s.name} at ${width}px with ${size.folder} (${size.px}px)`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await open(page, s);
        await page.addStyleTag({ content: `html { font-size: ${size.px}px !important; }` });
        await fontsReady(page);
        const dir = `${OUT}/${size.folder}-${width}`;
        mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: `${dir}/${s.name}.png`, fullPage: true, scale: "css" });
        expect(await layoutProblems(page)).toEqual([]);
      });
    }
  }
}

test.afterAll(() => {
  // A simple page that lays the screenshots out side by side on GitHub.
  const cols = [
    ...WIDTHS.map(String),
    ...TEXT_SIZES.flatMap((t) => t.widths.map((w) => `${t.folder}-${w}`)),
  ];
  const lines = [
    "# Screenshots (N8)",
    "",
    "Every screen at 320, 390 and 430px wide, then at the biggest standard iPhone text size (23px) and the biggest accessibility text size (53px). Regenerate with `npm run screenshots`.",
    "",
    `| Screen | ${cols.join(" | ")} |`,
    `| --- | ${cols.map(() => "---").join(" | ")} |`,
    ...SCREENS.map((s) => `| ${s.name} | ${cols.map((c) => `<img src="${c}/${s.name}.png" width="160">`).join(" | ")} |`),
    "",
  ];
  writeFileSync(`${OUT}/README.md`, lines.join("\n"));
});
