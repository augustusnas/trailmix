// Shared layout checks (N8): clipped text, sideways scrolling, broken words, spills.
import type { Page } from "@playwright/test";

/** Wait until the app's own fonts (not the fallbacks) are loaded and laid out. */
export async function fontsReady(page: Page) {
  await page.evaluate(async () => {
    const families = [getComputedStyle(document.body).fontFamily];
    const mono = document.querySelector(".mono, .wordmark, .credit");
    if (mono) families.push(getComputedStyle(mono).fontFamily);
    await Promise.all(
      families.flatMap((f) => [document.fonts.load(`800 20px ${f}`), document.fonts.load(`700 20px ${f}`)]),
    );
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

export async function layoutProblems(page: Page): Promise<string[]> {
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
      // Content that spills out of the bottom of its box (e.g. a tile too short for its text).
      if (cs.overflowY === "visible" && el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 6)
        problems.push(`spills out the bottom: ${describe(el)}`);
      // Text that runs past its own box (a word too long to wrap).
      if (el.children.length === 0 && el.textContent?.trim() && el.scrollWidth > el.clientWidth + 1 && cs.display !== "inline")
        problems.push(`text overflows: ${describe(el)}`);
    }

    // A search box hint (placeholder) too long to show in full.
    for (const input of document.querySelectorAll<HTMLInputElement>("input[placeholder]")) {
      const ph = getComputedStyle(input, "::placeholder");
      if (ph.color === "transparent" || ph.color === "rgba(0, 0, 0, 0)") continue;
      const cs = getComputedStyle(input);
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const room = input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (ctx.measureText(input.placeholder).width > room) problems.push(`search hint cut off: "${input.placeholder}"`);
    }

    // A single word split across two lines ("Indoo / r walk").
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parentEl = node.parentElement;
      if (!parentEl || parentEl.closest("[aria-hidden=true], .sr-only, script, style")) continue;
      const text = node.textContent ?? "";
      for (const m of text.matchAll(/[^\s\-–/]+/g)) {
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

