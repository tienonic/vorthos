"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Art, imageURL, number } from "@/lib/types";
import { useData } from "./data-provider";
import { updateURL } from "@/lib/url";
export function ArtImage({
  art,
  index,
  priority = false,
}: {
  art: Art;
  index: number;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    const node = image.current;
    if (node?.complete && node.naturalWidth)
      node
        .decode()
        .catch(() => {})
        .then(() => setLoaded(true));
  }, [art.id[index], art.face[index]]);
  return (
    <div
      className="art-image"
      style={{
        backgroundColor: `hsl(${art.hsl[index * 3]} ${art.hsl[index * 3 + 1]}% ${art.hsl[index * 3 + 2]}%)`,
      }}
    >
      <img
        ref={image}
        src={imageURL(art, index)}
        alt={art.name[index]}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        className={loaded ? "decoded" : ""}
        onLoad={async (e) => {
          await e.currentTarget.decode().catch(() => {});
          setLoaded(true);
        }}
        onError={() => setFailed(true)}
      />
      {failed && <span className="image-error">Image unavailable</span>}
    </div>
  );
}
export function ArtTile({
  index,
  priority = false,
}: {
  index: number;
  priority?: boolean;
}) {
  const { art, meta } = useData();
  if (!art || !meta || index >= art.n) return null;
  const a = meta.artists[art.artist[index]],
    s = meta.sets[art.set[index]];
  return (
    <a
      className="art-tile"
      data-art={index}
      href={`?art=${art.id[index]}${art.face[index] ? "&face=1" : ""}`}
      onClick={(e) => {
        if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
          return;
        e.preventDefault();
        updateURL({
          art: art.id[index],
          face: art.face[index] ? "1" : undefined,
        });
      }}
      aria-label={`${art.name[index]}, by ${a[0]}`}
    >
      <ArtImage art={art} index={index} priority={priority} />
      <div className="tile-caption">
        <h3>{art.name[index]}</h3>
        <p className="tile-artist">{a[0]}</p>
        <p className="tile-set">
          {s[0].toUpperCase()} <span>·</span> {s[2]}
        </p>
      </div>
    </a>
  );
}
export function VirtualGrid({
  ids,
  label = "Artworks",
}: {
  ids: Uint32Array;
  label?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const [view, setView] = useState({
    width: 1200,
    scroll: 0,
    height: 900,
    top: 0,
  });
  useLayoutEffect(() => {
    const node = container.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        setView({
          width: rect.width,
          scroll: window.scrollY,
          height: window.innerHeight,
          top: rect.top + window.scrollY,
        });
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);
  useLayoutEffect(() => {
    if (pendingFocus.current === null) return;
    const tile = container.current?.querySelector<HTMLElement>(
      `[data-art="${pendingFocus.current}"]`,
    );
    if (tile) {
      tile.focus({ preventScroll: true });
      pendingFocus.current = null;
    }
  }, [view, ids]);
  const columns =
      view.width < 560 ? 2 : view.width < 800 ? 3 : view.width < 1100 ? 4 : 5,
    gap = view.width < 560 ? 12 : 20;
  const tileWidth = (view.width - gap * (columns - 1)) / columns,
    rowHeight = tileWidth * 0.75 + 91 + gap,
    rows = Math.ceil(ids.length / columns);
  const start = Math.max(
      0,
      Math.floor((view.scroll - view.top) / rowHeight) - 2,
    ),
    end = Math.min(
      rows,
      Math.ceil((view.scroll + view.height - view.top) / rowHeight) + 2,
    );
  const navigate = (e: React.KeyboardEvent) => {
    const tile = (e.target as HTMLElement).closest<HTMLElement>("[data-art]");
    if (!tile) return;
    const at = ids.indexOf(Number(tile.dataset.art)),
      steps: Record<string, number> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -columns,
        ArrowDown: columns,
      };
    let next = at;
    if (e.key in steps)
      next = Math.max(0, Math.min(ids.length - 1, at + steps[e.key]));
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ids.length - 1;
    else return;
    e.preventDefault();
    const top = view.top + Math.floor(next / columns) * rowHeight;
    if (
      top < window.scrollY + 80 ||
      top + rowHeight > window.scrollY + window.innerHeight - 70
    )
      window.scrollTo({ top: Math.max(0, top - 90), behavior: "instant" });
    pendingFocus.current = ids[next];
    setView((previous) => ({ ...previous, scroll: window.scrollY }));
  };
  return (
    <div
      ref={container}
      onKeyDown={navigate}
      className="virtual-grid"
      role="region"
      aria-label={label}
      data-rendered={Math.max(0, end - start) * columns}
      style={{ height: rows * rowHeight }}
    >
      {ids.length === 0 ? (
        <div className="empty">
          <h3>No artworks here yet.</h3>
          <p>Try another colour or fewer filters.</p>
        </div>
      ) : (
        Array.from({ length: Math.max(0, end - start) }, (_, r) => {
          const row = start + r;
          return (
            <div
              className="art-row"
              key={row}
              style={{
                top: row * rowHeight,
                gap,
                gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`,
              }}
            >
              {Array.from(
                ids.slice(row * columns, (row + 1) * columns),
                (index) => (
                  <ArtTile key={index} index={index} priority={row === 0} />
                ),
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
export function Count({ count, ms }: { count: number; ms?: number }) {
  const { full, meta } = useData();
  return (
    <div className="count-line" data-query-ms={ms} data-full={full}>
      <span>
        <strong>{number(count)}</strong> {count === 1 ? "artwork" : "artworks"}{" "}
        {!full && meta && (
          <span className="loading-note">· Loading the rest…</span>
        )}
      </span>
    </div>
  );
}
export function ArtRow({ ids }: { ids: Uint32Array }) {
  return (
    <div className="horizontal-art">
      {Array.from(ids, (i) => (
        <ArtTile key={i} index={i} />
      ))}
    </div>
  );
}
