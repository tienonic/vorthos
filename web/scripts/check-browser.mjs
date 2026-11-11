import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile, readFile } from "node:fs/promises";
const raw = JSON.parse(await readFile("public/data/art.json", "utf8"));
const base = process.env.TEST_URL || "http://127.0.0.1:4186/vorthos";
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || "/usr/bin/brave-browser",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
const errors = [],
  failed = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) failed.push([r.status(), r.url()]);
});
async function ready() {
  await page.waitForSelector('[data-full="true"]', { timeout: 30000 });
  await page.waitForTimeout(250);
}
async function screenshot(name) {
  await page.waitForFunction(
    () =>
      Array.from(document.images)
        .filter((i) => {
          const r = i.getBoundingClientRect();
          return (
            r.bottom > 0 &&
            r.top < innerHeight &&
            r.width > 0 &&
            r.height > 0 &&
            r.right > 0 &&
            r.left < innerWidth
          );
        })
        .every((i) => i.complete && i.naturalWidth > 0),
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "screenshots/" + name + ".png",
    fullPage: false,
  });
}
try {
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await ready();
  await screenshot("home-desktop");
  const tile = page.locator(".art-tile").first();
  await tile.click();
  await page.waitForSelector(".art-dialog[open] .decoded");
  await screenshot("artwork-desktop");
  await page.getByRole("button", { name: "Close artwork" }).click();
  await page.waitForSelector(".art-dialog[open]", { state: "detached" });
  await page.locator(".art-tile").first().click();
  await page.locator(".swatches a").first().click();
  await page.waitForTimeout(200);
  assert.match(page.url(), /colour=/);
  await page.waitForSelector(".art-dialog[open]", { state: "detached" });
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.getByRole("button", { name: "Subject", exact: true }).click();
  await page.locator("#filter-subject .menu-option").nth(1).click();
  await page.getByRole("button", { name: "Mood", exact: true }).click();
  await page.locator("#filter-mood .menu-option").nth(1).click();
  await page.waitForTimeout(200);
  assert.match(page.url(), /subject=/);
  assert.match(page.url(), /mood=/);
  await screenshot("combined-filters");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Collection", exact: true })
    .click();
  await page.waitForFunction(() => !location.search);
  await page.waitForFunction(
    (n) =>
      document.querySelector(".count-line strong")?.textContent ===
      n.toLocaleString("en-US"),
    raw.n,
  );
  await page.goBack();
  await page.waitForFunction(
    () => document.querySelectorAll(".filter-pill.active").length === 2,
  );

  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.getByRole("button", { name: "Colour", exact: true }).click();
  const plane = page.getByRole("slider", { name: "Colour hue and lightness" }),
    box = await plane.boundingBox();
  await page.mouse.click(box.x + box.width * 0.48, box.y + box.height * 0.55);
  await page.waitForTimeout(250);
  assert.match(page.url(), /colour=/);
  await screenshot("colour-picker");
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByText("Discover", { exact: true })
    .click();
  await page.waitForSelector(".venn-region");
  await page.waitForTimeout(400);
  assert.equal(await page.locator(".venn-region").count(), 7);
  await page.locator(".venn-region").nth(4).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  assert.match(page.url(), /region=5/);
  await screenshot("discover-venn");
  const expected = raw.moods.filter((m) => (m & 7) === 5).length;
  assert.equal(
    Number(
      (
        await page.locator(".venn-section .count-line strong").innerText()
      ).replaceAll(",", ""),
    ),
    expected,
  );
  await page.getByRole("button", { name: "Triumphant", exact: true }).click();
  await page.waitForTimeout(150);
  assert.equal(await page.locator(".venn-region").count(), 3);
  await page.getByRole("button", { name: "Triumphant", exact: true }).click();
  await page
    .getByRole("slider", { name: "Scrub the colour spectrum" })
    .fill("280");
  await page.waitForTimeout(300);
  await page.locator(".spectrum-section").scrollIntoViewIfNeeded();
  await screenshot("discover-spectrum");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByText("Artists", { exact: true })
    .click();
  await page.waitForSelector(".artist-entry");
  await screenshot("artists-desktop");
  const artistName = await page.locator(".artist-entry h2").first().innerText();
  await page
    .getByRole("textbox", { name: "Search all artists" })
    .fill(artistName.slice(0, 5));
  assert.ok((await page.locator(".artist-entry").count()) > 0);
  await page.locator(".artist-entry").first().click();
  await ready();
  assert.match(page.url(), /artist=/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await ready();
  await screenshot("home-mobile");
  await page.getByRole("button", { name: "Colour", exact: true }).click();
  await screenshot("colour-mobile");
  const mobilePlane = page.getByRole("slider", {
    name: "Colour hue and lightness",
  });
  await mobilePlane.focus();
  await page.keyboard.press("ArrowRight");
  assert.match(page.url(), /colour=/);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.locator(".art-tile").first().click();
  await page.waitForSelector(".art-dialog[open] .decoded");
  await screenshot("artwork-mobile");
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: /Discover/ })
    .click();
  await page.waitForSelector(".venn-region");
  await page.waitForTimeout(300);
  await screenshot("discover-mobile");
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: /Artists/ })
    .click();
  await page.waitForSelector(".artist-entry");
  await screenshot("artists-mobile");
  console.log(JSON.stringify({ errors, failed, artistName }, null, 2));
  assert.equal(errors.length, 0);
  assert.equal(failed.length, 0);
  await writeFile(
    "screenshots/browser-check.json",
    JSON.stringify(
      { errors, failed, artistName, checked: new Date().toISOString() },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
