import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
const m = JSON.parse(await readFile("docs-measurements.json", "utf8"));
const browser = await chromium.launch({
  executablePath: "/usr/bin/brave-browser",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto("https://ciggies.app/", { waitUntil: "networkidle" });
  m.details = await p.evaluate(() => {
    const take = (e) => {
      if (!e) return null;
      const s = getComputedStyle(e),
        r = e.getBoundingClientRect();
      return {
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        style: Object.fromEntries(
          [
            "fontFamily",
            "fontSize",
            "fontWeight",
            "lineHeight",
            "letterSpacing",
            "borderRadius",
            "backgroundColor",
            "color",
            "padding",
            "margin",
            "opacity",
            "transition",
            "animation",
            "boxShadow",
            "border",
            "transform",
          ].map((k) => [k, s[k]]),
        ),
      };
    };
    const first = document.querySelector(".gallery-item");
    return {
      logo: take(document.querySelector("nav a").firstElementChild),
      wall: {
        tile: take(first),
        image: take(first.querySelector("img")),
        caption: take(first.lastElementChild),
        canvas: take(first.parentElement),
      },
      pendingImages: [...document.images].filter((e) => !e.complete).length,
    };
  });
  m.breakpoints = [];
  for (const width of [
    390, 639, 640, 767, 768, 1023, 1024, 1279, 1280, 1440, 2000,
  ]) {
    await p.setViewportSize({ width, height: 1000 });
    await p.waitForTimeout(100);
    m.breakpoints.push(
      await p
        .locator("main > .grid")
        .first()
        .evaluate((e, width) => {
          const s = getComputedStyle(e);
          return {
            width,
            columns: s.gridTemplateColumns.split(" ").length,
            gridTemplateColumns: s.gridTemplateColumns,
            gap: s.gap,
            containerWidth: e.getBoundingClientRect().width,
            tileWidth: e.firstElementChild.getBoundingClientRect().width,
          };
        }, width),
    );
  }
  await p.setViewportSize({ width: 1440, height: 1000 });
  await p.locator('a[href="#collection"]:visible').first().click();
  await p.waitForTimeout(500);
  await p.locator(".sku-card").first().hover();
  await p.waitForTimeout(400);
  m.hoverSettled = await p
    .locator(".sku-card")
    .first()
    .evaluate((e) => ({
      card: {
        border: getComputedStyle(e).border,
        boxShadow: getComputedStyle(e).boxShadow,
        transition: getComputedStyle(e).transition,
      },
      image: {
        transform: getComputedStyle(e.querySelector("img")).transform,
        transition: getComputedStyle(e.querySelector("img")).transition,
      },
      overlay: {
        transform: getComputedStyle(e.querySelector(".sku-card-overlay"))
          .transform,
        transition: getComputedStyle(e.querySelector(".sku-card-overlay"))
          .transition,
      },
    }));
  // Delay product images to inspect the real pending-image state without copying assets.
  const cold = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await cold.route("**/api/**", async (route) => {
    await gate;
    await route.continue();
  });
  await cold.goto("https://ciggies.app/", { waitUntil: "domcontentloaded" });
  await cold.waitForSelector(".sku-card");
  await cold
    .waitForSelector(".skeleton", { state: "attached", timeout: 5000 })
    .catch(() => {});
  m.loading = await cold.evaluate(() => ({
    animatedSkeletons: [
      ...document.querySelectorAll(
        '[class*="skeleton"], [class*="animate-pulse"]',
      ),
    ].map((e) => ({
      class: e.className,
      animation: getComputedStyle(e).animation,
      background: getComputedStyle(e).backgroundColor,
      backgroundImage: getComputedStyle(e).backgroundImage,
      backgroundSize: getComputedStyle(e).backgroundSize,
      borderRadius: getComputedStyle(e).borderRadius,
      keyframes: e.getAnimations().flatMap((a) => a.effect.getKeyframes()),
    })),
    imageBoxBackground: getComputedStyle(
      document.querySelector(".sku-card a > div"),
    ).backgroundColor,
    pendingImageOpacity: getComputedStyle(
      document.querySelector(".sku-card img"),
    ).opacity,
    pendingImageAnimation: getComputedStyle(
      document.querySelector(".sku-card img"),
    ).animation,
  }));
  release();
  await cold.close();
  await p.close();
  await writeFile("docs-measurements.json", JSON.stringify(m, null, 2));
  console.log(
    JSON.stringify(
      {
        details: m.details,
        breakpoints: m.breakpoints,
        hover: m.hoverSettled,
        loading: m.loading,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
