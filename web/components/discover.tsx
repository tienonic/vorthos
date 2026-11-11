"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useData, useArtQuery } from "./data-provider";
import { ArtRow, Count, VirtualGrid } from "./grid";
import { Query, number } from "@/lib/types";
import { useURL, updateURL } from "@/lib/url";
export function Discover() {
  const { meta, full, loadScores, scores } = useData(),
    params = useURL();
  useEffect(() => {
    loadScores();
  }, [full, loadScores]);
  const requested = (
    params.get("venn") ||
    meta?.moods
      .slice(0, 3)
      .map((m) => m.key)
      .join(",") ||
    ""
  )
    .split(",")
    .filter(Boolean);
  const valid = [...new Set(requested)]
    .filter((k) => meta?.moods.some((m) => m.key === k))
    .slice(0, 3);
  const chosen =
    valid.length >= 2 ? valid : meta?.moods.slice(0, 3).map((m) => m.key) || [];
  const moodIds = chosen
    .map((k) => meta?.moods.findIndex((m) => m.key === k) ?? -1)
    .filter((i) => i >= 0)
    .slice(0, 3);
  const requestedRegion = Number(params.get("region") ?? 1);
  const region =
    Number.isInteger(requestedRegion) &&
    requestedRegion >= 0 &&
    requestedRegion < 1 << moodIds.length
      ? requestedRegion
      : 1;
  const result = useArtQuery({ vennMoods: moodIds, region });
  const [hue, setHue] = useState(190),
    [dragHue, setDragHue] = useState(190);
  const spectrum = useArtQuery({
    metric: "hue",
    colour: [hue, 65, 48],
    limit: 12,
  });
  useEffect(() => {
    const timer = setTimeout(() => setHue(dragHue), 50);
    return () => clearTimeout(timer);
  }, [dragHue]);
  return (
    <div className="page-width discover-page">
      <div className="page-heading">
        <h1>Discover</h1>
        <p>Explore the collection by mood and colour.</p>
      </div>
      <section className="venn-section">
        <div className="section-heading">
          <div>
            <h2>Mood Venn</h2>
            <p>Pick two or three moods. Explore where they meet.</p>
          </div>
          <span className="small-note">
            {scores
              ? "Ordered by mood strength"
              : full
                ? "Loading mood strengths…"
                : "Loading collection…"}
          </span>
        </div>
        <div className="venn-layout">
          <div className="venn-controls">
            <div className="mood-picks">
              {meta?.moods.map((m, i) => (
                <button
                  key={m.key}
                  className={
                    "mood-pick " + (moodIds.includes(i) ? "picked" : "")
                  }
                  aria-pressed={moodIds.includes(i)}
                  onClick={() => {
                    let next = chosen.includes(m.key)
                      ? chosen.filter((k) => k !== m.key)
                      : [...chosen, m.key];
                    if (next.length > 3) next = next.slice(1);
                    if (next.length < 2) return;
                    updateURL({ venn: next.join(","), region: undefined });
                  }}
                >
                  <span
                    className="mood-dot"
                    style={{
                      backgroundColor:
                        ["#647b58", "#8b72a8", "#bd884f"][moodIds.indexOf(i)] ||
                        "#d1cec5",
                    }}
                  />
                  {m.label}
                </button>
              ))}
            </div>
            <p className="venn-help">
              Click a region to see only the artworks in that overlap.
            </p>
            <button
              className={"outside-region " + (region === 0 ? "picked" : "")}
              onClick={() => updateURL({ region: "0" })}
            >
              None of these moods <span>{number(result.counts[0] || 0)}</span>
            </button>
          </div>
          <Venn
            moods={moodIds.map((i) => meta?.moods[i].label || "")}
            counts={result.counts}
            region={region}
            onRegion={(r) => updateURL({ region: String(r) })}
          />
        </div>
        <div className="region-heading">
          <h3>
            {region === 0
              ? "None of these moods"
              : moodIds
                  .filter((_, i) => region & (1 << i))
                  .map((i) => meta?.moods[i].label)
                  .join(" + ")}
            <span> · exact region</span>
          </h3>
          <Link
            className="text-link"
            href={
              "/?" +
              new URLSearchParams(
                moodIds[0] >= 0 ? { mood: meta!.moods[moodIds[0]].key } : {},
              )
            }
          >
            Explore a mood ↗
          </Link>
        </div>
        <Count count={result.total} ms={result.ms} />
        <div className="venn-results">
          <VirtualGrid
            ids={
              params.get("show") === "all"
                ? result.ids
                : result.ids.slice(0, 10)
            }
            label="Mood region artworks"
          />
        </div>
        {result.total > 10 && (
          <Link
            className="text-link"
            href={
              "?" +
              new URLSearchParams({
                ...Object.fromEntries(params),
                show: "all",
              })
            }
            onClick={(e) => {
              e.preventDefault();
              updateURL({
                show: params.get("show") === "all" ? undefined : "all",
              });
            }}
          >
            {params.get("show") === "all"
              ? "Show fewer"
              : "Show all " + number(result.total) + " artworks"}{" "}
            ↓
          </Link>
        )}
      </section>
      <section className="spectrum-section">
        <div className="section-heading">
          <div>
            <h2>Colour spectrum</h2>
            <p>Scrub to find artworks near a hue.</p>
          </div>
          <span
            className="hue-readout"
            style={{ color: `hsl(${dragHue} 55% 32%)` }}
          >
            {dragHue}°
          </span>
        </div>
        <input
          className="spectrum-slider"
          type="range"
          min="0"
          max="359"
          value={dragHue}
          onChange={(e) => setDragHue(Number(e.target.value))}
          aria-label="Scrub the colour spectrum"
        />
        <div className="spectrum-labels">
          <span>Warm</span>
          <span>Green</span>
          <span>Blue</span>
          <span>Violet</span>
          <span>Warm</span>
        </div>
        <ArtRow ids={spectrum.ids} />
      </section>
      <CuratedRow title="Darkest" query={{ metric: "dark", limit: 10 }} />
      <CuratedRow
        title="Most luminous"
        query={{ metric: "light", limit: 10 }}
      />
      <CuratedRow
        title="Most saturated"
        query={{ metric: "saturated", limit: 10 }}
      />
      {meta?.moods.map((m, i) => (
        <CuratedRow
          key={m.key}
          title={m.label}
          query={{ mood: i, limit: 10 }}
          href={"/?mood=" + m.key}
        />
      ))}
    </div>
  );
}
function CuratedRow({
  title,
  query,
  href,
}: {
  title: string;
  query: Query;
  href?: string;
}) {
  const result = useArtQuery(query);
  return (
    <section className="curated-section">
      <div className="section-heading">
        <h2>{title}</h2>
        {href && (
          <Link className="text-link" href={href}>
            View all ↗
          </Link>
        )}
      </div>
      <ArtRow ids={result.ids} />
    </section>
  );
}
function Venn({
  moods,
  counts,
  region,
  onRegion,
}: {
  moods: string[];
  counts: Uint32Array;
  region: number;
  onRegion: (n: number) => void;
}) {
  const three = moods.length === 3,
    circles = three
      ? [
          [165, 140, 110],
          [285, 140, 110],
          [225, 240, 110],
        ]
      : [
          [165, 180, 115],
          [300, 180, 115],
        ];
  const positions = three
    ? [
        [0, 0],
        [120, 110],
        [330, 110],
        [225, 100],
        [225, 295],
        [155, 225],
        [295, 225],
        [225, 185],
      ]
    : [
        [0, 0],
        [125, 180],
        [340, 180],
        [232, 180],
      ];
  return (
    <svg
      className="venn"
      viewBox="0 0 450 380"
      role="group"
      aria-label="Mood overlap diagram"
    >
      <defs>
        {circles.map(([cx, cy, r], i) => (
          <clipPath id={"circle-" + i} key={i}>
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
        ))}
        {Array.from({ length: 1 << moods.length }, (_, mask) => (
          <mask id={"exclude-" + mask} key={mask}>
            <rect width="450" height="380" fill="white" />
            {circles.map(
              ([cx, cy, r], j) =>
                !(mask & (1 << j)) && (
                  <circle key={j} cx={cx} cy={cy} r={r} fill="black" />
                ),
            )}
          </mask>
        ))}
      </defs>
      {circles.map(([cx, cy, r], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill={["#647b58", "#8b72a8", "#bd884f"][i]}
          fillOpacity=".12"
          stroke={["#647b58", "#8b72a8", "#bd884f"][i]}
          strokeWidth="1.2"
        />
      ))}
      {Array.from({ length: (1 << moods.length) - 1 }, (_, n) => {
        const mask = n + 1,
          label = moods.filter((_, i) => mask & (1 << i)).join(" + "),
          pos = positions[mask];
        let shape: React.ReactNode = (
          <rect
            width="450"
            height="380"
            fill={region === mask ? "#314c3f" : "transparent"}
            fillOpacity=".17"
            mask={`url(#exclude-${mask})`}
          />
        );
        for (let i = 0; i < moods.length; i++)
          if (mask & (1 << i))
            shape = <g clipPath={`url(#circle-${i})`}>{shape}</g>;
        return (
          <g
            key={mask}
            className={"venn-region " + (region === mask ? "selected" : "")}
            role="button"
            tabIndex={0}
            aria-label={`${label} only: ${counts[mask] || 0} artworks`}
            aria-pressed={region === mask}
            onClick={() => onRegion(mask)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRegion(mask);
              }
            }}
          >
            {shape}
            <text
              x={pos[0]}
              y={pos[1]}
              textAnchor="middle"
              className="venn-count"
            >
              {number(counts[mask] || 0)}
            </text>
            {(mask & (mask - 1)) === 0 && (
              <text
                x={pos[0]}
                y={pos[1] + 20}
                textAnchor="middle"
                className="venn-name"
              >
                {moods[Math.log2(mask)]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
