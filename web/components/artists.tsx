"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useData } from "./data-provider";
import { number } from "@/lib/types";
export function Artists() {
  const { meta } = useData(),
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
  return (
    <div className="page-width artists-page">
      <div className="page-heading">
        <h1>Artists</h1>
        <p>The people behind the worlds.</p>
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
        {artists.map(([name, slug, count], i) => (
          <Link href={"/?artist=" + slug} key={slug} className="artist-entry">
            <span className="artist-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2>{name}</h2>
              <p>
                {number(count)} artwork{count === 1 ? "" : "s"}
              </p>
            </div>
            <span className="artist-arrow">↗</span>
          </Link>
        ))}
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
