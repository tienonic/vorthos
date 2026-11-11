"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Filters } from "@/lib/types";
import { useData } from "./data-provider";
import { updateURL, useURL } from "@/lib/url";
const filterKeys = [
  "search",
  "subject",
  "mood",
  "colour",
  "type",
  "year",
  "artist",
  "sort",
  "seed",
];
export function ColourPicker({
  value,
  onChange,
}: {
  value?: number[];
  onChange: (v: number[], replace?: boolean) => void;
}) {
  const [pick, setPick] = useState(value || [180, 70, 50]);
  useEffect(() => {
    if (value) setPick(value);
  }, [value?.join(",")]);
  const change = (v: number[], replace = false) => {
    setPick(v);
    onChange(v, replace);
  };
  const pointer = (
    e: React.PointerEvent<HTMLElement>,
    grey = false,
    replace = false,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect(),
      x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    change(
      grey
        ? [0, 0, Math.round(x * 100)]
        : [Math.round(x * 359), 70, Math.round((1 - y) * 100)],
      replace,
    );
  };
  return (
    <div className="colour-picker">
      <div
        className="colour-plane"
        role="slider"
        tabIndex={0}
        aria-label="Colour hue and lightness"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={pick[0]}
        aria-valuetext={`Hue ${pick[0]}, lightness ${pick[2]} percent. Left and right change hue; up and down change lightness.`}
        onKeyDown={(e) => {
          if (!e.key.startsWith("Arrow")) return;
          e.preventDefault();
          change([
            (pick[0] +
              (e.key === "ArrowRight" ? 5 : e.key === "ArrowLeft" ? -5 : 0) +
              360) %
              360,
            pick[1] || 70,
            Math.max(
              0,
              Math.min(
                100,
                pick[2] +
                  (e.key === "ArrowUp" ? 5 : e.key === "ArrowDown" ? -5 : 0),
              ),
            ),
          ]);
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pointer(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) pointer(e, false, true);
        }}
      >
        <span
          className="colour-cursor"
          style={{
            left: `${(pick[0] / 359) * 100}%`,
            top: `${100 - pick[2]}%`,
            backgroundColor: `hsl(${pick[0]} ${pick[1]}% ${pick[2]}%)`,
          }}
        />
      </div>
      <div
        className="greys"
        role="slider"
        tabIndex={0}
        aria-label="Greys lightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pick[2]}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            change([
              0,
              0,
              Math.max(
                0,
                Math.min(100, pick[2] + (e.key === "ArrowRight" ? 5 : -5)),
              ),
            ]);
          }
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pointer(e, true);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) pointer(e, true, true);
        }}
      />
      <div className="colour-readout">
        <span
          style={{ backgroundColor: `hsl(${pick[0]} ${pick[1]}% ${pick[2]}%)` }}
        />
        Hue {pick[0]}° · Lightness {pick[2]}%
      </div>
      <p className="menu-note">Pick a colour. Closest artworks come first.</p>
    </div>
  );
}
export function FiltersBar({ filters }: { filters: Filters }) {
  const { meta } = useData(),
    [open, setOpen] = useState(""),
    [artistSearch, setArtistSearch] = useState(""),
    root = useRef<HTMLDivElement>(null),
    menu = useRef<HTMLDivElement>(null),
    [menuPosition, setMenuPosition] = useState({ left: 20, top: 100 });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = root.current?.querySelector('[aria-expanded="true"]');
      const node = menu.current;
      if (!trigger || !node) return;
      const box = trigger.getBoundingClientRect();
      const height = node.getBoundingClientRect().height;
      const bottom = window.innerHeight - (window.innerWidth < 640 ? 73 : 12);
      setMenuPosition({
        left: Math.max(
          20,
          Math.min(box.left, window.innerWidth - node.offsetWidth - 20),
        ),
        top: Math.max(65, Math.min(box.bottom + 8, bottom - height)),
      });
    };
    place();
    menu.current
      ?.querySelector<HTMLElement>("input,button,[tabindex]")
      ?.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    const observer = new ResizeObserver(place);
    if (menu.current) observer.observe(menu.current);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
      observer.disconnect();
    };
  }, [open]);
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (
        !root.current?.contains(e.target as Node) &&
        !menu.current?.contains(e.target as Node)
      )
        setOpen("");
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        root.current
          ?.querySelector<HTMLElement>('[aria-expanded="true"]')
          ?.focus({ preventScroll: true });
        setOpen("");
      }
    };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape);
    };
  }, []);
  if (!meta)
    return (
      <div className="filters loading-filters" aria-label="Loading filters">
        <div className="filter-controls">
          {["Subject", "Mood", "Colour", "Card type", "Year", "Artist"].map(
            (x) => (
              <span className="filter-pill" key={x}>
                {x} <span>⌄</span>
              </span>
            ),
          )}
        </div>
      </div>
    );
  const options: Record<string, [string, string][]> = {
    subject: meta.subjects.map((x) => [x.key, x.label]),
    mood: meta.moods.map((x) => [x.key, x.label]),
    type: meta.types.map((x) => [x, x]),
    year: [...new Set(meta.sets.map((x) => Math.floor(x[2] / 10) * 10))]
      .sort((a, b) => b - a)
      .map((x) => [x + "s", x + "s"]),
    artist: meta.artists.map((x) => [x[1], x[0]]),
  };
  const labels: Record<string, string> = {
    subject: "Subject",
    mood: "Mood",
    colour: "Colour",
    type: "Card type",
    year: "Year",
    artist: "Artist",
  };
  const select = (key: string, value?: string) => {
    updateURL({ [key]: value });
    root.current
      ?.querySelector<HTMLElement>(`[aria-controls="filter-${key}"]`)
      ?.focus({ preventScroll: true });
    setOpen("");
  };
  return (
    <div className="filters" ref={root}>
      <div className="filter-controls">
        {Object.entries(labels).map(([key, label]) => {
          const value = filters[key as keyof Filters],
            current = options[key]?.find((x) => x[0] === value)?.[1];
          return (
            <div className="filter-wrap" key={key}>
              <button
                className={`filter-pill ${value ? "active" : ""}`}
                aria-expanded={open === key}
                aria-controls={"filter-" + key}
                onClick={() => setOpen(open === key ? "" : key)}
              >
                {key === "colour" && value && (
                  <span
                    className="pill-swatch"
                    style={{
                      backgroundColor: `hsl(${value.split(",")[0]} ${value.split(",")[1]}% ${value.split(",")[2]}%)`,
                    }}
                  />
                )}
                {current || label}
                <span className="chevron" aria-hidden="true">
                  ⌄
                </span>
              </button>
              {open === key &&
                createPortal(
                  <div
                    ref={menu}
                    style={menuPosition}
                    className={`filter-menu ${key === "colour" ? "colour-menu" : ""}`}
                    id={"filter-" + key}
                  >
                    {key === "colour" ? (
                      <>
                        <ColourPicker
                          value={value?.split(",").map(Number)}
                          onChange={(v, replace) =>
                            updateURL({ colour: v.join(",") }, replace)
                          }
                        />
                        {value && (
                          <button
                            className="menu-option"
                            onClick={() => select(key)}
                          >
                            Clear colour
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {key === "artist" && (
                          <input
                            autoFocus
                            className="menu-search"
                            aria-label="Search artists"
                            placeholder="Search artists…"
                            value={artistSearch}
                            onChange={(e) => setArtistSearch(e.target.value)}
                          />
                        )}
                        <div className="menu-options">
                          <button
                            className={
                              !value ? "menu-option chosen" : "menu-option"
                            }
                            onClick={() => select(key)}
                          >
                            All{" "}
                            {key === "type"
                              ? "card types"
                              : key === "year"
                                ? "years"
                                : label.toLowerCase() + "s"}
                          </button>
                          {options[key]
                            .filter(
                              (x) =>
                                key !== "artist" ||
                                x[1]
                                  .toLowerCase()
                                  .includes(artistSearch.toLowerCase()),
                            )
                            .slice(0, key === "artist" ? 70 : 100)
                            .map(([v, l]) => (
                              <button
                                className={
                                  value === v
                                    ? "menu-option chosen"
                                    : "menu-option"
                                }
                                key={v}
                                onClick={() => select(key, v)}
                              >
                                {l}
                                {value === v && <span>✓</span>}
                              </button>
                            ))}
                          {key === "year" && (
                            <label className="exact-year">
                              Exact year
                              <input
                                type="number"
                                placeholder="e.g. 2003"
                                min="1993"
                                max="2100"
                                value={
                                  value && !value.endsWith("s") ? value : ""
                                }
                                onChange={(e) =>
                                  updateURL({
                                    year: e.target.value || undefined,
                                  })
                                }
                              />
                            </label>
                          )}
                        </div>
                      </>
                    )}
                  </div>,
                  document.body,
                )}
            </div>
          );
        })}
        <div className="filter-spacer" />
        {Object.keys(filters).some(
          (k) => filterKeys.includes(k) && k !== "sort" && k !== "seed",
        ) && (
          <button
            className="clear-filters"
            onClick={() =>
              updateURL(
                Object.fromEntries(filterKeys.map((k) => [k, undefined])),
              )
            }
          >
            Clear
          </button>
        )}
        <label className="sort-label">
          <span className="sr-only">Sort artworks</span>
          <select
            aria-label="Sort artworks"
            value={filters.sort || "newest"}
            onChange={(e) =>
              updateURL({
                sort: e.target.value === "newest" ? undefined : e.target.value,
                seed:
                  e.target.value === "random"
                    ? String(Math.floor(Math.random() * 1e8))
                    : undefined,
              })
            }
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="colour">Colour</option>
            <option value="random">Random</option>
          </select>
          <span aria-hidden="true">↓</span>
        </label>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="m16 16 5 5" />
    </svg>
  );
}

export function NavFilters() {
  const params = useURL();
  const [shown, setShown] = useState(false);
  const filters = Object.fromEntries(
    filterKeys.flatMap((k) => (params.has(k) ? [[k, params.get(k)!]] : [])),
  ) as Filters;
  useEffect(() => {
    const check = () => setShown(window.scrollY > window.innerHeight * 0.5);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);
  return (
    <div className="nav-filters" data-shown={shown}>
      <FiltersBar filters={filters} />
    </div>
  );
}
