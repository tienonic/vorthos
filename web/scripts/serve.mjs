import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "/vorthos").replace(
    /\/$/,
    "",
  ),
  root = path.resolve("out"),
  port = Number(process.env.PORT || 4186);
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".bin": "application/octet-stream",
  ".png": "image/png",
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (
      base &&
      !(url.pathname === base || url.pathname.startsWith(base + "/"))
    ) {
      res.writeHead(302, { Location: base + "/" });
      res.end();
      return;
    }
    let file = path.resolve(
      root,
      "." + decodeURIComponent(url.pathname.slice(base.length) || "/"),
    );
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] || "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Export: http://127.0.0.1:${port}${base}/`),
);
