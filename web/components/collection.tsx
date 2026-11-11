"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useData, useArtQuery } from "./data-provider";
import { FiltersBar } from "./filters";
import { Count, VirtualGrid } from "./grid";
import { useURL } from "@/lib/url";
import { Filters, number, toQuery } from "@/lib/types";
import { ArtImage } from "./grid";
export function Collection() {
  const { meta } = useData(),
    params = useURL();
  const filters = Object.fromEntries(
    [
      "search",
      "subject",
      "mood",
      "type",
      "year",
      "artist",
      "colour",
      "sort",
      "seed",
    ].flatMap((k) => (params.has(k) ? [[k, params.get(k)!]] : [])),
  ) as Filters;
  const result = useArtQuery(meta ? toQuery(filters, meta) : {});
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    if (Object.keys(JSON.parse(filterKey)).length) {
      const frame = requestAnimationFrame(() =>
        document
          .getElementById("collection")
          ?.scrollIntoView({ behavior: "instant" }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [filterKey, !!meta]);
  if (!meta) return <CollectionLoading />;
  return (
    <>
      <section
        className="collection-section"
        id="collection"
        aria-label="Collection"
      >
        <div className="filter-rail">
          <div className="page-width">
            <FiltersBar filters={filters} />
          </div>
        </div>
        <div className="page-width">
          <Count count={result.total} ms={result.ms} />
          <VirtualGrid ids={result.ids} />
        </div>
      </section>
    </>
  );
}

export function CollectionHero() {
  const { art, meta } = useData();
  const dialog = useRef<HTMLDialogElement>(null);
  const [topic, setTopic] = useState("How it works");
  const [zoom, setZoom] = useState(1);
  // A stable shuffle within evenly spaced slices keeps the wall varied across years.
  const spread = useMemo(() => {
    if (!art) return [];
    let seed = 20261110;
    const n = Math.min(art.n, 120);
    return Array.from({ length: n }, (_, i) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const start = Math.floor((i * art.n) / n);
      return (
        start + (seed % Math.max(1, Math.floor(((i + 1) * art.n) / n) - start))
      );
    }).sort(
      (a, b) =>
        (Math.imul(a + 17, 2654435761) >>> 0) -
        (Math.imul(b + 17, 2654435761) >>> 0),
    );
  }, [art]);
  const positions = Array.from({ length: 9 }, (_, row) => row - 4).flatMap(
    (row) =>
      Array.from({ length: 13 }, (_, col) => col - 6)
        .filter((col) => !(Math.abs(col) <= 1 && (row === 0 || row === 1)))
        .map((col) => ({ row, col })),
  );
  return (
    <>
      <section
        className="hero"
        aria-label="Vorthos gallery"
        style={{ "--zoom": zoom } as CSSProperties}
      >
        <div className="hero-wall" aria-hidden="true">
          {art &&
            positions.map(({ row, col }, i) => {
              const index = spread[i % spread.length];
              return (
                <div
                  className="wall-tile"
                  key={`${row}-${col}`}
                  style={{ left: col * 240 - 80, top: row * 282 - 237 }}
                >
                  <div className="wall-image">
                    <ArtImage
                      art={art}
                      index={index}
                      priority={row >= -2 && row <= 2 && Math.abs(col) < 4}
                    />
                  </div>
                  <p>{art.name[index]}</p>
                </div>
              );
            })}
        </div>
        <div className="wall-zoom">
          <div className="wall-zoom-buttons">
            <button
              aria-label="Zoom out"
              onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))}
            >
              −
            </button>
            <i aria-hidden="true" />
            <button
              aria-label="Zoom in"
              onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))}
            >
              +
            </button>
          </div>
          <span>
            <span className="desktop-zoom">{Math.round(zoom * 89.6657)}%</span>
            <span className="mobile-zoom">{Math.round(zoom * 40.857)}%</span>
          </span>
        </div>
        <div className="hero-copy">
          <h1>Vorthos</h1>
          <p className="hero-subtitle">MAGIC: THE GATHERING ART</p>
          <p className="hero-counts">
            {meta ? (
              `${number(meta.n)} artworks · ${number(meta.artists.length)} artists`
            ) : (
              <span className="hero-count-skeleton" />
            )}
          </p>
          <a className="browse-button" href="#collection">
            Browse collection <span aria-hidden="true">↓</span>
          </a>
          <div className="hero-links">
            {["How it works", "Why this exists"].map((label) => (
              <button
                key={label}
                onClick={() => {
                  setTopic(label);
                  dialog.current?.showModal();
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <a
            className="hero-credit"
            href="https://x.com/butonelli"
            target="_blank"
            rel="noreferrer"
          >
            𝕏 by @butonelli
          </a>
        </div>
      </section>
      <dialog
        className="why-dialog"
        ref={dialog}
        aria-labelledby="hero-dialog-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <button
          className="close-button"
          aria-label="Close"
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
        <h2 id="hero-dialog-title">{topic}</h2>
        {topic === "How it works" ? (
          <>
            <p>Filter by subject, mood, colour, card type, year or artist.</p>
            <p>Moods and subjects come from an image model and can be wrong.</p>
          </>
        ) : (
          <p>A place to look at Magic art as art.</p>
        )}
      </dialog>
    </>
  );
}
export function CollectionLoading() {
  return (
    <section className="collection-section" id="collection">
      <div className="filter-rail">
        <div className="page-width">
          <FiltersBar filters={{}} />
        </div>
      </div>
      <div className="page-width">
        <p className="count-line">Loading artworks…</p>
        <div className="loading-grid" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <div className="art-tile" key={i}>
              <div className="art-image skeleton-image" />
              <div className="tile-caption" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
