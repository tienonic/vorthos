export function prepare(raw, meta) {
  const data = { ...raw };
  for (const key of ["artist", "set", "moods", "hsl"])
    data[key] = new Uint16Array(raw[key]);
  for (const key of ["face", "type", "subject"])
    data[key] = new Uint8Array(raw[key]);
  data.years = Uint16Array.from(
    { length: raw.n },
    (_, i) => meta.sets[raw.set[i]][2],
  );
  return data;
}
export function colourDistance(h, s, l, pick) {
  const delta = Math.min(Math.abs(h - pick[0]), 360 - Math.abs(h - pick[0]));
  return (
    (delta / 1.8) ** 2 * (s / 100) * (pick[1] / 100) +
    ((s - pick[1]) * 0.6) ** 2 +
    ((l - pick[2]) * 1.5) ** 2
  );
}
export function query(data, q = {}, scores, moodCount = 0) {
  const start = performance.now(),
    found = [],
    keys = new Float64Array(data.n),
    counts = new Uint32Array(1 << (q.vennMoods?.length || 0));
  const search = q.search?.trim().toLocaleLowerCase();
  const hasColour = q.colour?.length === 3 && q.colour.every(Number.isFinite);
  for (let i = 0; i < data.n; i++) {
    if (search && !data.name[i].toLocaleLowerCase().includes(search)) continue;
    if (
      (q.subject >= 0 && data.subject[i] !== q.subject) ||
      (q.type >= 0 && data.type[i] !== q.type) ||
      (q.artist >= 0 && data.artist[i] !== q.artist) ||
      (q.mood >= 0 && !(data.moods[i] & (1 << q.mood)))
    )
      continue;
    const year = data.years[i];
    if (
      q.year &&
      (q.year.endsWith("s")
        ? Math.floor(year / 10) * 10 !== parseInt(q.year)
        : year !== Number(q.year))
    )
      continue;
    let strength = 0;
    if (q.vennMoods?.length) {
      let mask = 0;
      q.vennMoods.forEach((m, j) => {
        if (data.moods[i] & (1 << m)) mask |= 1 << j;
        strength += scores?.[i * moodCount + m] || 0;
      });
      counts[mask]++;
      if (q.region !== undefined && mask !== q.region) continue;
    }
    const h = data.hsl[i * 3],
      s = data.hsl[i * 3 + 1],
      l = data.hsl[i * 3 + 2];
    const distance = hasColour ? colourDistance(h, s, l, q.colour) : 0;
    if (hasColour && q.metric !== "hue" && distance > 1700) continue;
    let key = i;
    if (q.metric === "hue") {
      const delta = Math.min(
        Math.abs(h - q.colour[0]),
        360 - Math.abs(h - q.colour[0]),
      );
      if (s < 40 || l < 20 || l > 85) continue;
      key = delta * 6 - s + Math.abs(l - 50);
    } else if (hasColour) key = distance;
    else if (q.metric === "dark") key = l;
    else if (q.metric === "light") key = -l;
    else if (q.metric === "saturated") key = -s;
    else if (q.vennMoods?.length && scores) key = -strength;
    else if (q.sort === "oldest") key = -i;
    else if (q.sort === "colour") key = h * 10201 + l * 101 + s;
    else if (q.sort === "random") {
      let x = Math.imul(i ^ (q.seed || 42), 0x45d9f3b);
      x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
      key = (x ^ (x >>> 16)) >>> 0;
    }
    keys[i] = key;
    found.push(i);
  }
  const ids = Uint32Array.from(found);
  ids.sort((a, b) => keys[a] - keys[b] || a - b);
  return {
    ids: q.limit ? ids.slice(0, q.limit) : ids,
    counts,
    ms: performance.now() - start,
    total: ids.length,
  };
}
