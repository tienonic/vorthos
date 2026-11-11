import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "/usr/bin/brave-browser",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
for (const route of ["", "/discover", "/brands"]) {
  await page.goto("https://ciggies.app" + route, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(1600);
  console.log(
    route || "/",
    await page.title(),
    (await page.locator("body").innerText()).slice(0, 800),
  );
  await page.screenshot({
    path: "screenshots/reference-" + (route.slice(1) || "home") + ".png",
  });
}
await page.goto("https://ciggies.app/", { waitUntil: "domcontentloaded" });
const sku = await page.locator('a[href^="/sku/"]').first().getAttribute("href");
if (sku) {
  await page.goto("https://ciggies.app" + sku, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "screenshots/reference-artwork.png" });
  console.log(
    "sku",
    sku,
    (await page.locator("body").innerText()).slice(0, 1000),
  );
}
await browser.close();
