import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";
import { prepare, query } from "../public/engine.mjs";
await mkdir(".tmp", { recursive: true });
const temp = await mkdtemp(".tmp/benchmark-");
const raw = JSON.parse(await readFile("public/data/art.json", "utf8")),
  meta = JSON.parse(await readFile("public/data/meta.json", "utf8")),
  n = 60000;
const repeated = { n };
for (const [key, values] of Object.entries(raw)) {
  if (key === "n") continue;
  const stride = key === "hsl" || key === "pal" ? 3 : 1;
  repeated[key] = Array.from(
    { length: n * stride },
    (_, i) => values[i % (raw.n * stride)],
  );
}
const sourceScores = await readFile("public/data/mood-scores.bin");
const syntheticScores = Uint8Array.from(
  { length: n * meta.moods.length },
  (_, i) => sourceScores[i % sourceScores.length],
);
await writeFile(temp + "/mood-scores.bin", syntheticScores);
const file = temp + "/art.json";
await writeFile(file, JSON.stringify(repeated));
const json = await readFile(file, "utf8");
const parseStart = performance.now(),
  data = prepare(JSON.parse(json), meta),
  parseMs = performance.now() - parseStart;
const cases = {
  all: {},
  combined: {
    subject: raw.subject[0],
    mood: Math.max(0, Math.floor(Math.log2(raw.moods[0] & -raw.moods[0]))),
    type: raw.type[0],
  },
  colour: { colour: [185, 65, 48] },
  rainbow: { sort: "colour" },
  oldest: { sort: "oldest" },
  random: { sort: "random", seed: 42 },
  venn: { vennMoods: [0, 1, 2], region: 5 },
};
const results = {
  records: n,
  sourceRecords: raw.n,
  bytes: Buffer.byteLength(json),
  parseAndTypedArraysMs: parseMs,
  node: {},
  browser: {},
};
for (const [name, q] of Object.entries(cases)) {
  query(data, q, syntheticScores, meta.moods.length);
  const times = Array.from(
    { length: 15 },
    () => query(data, q, syntheticScores, meta.moods.length).ms,
  ).sort((a, b) => a - b);
  results.node[name] = {
    medianMs: times[7],
    p95Ms: times[14],
    matches: query(data, q, syntheticScores, meta.moods.length).total,
  };
}
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || "/usr/bin/brave-browser",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  await page.route("**/data/mood-scores.bin", (r) =>
    r.fulfill({
      body: Buffer.from(syntheticScores),
      contentType: "application/octet-stream",
    }),
  );
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/data/art.json", (r) =>
    r.fulfill({ body: json, contentType: "application/json" }),
  );
  await page.route("**/data/meta.json", (r) =>
    r.fulfill({
      body: JSON.stringify({ ...meta, n }),
      contentType: "application/json",
    }),
  );
  const base = process.env.TEST_URL || "http://127.0.0.1:4186/vorthos";
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-full="true"]');
  await page.waitForFunction(
    () =>
      document.querySelector(".count-line strong")?.textContent === "60,000",
  );
  const workerBase = new URL(base).pathname.replace(/\/$/, "");
  const browserQueries = await page.evaluate(
    async ({ cases, workerBase }) => {
      const w = new Worker(workerBase + "/gallery-worker.mjs", {
        type: "module",
      });
      const m = await fetch(workerBase + "/data/meta.json").then((r) =>
        r.json(),
      );
      await new Promise((resolve, reject) => {
        w.onmessage = (e) => {
          if (e.data.kind === "ready") resolve();
          if (e.data.kind === "error") reject(Error(e.data.message));
        };
        w.postMessage({ kind: "load", base: workerBase, meta: m });
      });
      await new Promise((resolve, reject) => {
        w.onmessage = (e) => {
          if (e.data.kind === "scores") resolve();
          if (e.data.kind === "error") reject(Error(e.data.message));
        };
        w.postMessage({ kind: "scores", base: workerBase });
      });
      const results = {};
      let request = 0;
      for (const [name, q] of Object.entries(cases)) {
        const times = [],
          roundtrips = [];
        let total;
        for (let i = 0; i < 12; i++) {
          const started = performance.now();
          const result = await new Promise((resolve) => {
            w.onmessage = (e) => resolve(e.data);
            w.postMessage({ kind: "query", query: q, request: ++request });
          });
          times.push(result.ms);
          roundtrips.push(performance.now() - started);
          total = result.total;
        }
        times.sort((a, b) => a - b);
        roundtrips.sort((a, b) => a - b);
        results[name] = {
          medianMs: times[6],
          p95Ms: times[11],
          roundtripMedianMs: roundtrips[6],
          matches: total,
        };
      }
      w.terminate();
      return results;
    },
    { cases, workerBase },
  );
  results.browser.queries = browserQueries;
  const scrolling = await page.evaluate(async () => {
    const frameTimes = [];
    let maxTiles = 0;
    let last = performance.now();
    const begin = last;
    for (let i = 0; i < 120; i++) {
      window.scrollTo({ top: 700 + i * 850, behavior: "instant" });
      await new Promise(requestAnimationFrame);
      const now = performance.now();
      frameTimes.push(now - last);
      last = now;
      maxTiles = Math.max(
        maxTiles,
        document.querySelectorAll(".virtual-grid .art-tile").length,
      );
    }
    frameTimes.sort((a, b) => a - b);
    return {
      durationMs: performance.now() - begin,
      frames: 120,
      medianFrameMs: frameTimes[60],
      p95FrameMs: frameTimes[114],
      maxRenderedTiles: maxTiles,
      scrollY: scrollY,
      rowsHeight: document.querySelector(".virtual-grid").offsetHeight,
    };
  });
  results.browser.scrolling = scrolling;
  await page.screenshot({ path: "screenshots/benchmark-60000.png" });
  const visible = await page.locator(".art-tile").evaluateAll((nodes) =>
    nodes.findIndex((n) => {
      const r = n.getBoundingClientRect();
      return r.top > 80 && r.bottom < innerHeight;
    }),
  );
  const before = await page.evaluate(() => scrollY);
  await page.locator(".art-tile").nth(visible).click();
  await page.waitForSelector(".art-dialog[open]");
  await page.getByRole("button", { name: "Close artwork" }).click();
  const after = await page.evaluate(() => scrollY);
  results.browser.overlayScroll = {
    before,
    after,
    preserved: before === after,
  };
  results.browser.errors = errors;
  await writeFile(
    "screenshots/benchmark.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
  if (
    !results.browser.overlayScroll.preserved ||
    errors.length ||
    scrolling.maxRenderedTiles > 70
  )
    throw Error("Browser benchmark failed");
} finally {
  await browser.close();
  await rm(temp, { recursive: true, force: true });
}
