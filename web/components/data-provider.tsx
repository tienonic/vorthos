"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { Art, Meta, Query, BASE } from "@/lib/types";
import { prepare, query as runQuery } from "@/public/engine.mjs";
type Result = {
  ids: Uint32Array;
  counts: Uint32Array;
  ms: number;
  total: number;
};
type Store = {
  meta: Meta | null;
  art: Art | null;
  full: boolean;
  scores: boolean;
  error: string;
  request: (q: Query, cb: (r: Result) => void) => () => void;
  loadScores: () => void;
};
const Context = createContext<Store>(null!);
export function DataProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null),
    [art, setArt] = useState<Art | null>(null),
    [full, setFull] = useState(false),
    [scores, setScores] = useState(false),
    [error, setError] = useState("");
  const worker = useRef<Worker | null>(null),
    callbacks = useRef(new Map<number, (r: Result) => void>()),
    serial = useRef(0),
    scoresAsked = useRef(false);
  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const responses = await Promise.all([
          fetch(BASE + "/data/meta.json"),
          fetch(BASE + "/data/head.json"),
        ]);
        if (responses.some((r) => !r.ok))
          throw Error(
            "The collection is unavailable. Please reload to try again.",
          );
        const [m, h] = await Promise.all(responses.map((r) => r.json()));
        if (disposed) return;
        setMeta(m);
        setArt(prepare(h, m));
        const w = new Worker(BASE + "/gallery-worker.mjs", { type: "module" });
        worker.current = w;
        w.onmessage = ({ data: msg }) => {
          if (msg.kind === "ready") {
            setArt(msg.data);
            setFull(true);
          }
          if (msg.kind === "scores") setScores(true);
          if (msg.kind === "result") {
            callbacks.current.get(msg.request)?.(msg);
            callbacks.current.delete(msg.request);
          }
          if (msg.kind === "error")
            setError(msg.message + " Reload to try again.");
        };
        w.onerror = () =>
          setError("The full collection could not load. Reload to try again.");
        w.postMessage({ kind: "load", base: BASE, meta: m });
      } catch (e) {
        if (!disposed) setError((e as Error).message);
      }
    }
    load();
    return () => {
      disposed = true;
      worker.current?.terminate();
    };
  }, []);
  const request = useCallback(
    (q: Query, cb: (r: Result) => void) => {
      if (!full || !worker.current) {
        if (art && meta) cb(runQuery(art, q, undefined, meta.moods.length));
        return () => {};
      }
      const id = ++serial.current;
      callbacks.current.set(id, cb);
      worker.current.postMessage({ kind: "query", request: id, query: q });
      return () => {
        callbacks.current.delete(id);
      };
    },
    [art, meta, full],
  );
  const loadScores = useCallback(() => {
    if (full && !scoresAsked.current) {
      scoresAsked.current = true;
      worker.current?.postMessage({ kind: "scores", base: BASE });
    }
  }, [full]);
  return (
    <Context.Provider
      value={{ meta, art, full, scores, error, request, loadScores }}
    >
      {children}
    </Context.Provider>
  );
}
export const useData = () => useContext(Context);
export function useArtQuery(q: Query) {
  const { request, scores } = useData();
  const key = JSON.stringify(q);
  const [result, setResult] = useState<Result>({
    ids: new Uint32Array(),
    counts: new Uint32Array(),
    ms: 0,
    total: 0,
  });
  useEffect(() => request(JSON.parse(key), setResult), [request, key, scores]);
  return result;
}
