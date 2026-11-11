export type Meta = {
  generated: string;
  n: number;
  artists: [string, string, number][];
  sets: [string, string, number][];
  types: string[];
  subjects: { key: string; label: string; count: number }[];
  moods: { key: string; label: string; count: number }[];
};
export type Art = {
  n: number;
  id: string[];
  face: ArrayLike<number>;
  name: string[];
  artist: ArrayLike<number>;
  set: ArrayLike<number>;
  type: ArrayLike<number>;
  subject: ArrayLike<number>;
  moods: ArrayLike<number>;
  hsl: ArrayLike<number>;
  pal: string[];
};
export type Query = {
  search?: string;
  subject?: number;
  mood?: number;
  type?: number;
  artist?: number;
  year?: string;
  colour?: number[];
  sort?: string;
  seed?: number;
  vennMoods?: number[];
  region?: number;
  metric?: string;
  limit?: number;
};
export type Filters = {
  search?: string;
  subject?: string;
  mood?: string;
  type?: string;
  artist?: string;
  year?: string;
  colour?: string;
  sort?: string;
  seed?: string;
};
export const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? "/vorthos").replace(
  /\/$/,
  "",
);
export const imageURL = (art: Art, i: number) =>
  `https://cards.scryfall.io/art_crop/${art.face[i] ? "back" : "front"}/${art.id[i][0]}/${art.id[i][1]}/${art.id[i]}.jpg`;
export const number = (n: number) => n.toLocaleString("en-US");
export function toQuery(f: Filters, m: Meta): Query {
  return {
    search: f.search,
    subject: m.subjects.findIndex((x) => x.key === f.subject),
    mood: m.moods.findIndex((x) => x.key === f.mood),
    type: m.types.indexOf(f.type || ""),
    artist: m.artists.findIndex((x) => x[1] === f.artist),
    year: f.year,
    colour: f.colour?.split(",").map(Number),
    sort: f.sort || "newest",
    seed: Number(f.seed || 42),
  };
}
