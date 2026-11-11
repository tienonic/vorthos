import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const { n } = JSON.parse(await readFile("public/data/art.json", "utf8"));
const base = process.env.TEST_URL || "http://127.0.0.1:4186/vorthos";
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || "/usr/bin/brave-browser",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route("**/data/art.json", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelector(".count-line strong")?.textContent === "120",
  );
  assert.equal(await page.locator('[data-full="false"]').count(), 1);
  await page.screenshot({ path: "screenshots/head-first.png" });
  const headBeforeFull = true;
  release();
  await page.waitForSelector('[data-full="true"]');
  await page.waitForTimeout(150);
  assert.equal(
    requests.some((r) => r.endsWith("mood-scores.bin")),
    false,
  );
  await page.locator(".art-tile").first().focus();
  await page.keyboard.press("End");
  await page.waitForTimeout(200);
  const endIndex = await page.evaluate(() =>
    document.activeElement?.getAttribute("data-art"),
  );
  assert.equal(endIndex, String(n - 1));
  await page.keyboard.press("Home");
  await page.waitForTimeout(200);
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("data-art")),
    "0",
  );
  await page.locator(".art-tile").first().click();
  const deepLink = page.url();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".art-dialog[open] .art-details");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".art-dialog[open]", { state: "detached" });
  const broken = await browser.newPage();
  await broken.route("**/data/meta.json", (r) =>
    r.fulfill({ status: 503, body: "Unavailable" }),
  );
  await broken.goto(base + "/", { waitUntil: "domcontentloaded" });
  await broken.waitForSelector('.error[role="alert"]');
  assert.match(
    await broken.locator('.error[role="alert"]').innerText(),
    /unavailable/,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
    "auto",
  );
  const report = {
    headBeforeFull,
    moodScoresOnHome: false,
    keyboardEndIndex: endIndex,
    deepLinkRestored: true,
    dataErrorVisible: true,
    reducedMotion: true,
    base,
    checked: new Date().toISOString(),
  };
  await writeFile(
    "screenshots/loading-check.json",
    JSON.stringify(report, null, 2),
  );
  console.log(report);
} finally {
  await browser.close();
}
