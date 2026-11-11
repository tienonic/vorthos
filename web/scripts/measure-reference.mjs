import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: "/usr/bin/brave-browser",
  headless: true,
  args: ["--no-sandbox"],
});
const measurements = {
  source: "https://ciggies.app",
  checked: new Date().toISOString(),
  viewports: {},
};
const props = [
  "display",
  "position",
  "color",
  "backgroundColor",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "width",
  "height",
  "maxWidth",
  "minHeight",
  "padding",
  "margin",
  "gap",
  "rowGap",
  "columnGap",
  "gridTemplateColumns",
  "gridAutoRows",
  "aspectRatio",
  "border",
  "borderRadius",
  "boxShadow",
  "opacity",
  "objectFit",
  "transform",
  "transitionProperty",
  "transitionDuration",
  "transitionTimingFunction",
  "overflow",
  "zIndex",
  "textAlign",
];
for (const width of [1440, 390]) {
  const page = await browser.newPage({
    viewport: { width, height: width === 1440 ? 1000 : 844 },
    deviceScaleFactor: 1,
  });
  const capture = async (label) => {
    measurements.viewports[width][label] = await page.evaluate((props) => {
      const used = new Set();
      const out = [];
      const add = (e) => {
        if (!e || used.has(e)) return;
        used.add(e);
        const c = getComputedStyle(e),
          r = e.getBoundingClientRect();
        out.push({
          tag: e.tagName,
          cls: typeof e.className === "string" ? e.className : "svg",
          text:
            e.children.length === 0 ? e.textContent?.slice(0, 80) : undefined,
          href: e.getAttribute("href"),
          rect: { x: r.x, y: r.y, width: r.width, height: r.height },
          style: Object.fromEntries(props.map((p) => [p, c[p]])),
        });
      };
      add(document.body);
      add(document.querySelector("main"));
      document.querySelectorAll("nav").forEach((e) => {
        add(e);
        add(e.firstElementChild);
        [...e.querySelectorAll("a,button,span,svg")].slice(0, 15).forEach(add);
      });
      const hero = document.querySelector("section");
      if (location.pathname === "/") {
        add(hero);
        const h = [...document.querySelectorAll("h1")].find(
          (e) => e.getBoundingClientRect().width > 0,
        );
        for (let e = h; e && e !== hero; e = e.parentElement) {
          add(e);
          [...e.children].forEach(add);
        }
        const img = hero?.querySelector("img");
        [...(hero?.querySelectorAll("button,a") || [])]
          .filter((e) => e.getBoundingClientRect().width > 0)
          .forEach(add);
        for (let e = img; e && e !== hero; e = e.parentElement) {
          add(e);
          [...e.children].slice(0, 2).forEach(add);
        }
        document.querySelectorAll(".sku-card").forEach((e, i) => {
          if (i === 0) {
            add(e.parentElement);
            add(e);
            [...e.querySelectorAll("*")].forEach(add);
          }
        });
        const grid =
          document.querySelector("#collection") ||
          document.querySelector("main");
        add(grid);
        if (grid) {
          [...grid.querySelectorAll("*")]
            .filter(
              (e) =>
                e.getBoundingClientRect().width > 0 && !e.closest("section"),
            )
            .slice(0, 100)
            .forEach(add);
        }
      } else {
        [...document.querySelectorAll("body *")]
          .filter(
            (e) =>
              e.getBoundingClientRect().width > 0 &&
              !e.closest("nav,script,style"),
          )
          .slice(0, 210)
          .forEach(add);
      }
      return out;
    }, props);
  };
  measurements.viewports[width] = {};
  await page.goto("https://ciggies.app/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await capture("home");
  await page.screenshot({
    path: `screenshots/compare/reference-home-${width}.png`,
  });
  console.log(
    width,
    await page.evaluate(() => ({
      h1: document.querySelector("h1")?.outerHTML,
      sections: [...document.querySelectorAll("main>div,main>section")].map(
        (e) => ({ tag: e.tagName, id: e.id, cls: e.className }),
      ),
      sku: document.querySelector('a[href^="/sku/"]')?.getAttribute("href"),
    })),
  );
  const sku = await page
    .locator('a[href^="/sku/"]')
    .first()
    .getAttribute("href");
  measurements.sku = sku;
  const browse = page.locator('a[href="#collection"]:visible').first();
  await browse.click();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `screenshots/compare/reference-collection-${width}.png`,
  });
  await capture("collection");
  await writeFile(
    "docs-measurements.json",
    JSON.stringify(measurements, null, 2),
  );
  // Hover the actual visible product and navigation to record computed changes.
  const product = page.locator('a[href^="/sku/"]').first();
  await product.hover();
  measurements.viewports[width].hover = await product.evaluate((e) => ({
    self: getComputedStyle(e).transform,
    img: getComputedStyle(e.querySelector("img")).transform,
    transition: getComputedStyle(e.querySelector("img")).transition,
  }));
  for (const [label, path] of [
    ["detail", sku],
    ["discover", "/discover"],
    ["brands", "/brands"],
  ]) {
    await page.goto("https://ciggies.app" + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    await capture(label);
    await page.screenshot({
      path: `screenshots/compare/reference-${label}-${width}.png`,
    });
  }
  await writeFile(
    "docs-measurements.json",
    JSON.stringify(measurements, null, 2),
  );
  await page.close();
}
await writeFile(
  "docs-measurements.json",
  JSON.stringify(measurements, null, 2),
);
await browser.close();
