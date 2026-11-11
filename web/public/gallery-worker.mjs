import { prepare, query } from "./engine.mjs";
let data, meta, scores;
self.onmessage = async ({ data: message }) => {
  try {
    if (message.kind === "load") {
      meta = message.meta;
      const response = await fetch(message.base + "/data/art.json");
      if (!response.ok) throw Error("The collection could not load.");
      data = prepare(await response.json(), meta);
      self.postMessage({ kind: "ready", data });
    } else if (message.kind === "scores") {
      const response = await fetch(message.base + "/data/mood-scores.bin");
      if (!response.ok) throw Error("Mood strengths could not load.");
      scores = new Uint8Array(await response.arrayBuffer());
      if (scores.length !== data.n * meta.moods.length)
        throw Error("Mood strengths do not match the collection.");
      self.postMessage({ kind: "scores" });
    } else if (message.kind === "query" && data) {
      const result = query(data, message.query, scores, meta.moods.length);
      self.postMessage(
        { kind: "result", request: message.request, ...result },
        [result.ids.buffer, result.counts.buffer],
      );
    }
  } catch (error) {
    self.postMessage({ kind: "error", message: error.message });
  }
};
