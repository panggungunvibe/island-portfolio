import { test } from "node:test";
import assert from "node:assert/strict";
import { categories, themes, profile } from "../src/content.js";
import {
  WALK_RADIUS,
  SPAWN,
  findRoute,
  clearSegment,
  isWalkable,
  slideStep,
  portalAt,
  clampToIsland,
  CAMERA_LIMITS,
} from "../src/navigation.js";
import { buildObstacleMap } from "../src/island.js";
const { obstacles } = buildObstacleMap();
test("All camps can be reached freely from spawn and each other without crossing any obstacle", () => {
  const starts = [SPAWN, ...categories.map((c) => c.arrival)];
  for (const start of starts)
    for (const c of categories) {
      const path = findRoute(start, c.arrival, obstacles);
      assert.ok(path.length, `${start} -> ${c.id}`);
      let previous = start;
      for (const p of path) {
        assert.ok(
          clearSegment(previous, p, obstacles),
          `Blocked segment toward ${c.id}`,
        );
        assert.ok(Math.hypot(...p) <= WALK_RADIUS);
        previous = p;
      }
      assert.equal(portalAt(path.at(-1), categories), categories.indexOf(c));
    }
});
test("Walking toward water/props takes a route around them rather than through them", () => {
  const start = [-5, 0],
    end = [4, 0],
    path = findRoute(start, end, obstacles);
  assert.ok(path.length > 1);
  let previous = start;
  for (const p of path) {
    assert.ok(clearSegment(previous, p, obstacles));
    previous = p;
  }
});
test("Repeated manual movement cannot leave shore boundary or enter obstacles", () => {
  for (let a = 0; a < Math.PI * 2; a += 0.3) {
    let position = SPAWN;
    for (let i = 0; i < 400; i++) {
      position = slideStep(
        position,
        [Math.cos(a) * 0.1, Math.sin(a) * 0.1],
        obstacles,
      );
      assert.ok(isWalkable(position, obstacles));
      assert.ok(Math.hypot(...position) <= WALK_RADIUS + 0.00001);
    }
  }
  assert.ok(
    Math.abs(Math.hypot(...clampToIsland([100, 100])) - WALK_RADIUS) < 0.00001,
  );
});
test("Empty space does not trigger content, arrivals trigger the matching category", () => {
  assert.equal(portalAt(SPAWN, categories), -1);
  categories.forEach((c, i) =>
    assert.equal(portalAt(c.arrival, categories), i),
  );
});
test("A click inside a landmark resolves to accessible nearby ground", () => {
  for (const c of categories) {
    const path = findRoute(SPAWN, c.position, obstacles);
    assert.ok(path.length);
    assert.ok(isWalkable(path.at(-1), obstacles));
  }
});
test("Configured modules and all three themes are available",()=>{
 assert.ok([3,4].includes(categories.length));
 assert.equal(new Set(categories.map(c=>c.id)).size,categories.length);
 assert.deepEqual(Object.keys(themes),['forest','desert','ocean']);
 assert.ok(profile.name && profile.title);
 assert.ok(CAMERA_LIMITS.minDistance < CAMERA_LIMITS.maxDistance);
});
