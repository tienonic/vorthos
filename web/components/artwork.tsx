"use client";
import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useData } from "./data-provider";
import { useURL, updateURL } from "@/lib/url";
import { BASE } from "@/lib/types";
import { ArtImage } from "./grid";
export function ArtworkOverlay() {
  const { art, meta, full } = useData(),
    params = useURL(),
    dialog = useRef<HTMLDialogElement>(null),
    selected = params.get("art"),
    face = Number(params.get("face") || 0);
  const index = useMemo(
    () =>
      selected && art
        ? art.id.findIndex((id, i) => id === selected && art.face[i] === face)
        : -1,
    [selected, face, art],
  );
  const close = () => updateURL({ art: undefined, face: undefined }, true);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (selected) {
      if (!node.open) node.showModal();
      const overflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = overflow;
        if (node.open) node.close();
      };
    }
    if (node.open) node.close();
  }, [selected]);
  if (!selected) return null;
  const a = art && index >= 0 && meta ? meta.artists[art.artist[index]] : null,
    s = art && index >= 0 && meta ? meta.sets[art.set[index]] : null;
  const filterLink = (values: Record<string, string>) =>
    "/?" + new URLSearchParams(values).toString();
  const goFilter = (e: React.MouseEvent, values: Record<string, string>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (location.pathname === BASE + "/" || location.pathname === BASE) {
      e.preventDefault();
      updateURL({
        search: undefined,
        subject: undefined,
        mood: undefined,
        type: undefined,
        year: undefined,
        artist: undefined,
        colour: undefined,
        sort: undefined,
        seed: undefined,
        art: undefined,
        face: undefined,
        ...values,
      });
    } else close();
  };
  return (
    <dialog
      ref={dialog}
      className="art-dialog"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      aria-labelledby="artwork-title"
    >
      <div className="art-breadcrumb">
        <div className="page-width">
          <button onClick={close}>Collection</button>
          <span>›</span>
          <span>{art && index >= 0 ? art.name[index] : "Artwork"}</span>
          <button
            className="close-button"
            onClick={close}
            aria-label="Close artwork"
            autoFocus
          >
            ×
          </button>
        </div>
      </div>
      <div className="art-dialog-inner page-width">
        {art && meta && a && s && index >= 0 ? (
          <>
            <div className="large-art">
              <ArtImage art={art} index={index} priority />
            </div>
            <div className="art-details">
              <h2 id="artwork-title">{art.name[index]}</h2>
              <p className="detail-set">{s[2]}</p>
              <dl className="stats">
                <div>
                  <dt>Artist</dt>
                  <dd>
                    <Link
                      href={filterLink({ artist: a[1] })}
                      onClick={(e) => goFilter(e, { artist: a[1] })}
                    >
                      {a[0]}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt>Set</dt>
                  <dd>
                    {s[1]} ({s[0].toUpperCase()})
                  </dd>
                </div>
                <div>
                  <dt>Year</dt>
                  <dd>{s[2]}</dd>
                </div>
                <div>
                  <dt>Card type</dt>
                  <dd>{meta.types[art.type[index]]}</dd>
                </div>
                <div>
                  <dt>Subject</dt>
                  <dd>
                    <Link
                      href={filterLink({
                        subject: meta.subjects[art.subject[index]].key,
                      })}
                      onClick={(e) =>
                        goFilter(e, {
                          subject: meta.subjects[art.subject[index]].key,
                        })
                      }
                    >
                      {meta.subjects[art.subject[index]].label}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt>Mood</dt>
                  <dd>
                    {meta.moods.some((_, j) => art.moods[index] & (1 << j))
                      ? meta.moods.map((m, j) =>
                          art.moods[index] & (1 << j) ? (
                            <Link
                              key={m.key}
                              href={filterLink({ mood: m.key })}
                              onClick={(e) => goFilter(e, { mood: m.key })}
                            >
                              {m.label}
                            </Link>
                          ) : null,
                        )
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Palette</dt>
                  <dd className="swatches">
                    {Array.from({ length: 3 }, (_, j) => {
                      const hex = art.pal[index * 3 + j];
                      return (
                        <Link
                          key={j}
                          href={filterLink({ colour: hexToHsl(hex).join(",") })}
                          onClick={(e) =>
                            goFilter(e, { colour: hexToHsl(hex).join(",") })
                          }
                          style={{ backgroundColor: "#" + hex }}
                          aria-label={`Find art near colour #${hex}`}
                          title={"#" + hex}
                        />
                      );
                    })}
                  </dd>
                </div>
                <div>
                  <dt>Dominant colour</dt>
                  <dd>
                    {art.hsl[index * 3]}° hue · {art.hsl[index * 3 + 1]}%
                    saturation · {art.hsl[index * 3 + 2]}% light
                  </dd>
                </div>
              </dl>
              <a
                className="detail-source"
                href={`https://scryfall.com/card/${art.id[index]}`}
                target="_blank"
                rel="noreferrer"
              >
                View on Scryfall ↗
              </a>
            </div>
          </>
        ) : (
          <div className="empty">
            <h2 id="artwork-title">
              {full ? "Artwork not found" : "Loading artwork…"}
            </h2>
            {full && (
              <p>
                This link may belong to a different version of the collection.
              </p>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
function hexToHsl(hex: string) {
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255),
    max = Math.max(...rgb),
    min = Math.min(...rgb),
    d = max - min,
    l = (max + min) / 2;
  let h = 0;
  if (d)
    h =
      max === rgb[0]
        ? (rgb[1] - rgb[2]) / d + (rgb[1] < rgb[2] ? 6 : 0)
        : max === rgb[1]
          ? (rgb[2] - rgb[0]) / d + 2
          : (rgb[0] - rgb[1]) / d + 4;
  return [
    Math.round(h * 60),
    Math.round(d ? (d / (1 - Math.abs(2 * l - 1))) * 100 : 0),
    Math.round(l * 100),
  ];
}
