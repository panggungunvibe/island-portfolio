// Free navigation on a bounded island. No visible paths or fixed node graph.
export const WALK_RADIUS = 11.7;
export const PLAYER_RADIUS = 0.38;
export const SPAWN = [0, 7.9];
export const PORTAL_RADIUS = 1.65;
export const CAMERA_LIMITS = {
  minDistance: 23,
  maxDistance: 46,
  minPolar: Math.PI * 0.12,
  maxPolar: Math.PI * 0.37,
};
export function clampToIsland(p, r = WALK_RADIUS) {
  const d = Math.hypot(...p);
  return d > r ? p.map((v) => (v / d) * r) : [...p];
}
export function isWalkable(p, obstacles = [], padding = PLAYER_RADIUS) {
  return (
    Math.hypot(...p) <= WALK_RADIUS &&
    obstacles.every((o) => Math.hypot(p[0] - o.x, p[1] - o.z) > o.r + padding)
  );
}
export function clearSegment(a, b, obstacles = []) {
  const distance = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = Math.ceil(distance / 0.16);
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    if (
      !isWalkable(
        [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        obstacles,
      )
    )
      return false;
  }
  return true;
}
export function nearestWalkable(p, obstacles = []) {
  p = clampToIsland(p);
  if (isWalkable(p, obstacles)) return p;
  for (let r = 0.2; r < 4; r += 0.2)
    for (let i = 0; i < 24; i++) {
      let a = (i / 24) * Math.PI * 2,
        q = clampToIsland([p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r]);
      if (isWalkable(q, obstacles)) return q;
    }
  return null;
}
export function findRoute(start, destination, obstacles = []) {
  const end = nearestWalkable(destination, obstacles);
  if (!end) return [];
  if (clearSegment(start, end, obstacles)) return [end];
  const step = 0.45,
    toCell = (p) => p.map((v) => Math.round(v / step)),
    fromCell = (p) => p.map((v) => v * step),
    key = (p) => p.join(",");
  let startCell = toCell(start),
    endCell = toCell(end),
    endKey = key(endCell),
    open = [{ p: startCell, g: 0, f: 0 }],
    best = new Map([[key(startCell), 0]]),
    previous = new Map(),
    closed = new Set();
  let found = null,
    tries = 0;
  while (open.length && tries++ < 8000) {
    open.sort((a, b) => a.f - b.f);
    let cur = open.shift(),
      ck = key(cur.p);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (
      ck === endKey ||
      (Math.hypot(cur.p[0] - endCell[0], cur.p[1] - endCell[1]) <= 1 &&
        clearSegment(fromCell(cur.p), end, obstacles))
    ) {
      found = cur.p;
      break;
    }
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        let n = [cur.p[0] + dx, cur.p[1] + dz],
          nk = key(n),
          g = cur.g + Math.hypot(dx, dz);
        if (
          closed.has(nk) ||
          g >= (best.get(nk) ?? Infinity) ||
          !clearSegment(fromCell(cur.p), fromCell(n), obstacles)
        )
          continue;
        best.set(nk, g);
        previous.set(nk, cur.p);
        open.push({
          p: n,
          g,
          f: g + Math.hypot(n[0] - endCell[0], n[1] - endCell[1]),
        });
      }
  }
  if (!found) return [];
  let raw = [end],
    cur = found;
  while (key(cur) !== key(startCell)) {
    raw.unshift(fromCell(cur));
    cur = previous.get(key(cur));
    if (!cur) return [];
  }
  raw.unshift(start);
  const smooth = [];
  let i = 0;
  while (i < raw.length - 1) {
    let j = raw.length - 1;
    while (j > i + 1 && !clearSegment(raw[i], raw[j], obstacles)) j--;
    smooth.push(raw[j]);
    i = j;
  }
  return smooth;
}
export function slideStep(position, delta, obstacles = []) {
  let end = clampToIsland([position[0] + delta[0], position[1] + delta[1]]);
  if (clearSegment(position, end, obstacles)) return end;
  let x = clampToIsland([position[0] + delta[0], position[1]]);
  if (clearSegment(position, x, obstacles)) return x;
  let z = clampToIsland([position[0], position[1] + delta[1]]);
  return clearSegment(position, z, obstacles) ? z : position;
}
export function portalAt(position, sites) {
  return sites.findIndex(
    (s) =>
      Math.hypot(position[0] - s.arrival[0], position[1] - s.arrival[1]) <
      PORTAL_RADIUS,
  );
}
