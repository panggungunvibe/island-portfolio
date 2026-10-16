import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { categories, themes } from "./content.js";
import {
  WALK_RADIUS,
  SPAWN,
  CAMERA_LIMITS,
  findRoute,
  slideStep,
  portalAt,
} from "./navigation.js";
import {
  mat,
  mesh,
  ball,
  cyl,
  rod,
  torus,
  group,
  makeHiker,
  animateHiker,
  pine,
  roundTree,
  palm,
  cactus,
  coral,
  landmark,
  fish,
} from "./models.js";
const TAU = Math.PI * 2,
  RADIUS = 13.8;
export const POND = { x: -1.15, z: -0.65, r: 1.8 };
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  let y =
    0.15 +
    1.65 * Math.max(0, 1 - (r / RADIUS) ** 2) +
    0.06 * Math.sin(x * 0.55) * Math.cos(z * 0.7);
  const d = Math.hypot(x - POND.x, z - POND.z);
  if (d < 2.15) {
    const t = T.MathUtils.smoothstep(d, 1.5, 2.15);
    y = 0.94 * (1 - t) + y * t;
  }
  return y;
}
const randFactory =
  (seed = 42) =>
  () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
export function buildObstacleMap() {
  const random = randFactory(83),
    trees = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU + (random() - 0.5) * 0.12,
      r = 10.85 + random() * 1.9;
    trees.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      r: 0.42,
      scale: 0.7 + random() * 0.45,
      type: i % 3,
    });
  }
  return {
    trees,
    obstacles: [
      { ...POND, r: 2.05 },
      ...categories.map((c) => ({
        x: c.position[0],
        z: c.position[1],
        r: 1.35,
      })),
      ...trees
        .filter((t) => Math.hypot(t.x, t.z) < 12.2)
        .map((t) => ({ x: t.x, z: t.z, r: 0.4 })),
    ],
  };
}
function mergeScenery(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const list = groups.get(o.material) || [];
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    list.push(geo);
    groups.set(o.material, list);
  });
  root.clear();
  for (const [material, geos] of groups) {
    const geometry = mergeGeometries(geos, false);
    if (geometry) {
      const m = new T.Mesh(geometry, material);
      m.castShadow = true;
      m.receiveShadow = true;
      root.add(m);
    }
    geos.forEach((g) => g.dispose());
  }
}
export function createIsland(
  container,
  { onReady, onArrive, onLeave, onMove, onTheme, onBoundary } = {},
) {
  const renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute(
    "aria-label",
    "可拖动环顾的三维岛屿，点击地面行走",
  );
  renderer.domElement.tabIndex = 0;
  const scene = new T.Scene();
  scene.background = new T.Color(themes.forest.background);
  scene.fog = new T.Fog(themes.forest.background, 65, 135);
  const camera = new T.PerspectiveCamera(
      innerWidth < 700 ? 55 : 38,
      innerWidth / innerHeight,
      0.1,
      180,
    ),
    controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.8, 0);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.7;
  controls.minDistance = CAMERA_LIMITS.minDistance;
  controls.maxDistance = CAMERA_LIMITS.maxDistance;
  controls.minPolarAngle = CAMERA_LIMITS.minPolar;
  controls.maxPolarAngle = CAMERA_LIMITS.maxPolar;
  const hemi = new T.HemisphereLight("#f1fcff", "#96b9a4", 1.5);
  scene.add(hemi);
  const sun = new T.DirectionalLight("#fff2d5", 2.4);
  sun.position.set(-12, 25, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -20,
    right: 20,
    top: 20,
    bottom: -20,
    near: 1,
    far: 65,
  });
  sun.shadow.normalBias = 0.03;
  sun.shadow.bias = -0.00012;
  sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new T.DirectionalLight("#c5e7f2", 0.8);
  fill.position.set(15, 8, -12);
  scene.add(fill);
  const { trees, obstacles } = buildObstacleMap(),
    biomes = {},
    propRoots = {},
    animated = {};
  const topGeo = new T.CircleGeometry(RADIUS, 112); // replace fan with concentric rings for a gently curved walkable surface
  const verts = [0, groundHeight(0, 0), 0],
    uvs = [0.5, 0.5],
    indices = [];
  const sectors = 112,
    rings = 40;
  for (let j = 1; j <= rings; j++)
    for (let i = 0; i < sectors; i++) {
      const a = (i / sectors) * TAU,
        r = (j / rings) * RADIUS,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      verts.push(x, groundHeight(x, z), z);
      uvs.push(x / RADIUS / 2 + 0.5, z / RADIUS / 2 + 0.5);
    }
  for (let i = 0; i < sectors; i++)
    indices.push(0, 1 + ((i + 1) % sectors), 1 + i);
  for (let j = 1; j < rings; j++)
    for (let i = 0; i < sectors; i++) {
      const a = 1 + (j - 1) * sectors + i,
        b = 1 + (j - 1) * sectors + ((i + 1) % sectors),
        c = 1 + j * sectors + i,
        d = 1 + j * sectors + ((i + 1) % sectors);
      indices.push(a, b, c, b, d, c);
    }
  const landGeo = new T.BufferGeometry();
  landGeo.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
  landGeo.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  landGeo.setIndex(indices);
  landGeo.computeVertexNormals();
  topGeo.dispose();
  const landMat = mat("#8db86e", { roughness: 1 }),
    land = new T.Mesh(landGeo, landMat);
  land.receiveShadow = true;
  scene.add(land);
  const sandMat = mat("#dfd1ae"),
    bank = mesh(
      scene,
      new T.CylinderGeometry(14.15, 13.9, 0.42, 112),
      sandMat,
      [0, -0.1, 0],
    );
  bank.receiveShadow = true;
  const earth = mesh(
    scene,
    new T.CylinderGeometry(13.9, 12.7, 1.2, 112),
    mat("#b4b590"),
    [0, -0.75, 0],
  );
  // Soft animated water, foam and scattered glints extend beyond the finite island.
  const waterMat = new T.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new T.Color(themes.forest.water) },
    },
    vertexShader: `varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float time;uniform vec3 color;varying vec3 vP;void main(){vec2 p=vP.xz;float r=length(p);float waves=sin(r*2.7-time*.55+sin(atan(p.y,p.x)*7.)*.18)*.5+.5;float shore=exp(-pow((r-14.75)/.65,2.));float rings=pow(waves,15.)*exp(-max(0.,r-14.)*.09);float glint=pow(max(0.,sin(p.x*.9+time*.12)*cos(p.y*.8-time*.1)),24.);vec3 c=color+vec3(.12,.15,.13)*(rings*.5+glint*.2)+shore*vec3(.16,.16,.11);float far=smoothstep(30.,90.,r);c=mix(c,vec3(.79,.9,.91),far*.6);gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
  });
  const ocean = mesh(
    scene,
    new T.PlaneGeometry(240, 240).rotateX(-Math.PI / 2),
    waterMat,
    [0, -0.7, 0],
  );
  ocean.castShadow = false;
  const lakeMat = new T.MeshStandardMaterial({
    color: "#7cc9c7",
    roughness: 0.2,
    metalness: 0.12,
  });
  const lake = mesh(
    scene,
    new T.CircleGeometry(1.87, 64).rotateX(-Math.PI / 2),
    lakeMat,
    [POND.x, 1.12, POND.z],
  );
  lake.castShadow = false;
  const lakeRings = [];
  for (let i = 0; i < 3; i++) {
    const ring = torus(
      scene,
      mat("#e2f3d7", { transparent: true, opacity: 0.3 }),
      [POND.x + 0.25, 1.13 + i * 0.002, POND.z],
      0.3 + i * 0.4,
      0.008,
    );
    ring.rotation.x = -Math.PI / 2;
    lakeRings.push(ring);
  }
  const rocks = [];
  const random = randFactory(217);
  for (let i = 0; i < 50; i++) {
    let a = (i / 50) * TAU,
      r = 13.3 + random() * 0.4;
    rocks.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      s: 0.28 + random() * 0.38,
    });
  }
  const palette = {
    forest: {
      tree: ["#72a481", "#a3c47b"],
      ground: "#8db86e",
      sand: "#e3d6af",
      rock: "#c6c7af",
      flower: ["#efc5bb", "#e8d9a6", "#b5c8d4"],
    },
    desert: {
      tree: ["#b2bb86", "#c8c8a0"],
      ground: "#e1c394",
      sand: "#eed8b5",
      rock: "#d4b99c",
      flower: ["#d6a1a0", "#d9b8c4", "#d5cd99"],
    },
    ocean: {
      tree: ["#7badb1", "#a2c9c5"],
      ground: "#b3bbd3",
      sand: "#d9d3d9",
      rock: "#b7bfd2",
      flower: ["#ba99c8", "#d5a5bc", "#8bb9d5"],
    },
  };
  for (const id of Object.keys(themes)) {
    const root = new T.Group(),
      scenery = new T.Group(),
      props = new T.Group();
    root.add(scenery, props);
    scene.add(root);
    biomes[id] = root;
    propRoots[id] = props;
    animated[id] = [];
    const p = palette[id],
      rng = randFactory(16);
    trees.forEach((t, i) => {
      const y = groundHeight(t.x, t.z);
      if (id === "forest") {
        if (t.type === 0) pine(scenery, t.x, y, t.z, t.scale * 0.95, "#588d7a");
        else roundTree(scenery, t.x, y, t.z, t.scale, p.tree);
      } else if (id === "desert") {
        if (i % 3 === 0) palm(scenery, t.x, y, t.z, t.scale, "#98ad8b");
        else if (i % 3 === 1) cactus(scenery, t.x, y, t.z, t.scale);
        else {
          let g = group(scenery, [t.x, y, t.z]);
          ball(g, p.rock, [0, 0.5, 0], [0.55, 0.95, 0.55]);
          ball(g, p.rock, [0.3, 0.2, 0], [0.5, 0.4, 0.4]);
        }
      } else {
        if (i % 3 === 0) palm(scenery, t.x, y, t.z, t.scale, "#82a9bf");
        else
          coral(
            scenery,
            t.x,
            y,
            t.z,
            t.scale * 1.4,
            i % 2 ? "#caa7ce" : "#9eb9cf",
          );
      }
    });
    rocks.forEach((r, i) => {
      const m = mesh(
        scenery,
        new T.IcosahedronGeometry(1, 1),
        p.rock,
        [r.x, groundHeight(r.x, r.z) + r.s * 0.25, r.z],
        [r.s, r.s * 0.55, r.s * 0.8],
      );
      m.rotation.set(i, 0.4 * i, 0);
    });
    // Plant beds stay out of the central open walking area and arrival circles.
    for (let i = 0; i < 230; i++) {
      let a = rng() * TAU,
        r = 3 + rng() * 9.8,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      if (
        Math.hypot(x - POND.x, z - POND.z) < 2.4 ||
        categories.some(
          (c) =>
            Math.hypot(x - c.arrival[0], z - c.arrival[1]) < 1.25 ||
            Math.hypot(x - c.position[0], z - c.position[1]) < 1.8,
        )
      )
        continue;
      const y = groundHeight(x, z);
      if (i % 4 === 0) {
        const f = group(scenery, [x, y, z]),
          height = 0.18 + rng() * 0.18;
        rod(
          f,
          id === "ocean" ? "#92a9b7" : "#8eaa77",
          [0, 0, 0],
          [0, height, 0],
          0.013,
        );
        for (let j = 0; j < 5; j++)
          ball(
            f,
            p.flower[i % 3],
            [
              Math.cos((j * TAU) / 5) * 0.06,
              height,
              Math.sin((j * TAU) / 5) * 0.06,
            ],
            [0.05, 0.028, 0.05],
          );
        ball(f, "#e3bf76", [0, height + 0.01, 0], [0.025, 0.025, 0.025]);
      } else if (i % 4 === 1) {
        ball(
          scenery,
          id === "forest" ? "#a4bd82" : p.flower[i % 3],
          [x, y + 0.12, z],
          [0.16, 0.2, 0.15],
        );
      } else {
        const leaf = ball(
          scenery,
          id === "forest" ? "#95b47f" : p.tree[i % 2],
          [x, y + 0.15, z],
          [0.04, 0.21, 0.09],
        );
        leaf.rotation.z = 0.45;
      }
    }
    if (id === "forest") {
      // A tiny alpine backdrop echoes the original lake photographs without reusing their imagery.
      for (let i = 0; i < 3; i++) {
        let x = -3 + i * 1.8,
          z = -11.3,
          y = groundHeight(x, z),
          h = 1.5 + (i === 1 ? 1.2 : 0);
        mesh(
          scenery,
          new T.ConeGeometry(1, 1, 5),
          "#9bafab",
          [x, y + h * 0.5, z],
          [1.35, h, 1.3],
        );
        mesh(
          scenery,
          new T.ConeGeometry(1, 1, 5),
          "#edf0dd",
          [x, y + h * 0.84, z],
          [0.48, h * 0.32, 0.46],
        );
      }
    }
    mergeScenery(scenery);
    categories.forEach((c, i) => {
      const prop = landmark(id, i);
      prop.position.set(
        c.position[0],
        groundHeight(...c.position),
        c.position[1],
      );
      prop.rotation.y = [0.2, -0.35, 0.2, -0.25][i];
      prop.traverse((o) => {
        if (o.isMesh) o.userData.category = i;
      });
      props.add(prop);
      if (id === "ocean" && i === 0) animated[id].push(prop);
    });
    if (id === "ocean") {
      for (let i = 0; i < 6; i++) {
        const f = fish(root, i % 2 ? "#dfb88e" : "#a2c8d4", 0.35);
        f.userData.swimmer = i;
        animated[id].push(f);
      }
    }
    root.visible = id === "forest";
  }
  const beacons = [],
    labels = [...document.querySelectorAll(".camp-label")];
  const sparkGeo = new T.BufferGeometry(),
    sparkPositions = [];
  for (let i = 0; i < 180; i++)
    sparkPositions.push(
      (random() - 0.5) * 26,
      1 + random() * 3,
      (random() - 0.5) * 26,
    );
  sparkGeo.setAttribute(
    "position",
    new T.Float32BufferAttribute(sparkPositions, 3),
  );
  const sparkles = new T.Points(
    sparkGeo,
    new T.PointsMaterial({
      color: "#fff6d3",
      size: 0.045,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
  );
  scene.add(sparkles);
  categories.forEach((c, i) => {
    const [x, z] = c.arrival,
      y = groundHeight(x, z);
    const root = group(scene, [x, y + 0.06, z]);
    const ring = torus(
      root,
      mat("#fff3bc", {
        emissive: "#f4d88b",
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.9,
      }),
      [0, 0, 0],
      0.61,
      0.024,
    );
    ring.rotation.x = -Math.PI / 2;
    const disk = mesh(
      root,
      new T.CircleGeometry(0.59, 48).rotateX(-Math.PI / 2),
      new T.MeshBasicMaterial({
        color: "#fff0b6",
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
      [0, 0.005, 0],
    );
    const motes = [];
    for (let k = 0; k < 8; k++) {
      const orb = ball(
        root,
        mat("#fff4cd", { emissive: "#ffe9a5", emissiveIntensity: 1.1 }),
        [Math.cos(k) * 0.55, 0.2 + k * 0.08, Math.sin(k) * 0.55],
        [0.035, 0.035, 0.035],
      );
      orb.castShadow = false;
      motes.push(orb);
    }
    beacons.push({ root, ring, disk, motes });
  });
  const player = makeHiker();
  scene.add(player);
  let playerPosition = [...SPAWN];
  player.position.set(SPAWN[0], groundHeight(...SPAWN) + 0.06, SPAWN[1]);
  player.rotation.y = 0.25;
  const shadow = mesh(
    scene,
    new T.CircleGeometry(0.45, 32).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({
      color: "#4a6256",
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    }),
    [SPAWN[0], groundHeight(...SPAWN) + 0.015, SPAWN[1]],
  );
  shadow.castShadow = false;
  const targetMarker = torus(
    scene,
    new T.MeshBasicMaterial({
      color: "#fff6d3",
      transparent: true,
      opacity: 0.9,
    }),
    [0, 0, 0],
    0.22,
    0.025,
  );
  targetMarker.rotation.x = -Math.PI / 2;
  targetMarker.visible = false;
  let theme = "forest",
    path = [],
    near = -1,
    moveSpeed = 0,
    targetYaw = 0.25,
    walkTime = 0,
    frame = 0,
    lastTime = performance.now(),
    isOverview = false,
    overviewAnimation = null;
  const keys = new Set(),
    keyStarted = new Map(),
    keyReleaseAt = new Map(),
    touchDirection = [0, 0],
    reduced = matchMedia("(prefers-reduced-motion: reduce)"),
    raycaster = new T.Raycaster(),
    pointer = new T.Vector2();
  let pointerDown = null,
    dragging = false,
    hoverCategory = -1;
  function resetCamera(animate = true) {
    const narrow = innerWidth < 700,
      distance = narrow ? 68 : Math.max(40, 47 / camera.aspect);
    controls.minDistance = narrow ? 33 : CAMERA_LIMITS.minDistance;
    controls.maxDistance = narrow
      ? 80
      : Math.max(CAMERA_LIMITS.maxDistance, 54 / camera.aspect);
    const targetPos = new T.Vector3(19, 25, 30)
      .normalize()
      .multiplyScalar(distance)
      .add(new T.Vector3(0, 0.8, 0));
    if (animate && !reduced.matches)
      overviewAnimation = {
        from: camera.position.clone(),
        to: targetPos,
        start: performance.now(),
      };
    else {
      camera.position.copy(targetPos);
      controls.target.set(0, 0.8, 0);
      controls.update();
    }
    isOverview = true;
  }
  resetCamera(false);
  function moveTo(destination) {
    const route = findRoute(playerPosition, destination, obstacles);
    if (!route.length) {
      onBoundary?.("这里暂时走不过去，试试旁边的空地。");
      return false;
    }
    path = route;
    targetMarker.position.set(
      route.at(-1)[0],
      groundHeight(...route.at(-1)) + 0.065,
      route.at(-1)[1],
    );
    targetMarker.visible = true;
    onMove?.();
    return true;
  }
  function travelTo(index) {
    if (index < 0 || index >= categories.length) return;
    const destination = categories[index].arrival;
    if (portalAt(playerPosition, [categories[index]]) === 0) {
      near = index;
      onArrive?.(index);
      return;
    }
    moveTo(destination);
  }
  function cast(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
  }
  const canvas = renderer.domElement;
  canvas.addEventListener("pointerdown", (e) => {
    pointerDown = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragging = false;
    overviewAnimation = null;
    isOverview = false;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (
      pointerDown &&
      Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 6
    )
      dragging = true;
    if (pointerDown) return;
    cast(e);
    const hit = raycaster.intersectObjects(propRoots[theme].children, true)[0];
    hoverCategory = hit?.object.userData.category ?? -1;
    canvas.style.cursor = hoverCategory >= 0 ? "pointer" : "grab";
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!pointerDown || pointerDown.id !== e.pointerId) return;
    const moved =
      dragging ||
      Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 6;
    pointerDown = null;
    dragging = false;
    if (moved || e.button === 2) return;
    cast(e);
    const prop = raycaster.intersectObjects(propRoots[theme].children, true)[0];
    if (prop) {
      travelTo(prop.object.userData.category);
      return;
    }
    const hit = raycaster.intersectObject(land)[0];
    if (hit) moveTo([hit.point.x, hit.point.z]);
    else onBoundary?.("小岛之外是海，沿岸探索就好。");
  });
  canvas.addEventListener("pointercancel", () => {
    pointerDown = null;
    dragging = false;
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  controls.addEventListener("start", () => {
    overviewAnimation = null;
  });
  const handleKey = (e, down) => {
    if (
      document.querySelector("dialog[open]") ||
      e.target.closest?.("#work") ||
      /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey
    )
      return;
    const key = e.key.toLowerCase();
    if (
      [
        "w",
        "a",
        "s",
        "d",
        "arrowup",
        "arrowleft",
        "arrowdown",
        "arrowright",
      ].includes(key)
    ) {
      e.preventDefault();
      if (down) {
        if (!keys.has(key)) onMove?.();
        if (!keys.has(key)) keyStarted.set(key, performance.now());
        keyReleaseAt.delete(key);
        keys.add(key);
        path = [];
        targetMarker.visible = false;
      } else {
        const elapsed = performance.now() - (keyStarted.get(key) ?? 0);
        if (elapsed < 110)
          keyReleaseAt.set(key, performance.now() + 110 - elapsed);
        else keys.delete(key);
      }
    }
  };
  window.addEventListener("keydown", (e) => handleKey(e, true));
  window.addEventListener("keyup", (e) => handleKey(e, false));
  window.addEventListener("blur", () => {
    keys.clear();
    touchDirection.fill(0);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      keys.clear();
      touchDirection.fill(0);
    }
  });
  function setTheme(id) {
    if (!themes[id]) return;
    theme = id;
    for (const [k, v] of Object.entries(biomes)) v.visible = k === id;
    landMat.color.set(palette[id].ground);
    sandMat.color.set(palette[id].sand);
    earth.material.color.set(
      id === "forest" ? "#a6b393" : id === "desert" ? "#c4a883" : "#a6acc4",
    );
    waterMat.uniforms.color.value.set(themes[id].water);
    scene.background.set(themes[id].background);
    scene.fog.color.copy(scene.background);
    hemi.groundColor.set(
      id === "desert" ? "#d3bd9c" : id === "ocean" ? "#9badcd" : "#96b9a4",
    );
    lakeMat.color.set(
      id === "desert" ? "#87c0b1" : id === "ocean" ? "#7dadd1" : "#7cc9c7",
    );
    container.dataset.theme = id;
    onTheme?.(id);
  }
  let wasNarrow = innerWidth < 700;
  function resize() {
    const narrow = innerWidth < 700;
    camera.aspect = innerWidth / innerHeight;
    camera.fov = narrow ? 55 : 38;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    controls.maxDistance = narrow
      ? 80
      : Math.max(CAMERA_LIMITS.maxDistance, 54 / camera.aspect);
    if (narrow !== wasNarrow || isOverview) {
      resetCamera(false);
      wasNarrow = narrow;
    }
  }
  window.addEventListener("resize", resize);
  const vec = new T.Vector3();
  let viewOffset = 0,
    viewOffsetX = 0,
    lastViewKey = "";
  const api = {
    travelTo,
    setTheme,
    overview: () => {
      resetCamera(true);
    },
    stop: () => {
      path = [];
      keys.clear();
      touchDirection.fill(0);
      targetMarker.visible = false;
    },
    setTouchDirection(x, z) {
      touchDirection[0] = x;
      touchDirection[1] = z;
      if (x || z) {
        path = [];
        targetMarker.visible = false;
        onMove?.();
      }
    },
    dismiss() {},
    getState() {
      return {
        theme,
        position: [...playerPosition],
        moving: moveSpeed > 0.01,
        near,
        cameraAzimuth: controls.getAzimuthalAngle(),
        cameraPolar: controls.getPolarAngle(),
        distance: controls.getDistance(),
        boundary: WALK_RADIUS,
      };
    },
  };
  function render(now) {
    requestAnimationFrame(render);
    if (document.hidden) {
      lastTime = now;
      return;
    }
    const dt = Math.min((now - lastTime) / 1000, 0.04);
    lastTime = now;
    const t = now / 1000;
    for (const [key, until] of keyReleaseAt) {
      if (now >= until) {
        keys.delete(key);
        keyReleaseAt.delete(key);
      }
    }
    let dx =
        (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
        (keys.has("a") || keys.has("arrowleft") ? 1 : 0) +
        touchDirection[0],
      dz =
        (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
        (keys.has("w") || keys.has("arrowup") ? 1 : 0) +
        touchDirection[1];
    let next = playerPosition;
    if (dx || dz) {
      let len = Math.hypot(dx, dz);
      dx /= len;
      dz /= len;
      const az = controls.getAzimuthalAngle();
      next = slideStep(
        playerPosition,
        [
          (dx * Math.cos(az) + dz * Math.sin(az)) * dt * 3.2,
          (-dx * Math.sin(az) + dz * Math.cos(az)) * dt * 3.2,
        ],
        obstacles,
      );
    } else if (path.length) {
      const target = path[0],
        d = Math.hypot(
          target[0] - playerPosition[0],
          target[1] - playerPosition[1],
        );
      if (d < 0.07) {
        next = target;
        path.shift();
      } else {
        const step = Math.min(d, dt * 3.2);
        next = [
          playerPosition[0] + ((target[0] - playerPosition[0]) / d) * step,
          playerPosition[1] + ((target[1] - playerPosition[1]) / d) * step,
        ];
      }
    }
    const vx = next[0] - playerPosition[0],
      vz = next[1] - playerPosition[1],
      moving = Math.hypot(vx, vz) > 0.0001;
    if (moving) {
      targetYaw = Math.atan2(vx, vz);
      playerPosition = next;
      walkTime += dt;
    }
    moveSpeed = T.MathUtils.lerp(
      moveSpeed,
      moving ? 1 : 0,
      1 - Math.exp(-dt * 12),
    );
    player.position.set(
      playerPosition[0],
      groundHeight(...playerPosition) + 0.06,
      playerPosition[1],
    );
    let diff =
      T.MathUtils.euclideanModulo(
        targetYaw - player.rotation.y + Math.PI,
        TAU,
      ) - Math.PI;
    player.rotation.y += diff * (1 - Math.exp(-dt * 10));
    animateHiker(player, walkTime, moveSpeed, reduced.matches);
    shadow.position.set(
      playerPosition[0],
      groundHeight(...playerPosition) + 0.025,
      playerPosition[1],
    );
    if (!path.length) targetMarker.visible = false;
    const nextNear = portalAt(playerPosition, categories);
    if (nextNear !== near) {
      near = nextNear;
      container.dataset.near = String(near);
      if (near >= 0) {
        onArrive?.(near);
      } else onLeave?.();
    }
    if (overviewAnimation) {
      const p = Math.min(1, (now - overviewAnimation.start) / 800),
        ease = p * p * (3 - 2 * p);
      camera.position.lerpVectors(
        overviewAnimation.from,
        overviewAnimation.to,
        ease,
      );
      if (p === 1) overviewAnimation = null;
    }
    controls.update();
    const offsetTarget =
      innerWidth < 700 &&
      (!document.body.classList.contains("exploring") ||
        document.body.classList.contains("panel-open"))
        ? 0.21
        : 0;
    viewOffset = reduced.matches
      ? offsetTarget
      : T.MathUtils.lerp(viewOffset, offsetTarget, 1 - Math.exp(-dt * 7));
    if (Math.abs(viewOffset - offsetTarget) < 0.0001) viewOffset = offsetTarget;
    const offsetTargetX =
      innerWidth > 1100
        ? document.body.classList.contains("panel-open")
          ? 0.08
          : !document.body.classList.contains("exploring")
            ? -0.08
            : 0
        : 0;
    viewOffsetX = reduced.matches
      ? offsetTargetX
      : T.MathUtils.lerp(viewOffsetX, offsetTargetX, 1 - Math.exp(-dt * 7));
    if (Math.abs(viewOffsetX - offsetTargetX) < 0.0001)
      viewOffsetX = offsetTargetX;
    const viewKey = `${innerWidth},${innerHeight},${viewOffset.toFixed(4)},${viewOffsetX.toFixed(4)}`;
    if (viewKey !== lastViewKey) {
      if (viewOffset || viewOffsetX)
        camera.setViewOffset(
          innerWidth,
          innerHeight,
          innerWidth * viewOffsetX,
          innerHeight * viewOffset,
          innerWidth,
          innerHeight,
        );
      else camera.clearViewOffset();
      lastViewKey = viewKey;
    }
    waterMat.uniforms.time.value = reduced.matches ? 0 : t;
    sparkles.rotation.y = reduced.matches ? 0 : Math.sin(t * 0.08) * 0.025;
    lakeRings.forEach((r, i) => {
      r.scale.setScalar(reduced.matches ? 1 : 1 + Math.sin(t * 0.7 + i) * 0.12);
    });
    beacons.forEach((b, i) => {
      let pulse = reduced.matches ? 1 : 1 + Math.sin(t * 2 + i) * 0.045;
      b.ring.scale.setScalar(pulse);
      b.disk.material.opacity = 0.12 + (near === i ? 0.16 : 0);
      b.motes.forEach((m, k) => {
        if (!reduced.matches) {
          const a = t * 0.4 + (k * TAU) / 8;
          m.position.set(
            Math.cos(a) * 0.55,
            0.2 + (Math.sin(t + k) + 1) * 0.4,
            Math.sin(a) * 0.55,
          );
        }
      });
      const c = categories[i];
      vec
        .set(c.position[0], groundHeight(...c.position) + 3.15, c.position[1])
        .project(camera);
      let x = (vec.x * 0.5 + 0.5) * innerWidth,
        y = (-vec.y * 0.5 + 0.5) * innerHeight;
      const visible =
        vec.z < 1 &&
        x > 30 &&
        x < innerWidth - 30 &&
        y > 85 &&
        y < innerHeight - 85;
      labels[i].style.transform =
        `translate(-50%,-100%) translate(${x}px,${y}px)`;
      labels[i].classList.toggle("out-of-view", !visible);
      labels[i].classList.toggle("near", near === i);
      labels[i].classList.toggle("hovered", hoverCategory === i);
    });
    animated[theme].forEach((g, i) => {
      if (reduced.matches) return;
      if (g.userData.swimmer !== undefined) {
        let a = t * 0.1 + (g.userData.swimmer * TAU) / 6;
        g.position.set(
          Math.cos(a) * 15.8,
          0.2 + Math.sin(t + i) * 0.15,
          Math.sin(a) * 15.8,
        );
        g.rotation.y = -a - Math.PI / 2;
      } else
        g.position.y =
          groundHeight(...categories[0].position) + Math.sin(t * 1.3) * 0.15;
    });
    // Read-only diagnostics and minimap are driven by the same authoritative simulation state.
    if (frame % 8 === 0) {
      container.dataset.playerX = playerPosition[0].toFixed(3);
      container.dataset.playerZ = playerPosition[1].toFixed(3);
      container.dataset.moving = String(moving || path.length > 0);
      container.dataset.near = String(near);
      container.dataset.azimuth = controls.getAzimuthalAngle().toFixed(3);
      container.dataset.polar = controls.getPolarAngle().toFixed(3);
      container.dataset.distance = controls.getDistance().toFixed(2);
      container.dataset.theme = theme;
      const dot = document.getElementById("map-player");
      if (dot) {
        dot.style.left = `${50 + (playerPosition[0] / 28) * 100}%`;
        dot.style.top = `${50 + (playerPosition[1] / 28) * 100}%`;
      }
      const compass = document.getElementById("compass-needle");
      if (compass) compass.style.rotate = `${-controls.getAzimuthalAngle()}rad`;
    }
    renderer.render(scene, camera);
    if (++frame === 2) onReady?.();
  }
  requestAnimationFrame(render);
  return api;
}
