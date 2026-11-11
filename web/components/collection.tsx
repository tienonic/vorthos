"use client";
import { useRef } from "react";
import { useData, useArtQuery } from "./data-provider";
import { FiltersBar } from "./filters";
import { Count, VirtualGrid } from "./grid";
import { useURL } from "@/lib/url";
import { Filters, number, toQuery } from "@/lib/types";
import { Mark } from "./shell";
export function Collection() {
  const { meta } = useData(),
    params = useURL();
  const filters = Object.fromEntries(
    [
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
  return (
    <>
      <section
        className="collection-section page-width"
        id="collection"
        aria-label="Collection"
      >
        <FiltersBar filters={filters} />
        <Count count={result.total} ms={result.ms} />
        <VirtualGrid ids={result.ids} />
      </section>
    </>
  );
}

export function CollectionHero() {
  const { meta } = useData();
  const why = useRef<HTMLDialogElement>(null);
  return (
    <>
      <section className="hero">
        <div className="hero-symbol">
          <Mark size={36} />
        </div>
        <h1>Vorthos</h1>
        <p className="hero-subtitle">A gallery of Magic: The Gathering art.</p>
        <p className="hero-counts">
          {meta
            ? `${number(meta.n)} artworks · ${number(meta.artists.length)} artists`
            : "An ever-growing collection of Magic art"}
        </p>
        <a className="browse-button" href="#collection">
          Browse collection <span>↓</span>
        </a>
        <div className="hero-links">
          <button onClick={() => why.current?.showModal()}>
            Why this exists
          </button>
          <span>·</span>
          <a href="https://x.com/butonelli" target="_blank" rel="noreferrer">
            by @butonelli ↗
          </a>
        </div>
      </section>
      <dialog
        className="why-dialog"
        ref={why}
        onClick={(e) => {
          if (e.target === e.currentTarget) why.current?.close();
        }}
      >
        <button
          className="close-button"
          aria-label="Close"
          onClick={() => why.current?.close()}
        >
          ×
        </button>
        <Mark size={32} />
        <h2>A place to look.</h2>
        <p>
          Magic has built worlds through art for more than thirty years. Vorthos
          brings that work together, with room to see it.
        </p>
        <p>
          Follow a colour, find a feeling, or spend time with an artist. Every
          artwork belongs to the person who made it.
        </p>
        <p className="why-note">
          One entry for each unique illustration. Subjects and moods are ways to
          explore, and may be imperfect.
        </p>
      </dialog>
    </>
  );
}
export function CollectionLoading() {
  return (
    <section className="collection-section page-width" id="collection">
      <FiltersBar filters={{}} />
      <p className="count-line">Loading artworks…</p>
      <div style={{ height: 400 }} />
    </section>
  );
}
