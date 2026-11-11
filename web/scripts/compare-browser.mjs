import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
const base = process.env.TEST_URL || "http://127.0.0.1:4186/vorthos";
const b = await chromium.launch({
  executablePath: "/usr/bin/brave-browser",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  for (const width of [1440, 390]) {
    const p = await b.newPage({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
    });
    await p.goto(base + "/", { waitUntil: "networkidle" });
    await p.waitForSelector('[data-full="true"]');
    async function snap(name) {
      await p.waitForFunction(() =>
        [...document.images]
          .filter((i) => {
            const r = i.getBoundingClientRect();
            return (
              r.top < innerHeight &&
              r.bottom > 0 &&
              r.right > 0 &&
              r.left < innerWidth
            );
          })
          .every(
            (i) =>
              i.complete && i.naturalWidth && i.classList.contains("decoded"),
          ),
      );
      await p.waitForTimeout(300);
      await p.mouse.move(1, 1);
      await p.screenshot({
        path: `screenshots/compare/vorthos-${name}-${width}.png`,
      });
    }
    await snap("home");
    await p.locator(".browse-button").click();
    await p.waitForTimeout(900);
    await snap("collection");
    await p.locator(".art-tile").first().click();
    await p.waitForSelector(".art-dialog[open] .decoded");
    await snap("detail");
    await p.keyboard.press("Escape");
    await p.goto(base + "/moods/", { waitUntil: "networkidle" });
    await p.waitForSelector(".venn-region");
    await p.waitForTimeout(300);
    await snap("moods");
    await p.goto(base + "/artists/", { waitUntil: "networkidle" });
    await p.waitForSelector(".artist-entry");
    await snap("artists");
    console.log({
      width,
      overflow: await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    });
    await p.close();
  }
  for (const width of [1440, 390]) {
    for (const view of ["home", "collection", "detail"]) {
      const pair = await b.newPage({
        viewport: {
          width: width * 2,
          height: (width === 1440 ? 1000 : 844) + 28,
        },
        deviceScaleFactor: 1,
      });
      const pictures = await Promise.all(
        ["reference", "vorthos"].map(
          async (owner) =>
            `data:image/png;base64,${(await readFile(`screenshots/compare/${owner}-${view}-${width}.png`)).toString("base64")}`,
        ),
      );
      await pair.setContent(
        `<html><body style="margin:0;background:white;font:12px Arial;display:grid;grid-template-columns:1fr 1fr"><div style="height:28px;display:flex;align-items:center;padding-left:12px">Reference · ${width}px · ${view}</div><div style="height:28px;display:flex;align-items:center;padding-left:12px">Vorthos · ${width}px · ${view}</div>${pictures.map((src) => `<img src="${src}" style="width:${width}px;display:block"/>`).join("")}</body></html>`,
      );
      await pair.screenshot({
        path: `screenshots/compare/pair-${view}-${width}.png`,
      });
      await pair.close();
    }
  }
} finally {
  await b.close();
}
