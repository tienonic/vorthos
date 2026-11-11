"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useData } from "./data-provider";
import { ArtImage } from "./grid";
import { number } from "@/lib/types";
export function Artists() {
  const { meta, art } = useData(),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("count");
  const artists = useMemo(
    () =>
      meta?.artists
        .filter((a) => a[0].toLowerCase().includes(search.toLowerCase()))
        .slice()
        .sort((a, b) =>
          sort === "name"
            ? a[0].localeCompare(b[0])
            : b[2] - a[2] || a[0].localeCompare(b[0]),
        ) || [],
    [meta, search, sort],
  );
  const previews = useMemo(() => {
    const samples = new Map<number, number>();
    if (art)
      for (let i = 0; i < art.n; i++) {
        if (!samples.has(art.artist[i])) samples.set(art.artist[i], i);
      }
    return samples;
  }, [art]);
  return (
    <div className="page-width artists-page">
      <div className="page-heading">
        <h1>Artists</h1>
      </div>
      <div className="artist-controls">
        <label className="artist-search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search all artists"
            placeholder="Find an artist…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear artist search"
            >
              ×
            </button>
          )}
        </label>
        <select
          aria-label="Sort artists"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="count">Most artworks</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
      <div className="count-line">
        <span>
          <strong>{number(artists.length)}</strong> artists
        </span>
      </div>
      <div className="artist-directory">
        {artists.map(([name, slug, count]) => {
          const index = meta?.artists.findIndex((a) => a[1] === slug) ?? -1;
          const preview = previews.get(index);
          return (
            <Link
              href={"/?artist=" + slug}
              key={slug}
              className="artist-entry"
              aria-label={`${name}, ${number(count)} artworks`}
            >
              <div className="artist-preview">
                {art && preview !== undefined ? (
                  <ArtImage art={art} index={preview} />
                ) : (
                  <div className="art-image skeleton-image" />
                )}
              </div>
              <div className="artist-caption">
                <div className="artist-name">
                  <h2>{name}</h2>
                  <span>{number(count)}</span>
                </div>
                <p>{slug}</p>
              </div>
            </Link>
          );
        })}
      </div>
      {meta && artists.length === 0 && (
        <div className="empty">
          <h2>No artists found.</h2>
          <p>Try a different name.</p>
        </div>
      )}
    </div>
  );
}
