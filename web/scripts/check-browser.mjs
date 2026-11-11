import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile, readFile } from "node:fs/promises";
const meta = JSON.parse(await readFile("public/data/meta.json", "utf8"));
const strengths = await readFile("public/data/mood-scores.bin");
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
        .every(
          (i) =>
            i.complete && i.naturalWidth > 0 && i.classList.contains("decoded"),
        ),
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
  assert.equal(
    await page
      .locator("body")
      .evaluate((e) => getComputedStyle(e).backgroundColor),
    "rgb(255, 255, 255)",
  );
  assert.equal(
    await page
      .locator(".top-inner")
      .evaluate((e) => e.getBoundingClientRect().height),
    56,
  );
  assert.equal(
    await page
      .locator(".hero h1")
      .evaluate((e) => getComputedStyle(e).fontSize),
    "96px",
  );
  await page.getByRole("button", { name: "How it works", exact: true }).click();
  await page.waitForSelector(".why-dialog[open]");
  assert.match(
    await page.locator(".why-dialog").innerText(),
    /image model and can be wrong/,
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Why this exists", exact: true })
    .click();
  assert.match(
    await page.locator(".why-dialog").innerText(),
    /look at Magic art as art/,
  );
  await page.keyboard.press("Escape");
  await screenshot("home-desktop");
  await page.locator(".browse-button").click();
  await page.waitForTimeout(500);
  await page
    .getByRole("textbox", { name: "Search artworks", exact: true })
    .fill("Mountain");
  await page.waitForFunction(
    (n) =>
      document.querySelector(".count-line strong")?.textContent ===
      n.toLocaleString("en-US"),
    raw.name.filter((name) => name.toLocaleLowerCase().includes("mountain"))
      .length,
  );
  assert.match(page.url(), /search=Mountain/);
  await page.getByRole("button", { name: "Clear artwork search" }).click();
  await ready();
  await screenshot("collection-desktop");
  assert.ok(
    Math.abs((await page.locator(".filter-rail").boundingBox()).y - 72) <= 1,
  );
  assert.equal(
    await page.locator(".art-row").first().locator(".art-tile").count(),
    6,
  );
  const tile = page.locator(".art-tile").first();
  await tile.click();
  await page.waitForSelector(".art-dialog[open] .decoded");
  await screenshot("artwork-desktop");
  assert.equal(
    await page
      .locator(".large-art img")
      .evaluate((e) => getComputedStyle(e).objectFit),
    "contain",
  );
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
    .getByText("Moods", { exact: true })
    .click();
  await page.waitForSelector(".venn-region");
  await page.waitForTimeout(400);
  assert.equal(await page.locator(".venn-region").count(), 7);
  await page.locator(".venn-region").nth(4).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  assert.match(page.url(), /region=5/);
  await screenshot("moods-venn");
  assert.deepEqual(
    await page
      .locator("main *")
      .evaluateAll((nodes) =>
        nodes
          .filter((e) =>
            getComputedStyle(e).textDecorationLine.includes("underline"),
          )
          .map((e) => e.tagName),
      ),
    [],
  );
  const expectedIds = raw.moods
    .flatMap((m, i) => ((m & 7) === 5 ? [i] : []))
    .sort((a, b) => {
      const strength = (i) =>
        strengths[i * meta.moods.length] +
        strengths[i * meta.moods.length + 1] +
        strengths[i * meta.moods.length + 2];
      return strength(b) - strength(a) || a - b;
    });
  await page.waitForFunction(
    (id) =>
      document
        .querySelector(".venn-results .art-tile")
        ?.getAttribute("data-art") === String(id),
    expectedIds[0],
  );
  const displayed = await page
    .locator(".venn-results .art-tile")
    .evaluateAll((nodes) =>
      nodes.map((e) => Number(e.getAttribute("data-art"))),
    );
  assert.deepEqual(displayed, expectedIds.slice(0, displayed.length));
  const expected = expectedIds.length;
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
  const underlines = await page
    .locator("main *")
    .evaluateAll((nodes) =>
      nodes
        .filter((e) =>
          getComputedStyle(e).textDecorationLine.includes("underline"),
        )
        .map((e) => e.outerHTML.slice(0, 120)),
    );
  assert.deepEqual(underlines, []);
  assert.equal(
    await page.locator("main h1, .spectrum-section, .curated-section").count(),
    0,
  );
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
  for (const [width, columns] of [
    [390, 2],
    [639, 2],
    [640, 3],
    [767, 3],
    [768, 4],
    [1023, 4],
    [1024, 5],
    [1279, 5],
    [1280, 6],
    [1440, 6],
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForFunction(
      (n) => document.querySelector(".art-row")?.children.length === n,
      columns,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `horizontal overflow at ${width}px`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await ready();
  assert.equal(
    await page
      .locator(".hero h1")
      .evaluate((e) => getComputedStyle(e).fontSize),
    "34px",
  );
  assert.equal(
    await page
      .locator(".bottom-nav")
      .evaluate((e) => e.getBoundingClientRect().height),
    61,
  );
  await screenshot("home-mobile");
  await page.locator(".browse-button").click();
  await page.waitForTimeout(500);
  await screenshot("collection-mobile");
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
    .getByRole("link", { name: /Moods/ })
    .click();
  await page.waitForSelector(".venn-region");
  await page.waitForTimeout(300);
  await screenshot("moods-mobile");
  assert.deepEqual(
    await page
      .locator("main *")
      .evaluateAll((nodes) =>
        nodes
          .filter((e) =>
            getComputedStyle(e).textDecorationLine.includes("underline"),
          )
          .map((e) => e.tagName),
      ),
    [],
  );
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: /Artists/ })
    .click();
  await page.waitForSelector(".artist-entry");
  await screenshot("artists-mobile");
  console.log(JSON.stringify({ errors, failed, artistName }, null, 2));
  assert.equal((await page.request.get(base + "/discover/")).status(), 404);
  assert.equal(errors.length, 0);
  assert.equal(failed.length, 0);
  await writeFile(
    "screenshots/browser-check.json",
    JSON.stringify(
      {
        errors,
        failed,
        artistName,
        moodsUnderlines: 0,
        wholePainting: true,
        responsiveColumns: true,
        checked: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
