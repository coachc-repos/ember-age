export const WATER = 1.2;
export const CAMP = { x: 0, z: 16 };
export const WORLD_LIM = 118;

export type MatKey = "wood" | "stone" | "stick" | "berry" | "meat" | "iron" | "diamond";

export type ToolId =
  | "sword-wood"
  | "axe-wood"
  | "pick-wood"
  | "sword-stone"
  | "axe-stone"
  | "pick-stone"
  | "sword-iron"
  | "axe-iron"
  | "pick-iron"
  | "sword-diamond"
  | "axe-diamond"
  | "pick-diamond";

export type ToolKind = "sword" | "axe" | "pick";
export type ToolTier = "wood" | "stone" | "iron" | "diamond";
export type Ore = "stone" | "iron" | "diamond";

export const TIER_RANK: Record<ToolTier, number> = { wood: 0, stone: 1, iron: 2, diamond: 3 };

export interface ToolStat {
  id: ToolId;
  name: string;
  short: string;
  tier: ToolTier;
  kind: ToolKind;
  dmg: number;
  range: number;
  cd: number;
  stam: number;
  tree: number;
  rock: number;
  uses: number;
}

export const TOOLS: Record<ToolId, ToolStat> = {
  "sword-wood": {
    id: "sword-wood",
    name: "Wooden sword",
    short: "Sword",
    tier: "wood",
    kind: "sword",
    dmg: 28,
    range: 1.7,
    cd: 0.32,
    stam: 8,
    tree: 8,
    rock: 4,
    uses: 48,
  },
  "axe-wood": {
    id: "axe-wood",
    name: "Wooden axe",
    short: "Axe",
    tier: "wood",
    kind: "axe",
    dmg: 14,
    range: 1.7,
    cd: 0.4,
    stam: 12,
    tree: 54,
    rock: 6,
    uses: 48,
  },
  "pick-wood": {
    id: "pick-wood",
    name: "Wooden pickaxe",
    short: "Pick",
    tier: "wood",
    kind: "pick",
    dmg: 10,
    range: 1.6,
    cd: 0.48,
    stam: 12,
    tree: 8,
    rock: 42,
    uses: 48,
  },
  "sword-stone": {
    id: "sword-stone",
    name: "Stone sword",
    short: "Sword",
    tier: "stone",
    kind: "sword",
    dmg: 46,
    range: 1.75,
    cd: 0.3,
    stam: 9,
    tree: 10,
    rock: 8,
    uses: 96,
  },
  "axe-stone": {
    id: "axe-stone",
    name: "Stone axe",
    short: "Axe",
    tier: "stone",
    kind: "axe",
    dmg: 20,
    range: 1.75,
    cd: 0.38,
    stam: 13,
    tree: 54,
    rock: 10,
    uses: 96,
  },
  "pick-stone": {
    id: "pick-stone",
    name: "Stone pickaxe",
    short: "Pick",
    tier: "stone",
    kind: "pick",
    dmg: 14,
    range: 1.65,
    cd: 0.46,
    stam: 13,
    tree: 10,
    rock: 80,
    uses: 96,
  },
  "sword-iron": {
    id: "sword-iron",
    name: "Iron sword",
    short: "Sword",
    tier: "iron",
    kind: "sword",
    dmg: 64,
    range: 1.8,
    cd: 0.28,
    stam: 9,
    tree: 12,
    rock: 12,
    uses: 160,
  },
  "axe-iron": {
    id: "axe-iron",
    name: "Iron axe",
    short: "Axe",
    tier: "iron",
    kind: "axe",
    dmg: 28,
    range: 1.8,
    cd: 0.36,
    stam: 12,
    tree: 54,
    rock: 16,
    uses: 160,
  },
  "pick-iron": {
    id: "pick-iron",
    name: "Iron pickaxe",
    short: "Pick",
    tier: "iron",
    kind: "pick",
    dmg: 18,
    range: 1.7,
    cd: 0.42,
    stam: 12,
    tree: 12,
    rock: 120,
    uses: 160,
  },
  "sword-diamond": {
    id: "sword-diamond",
    name: "Diamond sword",
    short: "Sword",
    tier: "diamond",
    kind: "sword",
    dmg: 86,
    range: 1.85,
    cd: 0.26,
    stam: 8,
    tree: 14,
    rock: 16,
    uses: 260,
  },
  "axe-diamond": {
    id: "axe-diamond",
    name: "Diamond axe",
    short: "Axe",
    tier: "diamond",
    kind: "axe",
    dmg: 36,
    range: 1.85,
    cd: 0.34,
    stam: 11,
    tree: 54,
    rock: 20,
    uses: 260,
  },
  "pick-diamond": {
    id: "pick-diamond",
    name: "Diamond pickaxe",
    short: "Pick",
    tier: "diamond",
    kind: "pick",
    dmg: 22,
    range: 1.75,
    cd: 0.4,
    stam: 11,
    tree: 14,
    rock: 180,
    uses: 260,
  },
};

export interface Recipe {
  id: ToolId;
  name: string;
  blurb: string;
  cost: Partial<Record<MatKey, number>>;
}

export const RECIPES: Recipe[] = [
  { id: "sword-wood", name: "Wooden sword", blurb: "Cuts harder than a fist. Wears out first.", cost: { wood: 2, stick: 1 } },
  { id: "axe-wood", name: "Wooden axe", blurb: "Drops a tree in one swing.", cost: { wood: 3, stick: 2 } },
  { id: "pick-wood", name: "Wooden pickaxe", blurb: "Breaks ordinary stone.", cost: { wood: 3, stick: 2 } },
  { id: "sword-stone", name: "Stone sword", blurb: "Hits harder and lasts longer than wood.", cost: { wood: 1, stone: 2, stick: 1 } },
  { id: "axe-stone", name: "Stone axe", blurb: "Fells timber. Tougher than the wooden axe.", cost: { wood: 2, stone: 2, stick: 2 } },
  { id: "pick-stone", name: "Stone pickaxe", blurb: "Mines stone fast, and can crack iron ore.", cost: { wood: 2, stone: 3, stick: 2 } },
  { id: "sword-iron", name: "Iron sword", blurb: "A long-lasting blade.", cost: { stick: 1, iron: 2 } },
  { id: "axe-iron", name: "Iron axe", blurb: "Same fell, slower to break.", cost: { stick: 2, iron: 3 } },
  { id: "pick-iron", name: "Iron pickaxe", blurb: "Mines iron, and can reach diamond.", cost: { stick: 2, iron: 3 } },
  { id: "sword-diamond", name: "Diamond sword", blurb: "The slowest sword to break.", cost: { stick: 1, diamond: 2 } },
  { id: "axe-diamond", name: "Diamond axe", blurb: "The axe that lasts the longest.", cost: { stick: 2, diamond: 3 } },
  { id: "pick-diamond", name: "Diamond pickaxe", blurb: "Mines diamond. Wears down the slowest.", cost: { stick: 2, diamond: 3 } },
];

export const FIST: Omit<ToolStat, "id" | "name" | "short" | "tier"> & { name: string; short: string; kind: ToolKind; tier: ToolTier } = {
  name: "Fist",
  short: "Fist",
  tier: "wood",
  kind: "sword",
  dmg: 8,
  range: 1.55,
  cd: 0.42,
  stam: 7,
  tree: 9,
  rock: 5,
  uses: 0,
};

export type NodeKind = "tree" | "rock" | "berry" | "stick" | "log" | "grass";

export interface Scatter {
  kind: NodeKind;
  x: number;
  z: number;
  rot: number;
  scale: number;
  ore?: Ore;
}

export type DinoKind = "compy" | "raptor" | "flyer" | "rex" | "grazer" | "frill" | "sail" | "longneck" | "club";

export interface DinoSeed {
  kind: DinoKind;
  x: number;
  z: number;
}

export const DINO_SEEDS: DinoSeed[] = [
  { kind: "frill", x: 28, z: -30 },
  { kind: "frill", x: -42, z: 28 },
  { kind: "raptor", x: 44, z: -60 },
  { kind: "raptor", x: -52, z: -16 },
  { kind: "raptor", x: 18, z: 48 },
  { kind: "flyer", x: -10, z: -66 },
  { kind: "flyer", x: 36, z: 58 },
  { kind: "sail", x: 58, z: -18 },
  { kind: "sail", x: -46, z: 52 },
  { kind: "longneck", x: -36, z: -72 },
  { kind: "club", x: 22, z: -58 },
  { kind: "club", x: -58, z: -8 },
  { kind: "rex", x: 108, z: -36 },
];

export const DINO_STAT: Record<
  DinoKind,
  {
    hp: number;
    dmg: number;
    reach: number;
    cd: number;
    speed: number;
    aggro: number;
    radius: number;
    meat: number;
    scale: number;
    diet: "herb" | "carn";
    space: number;
  }
> = {
  compy: { hp: 28, dmg: 7, reach: 1.15, cd: 0.85, speed: 5.4, aggro: 8, radius: 0.42, meat: 1, scale: 0.48, diet: "carn", space: 0 },
  raptor: { hp: 96, dmg: 16, reach: 1.85, cd: 0.9, speed: 7.4, aggro: 18, radius: 0.95, meat: 2, scale: 1.38, diet: "carn", space: 0 },
  flyer: { hp: 46, dmg: 12, reach: 1.45, cd: 1.3, speed: 7.2, aggro: 16, radius: 0.7, meat: 2, scale: 0.9, diet: "carn", space: 0 },
  rex: { hp: 280, dmg: 36, reach: 3.3, cd: 1.45, speed: 3.7, aggro: 22, radius: 1.85, meat: 4, scale: 2.7, diet: "carn", space: 0 },
  grazer: { hp: 140, dmg: 16, reach: 2.3, cd: 1.25, speed: 3.6, aggro: 11, radius: 1.15, meat: 3, scale: 1.15, diet: "herb", space: 3.4 },
  frill: { hp: 190, dmg: 20, reach: 2.4, cd: 1.35, speed: 3.1, aggro: 10, radius: 1.55, meat: 3, scale: 1.7, diet: "herb", space: 4.2 },
  sail: { hp: 180, dmg: 22, reach: 2.6, cd: 1.15, speed: 4.6, aggro: 16, radius: 1.7, meat: 3, scale: 2.4, diet: "carn", space: 0 },
  longneck: { hp: 260, dmg: 22, reach: 2.8, cd: 1.5, speed: 2.5, aggro: 8, radius: 1.7, meat: 4, scale: 1.55, diet: "herb", space: 5.2 },
  club: { hp: 210, dmg: 18, reach: 1.9, cd: 1.3, speed: 2.3, aggro: 7, radius: 1.7, meat: 3, scale: 1.4, diet: "herb", space: 3.2 },
};

const EPITAPH: Record<string, string> = {
  hunger: "The hunt outlasted your belly.",
  thirst: "The valley kept its water. You did not.",
  compy: "Small teeth. Enough of them.",
  raptor: "A sickle claw closed the day.",
  flyer: "The shadow came down faster than you.",
  rex: "The tyrant did not break stride.",
  grazer: "You crowded a broadbill. It did not yield.",
  frill: "A frilled bull put a horn through the day.",
  sail: "A sailback ran you down.",
  longneck: "You stood under a longneck. It did not stop.",
  club: "A club tail ended the walk.",
};

export function epitaph(cause: string) {
  return EPITAPH[cause] ?? "The wild kept you.";
}

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type TerrainRoll = {
  ox: number;
  oz: number;
  phase: number;
  ridgeZ: number;
  westX: number;
  westZ: number;
  southX: number;
  southZ: number;
  horns: [number, number, number, number][];
};

let terrain: TerrainRoll = {
  ox: 0,
  oz: 0,
  phase: 0.4,
  ridgeZ: -34,
  westX: -78,
  westZ: -24,
  southX: 10,
  southZ: 52,
  horns: [
    [92, -62, 78, 3.6],
    [-102, -40, 76, 3.2],
    [-18, -108, 80, 3.4],
    [24, 102, 74, 2.8],
  ],
};

export function rollWorld() {
  const spin = Math.random() * Math.PI * 2;
  terrain = {
    ox: (Math.random() - 0.5) * 720,
    oz: (Math.random() - 0.5) * 720,
    phase: Math.random() * Math.PI * 2,
    ridgeZ: -8 - Math.random() * 80,
    westX: -24 - Math.random() * 100,
    westZ: (Math.random() - 0.5) * 110,
    southX: (Math.random() - 0.5) * 100,
    southZ: 24 + Math.random() * 60,
    horns: [0, 1, 2, 3].map((i) => {
      const a = spin + i * (1.3 + Math.random() * 0.45);
      const dist = 68 + Math.random() * 55;
      return [Math.cos(a) * dist, Math.sin(a) * dist, 56 + Math.random() * 30, 2.2 + Math.random() * 1.8];
    }),
  };
}

export function groundHeight(x: number, z: number) {
  const sx = x + terrain.ox;
  const sz = z + terrain.oz;
  const p = terrain.phase;
  const broad = Math.sin(sx * 0.018 + p) * Math.cos(sz * 0.016 + p * 0.6) * 3.6 + Math.sin(sx * 0.008 - sz * 0.01 + p) * 2.4;
  const mid = Math.sin(sx * 0.045 + p) * Math.cos(sz * 0.04) * 0.9 + Math.sin((sx + sz) * 0.024 + p) * 0.55;
  const ridge = Math.exp(-((z - terrain.ridgeZ) ** 2) / 1400) * (3.2 + Math.sin(sx * 0.04) * 0.6);
  const west = Math.exp(-((x - terrain.westX) ** 2 + (z - terrain.westZ) ** 2) / 2800) * 4.2;
  const south = Math.exp(-((x - terrain.southX) ** 2 + (z - terrain.southZ) ** 2) / 2400) * 3.4;
  let h = 6.2 + broad + mid + ridge + west + south;

  for (const [px, pz, rad, amp] of terrain.horns) {
    const d = Math.hypot(x - px, z - pz);
    if (d < rad) {
      const t = 1 - d / rad;
      const s = t * t * (3 - 2 * t);
      h += amp * s;
    }
  }

  const camp = Math.hypot(x, z - CAMP.z);
  const shelf = 9;
  const lip = 18;
  if (camp < lip) {
    let k = 1;
    if (camp > shelf) {
      const t = (camp - shelf) / (lip - shelf);
      k = 1 - t * t * (3 - 2 * t);
    }
    h = h * (1 - k) + 6.4 * k;
  }

  // East river, off the hunter's right. Never across the path ahead of camp.
  const riverX = 46 + Math.sin(terrain.phase * 2) * 16 + Math.sin(z * 0.032 + terrain.phase) * 8;
  const rd = Math.abs(x - riverX);
  if (rd < 9.5 && z < 12 && z > -WORLD_LIM + 10) {
    const carve = Math.cos((rd / 9.5) * Math.PI * 0.5) ** 2;
    h = h * (1 - carve) + (WATER - 1.1) * carve;
  }

  // West pool, off the left shoulder.
  const pd = Math.hypot(x + 58, z + 2);
  if (pd < 12) {
    const carve = Math.cos((pd / 12) * Math.PI * 0.5) ** 2;
    h = h * (1 - carve) + (WATER - 0.85) * carve;
  }

  if (camp > 20) h = carveWildWater(x, z, h);

  return h;
}

function cellHash(ix: number, iz: number) {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function carveBowl(h: number, dist: number, rad: number, depth: number) {
  if (dist >= rad || h > 9.5) return h;
  const carve = Math.cos((dist / rad) * Math.PI * 0.5) ** 2;
  return h * (1 - carve) + depth * carve;
}

function carveWildWater(x: number, z: number, h: number) {
  const sx = x + terrain.ox;
  const sz = z + terrain.oz;
  const pond = 78;
  const ix = Math.floor(sx / pond);
  const iz = Math.floor(sz / pond);
  if (cellHash(ix, iz) < 0.42) {
    const px = (ix + 0.35 + cellHash(ix + 3, iz) * 0.3) * pond - terrain.ox;
    const pz = (iz + 0.35 + cellHash(ix, iz + 5) * 0.3) * pond - terrain.oz;
    const rad = 6 + cellHash(ix + 9, iz + 2) * 5;
    h = carveBowl(h, Math.hypot(x - px, z - pz), rad, WATER - 0.65);
  }

  const lake = 220;
  const lx = Math.floor(sx / lake);
  const lz = Math.floor(sz / lake);
  if (cellHash(lx + 40, lz + 11) < 0.62) {
    const px = (lx + 0.5) * lake + (cellHash(lx, lz + 1) - 0.5) * 36 - terrain.ox;
    const pz = (lz + 0.5) * lake + (cellHash(lx + 2, lz) - 0.5) * 36 - terrain.oz;
    const rad = 18 + cellHash(lx + 7, lz + 8) * 12;
    h = carveBowl(h, Math.hypot(x - px, z - pz), rad, WATER - 1.35);
  }

  const rivers: [number, number][] = [
    [Math.abs(x - (30 + Math.sin(terrain.phase) * 24 + Math.sin(z * 0.02 + terrain.phase) * 16 + Math.sin(z * 0.006) * 26)), 9],
    [Math.abs(z - (-40 - Math.cos(terrain.phase) * 30 + Math.sin(x * 0.017 + terrain.phase) * 14 + Math.cos(x * 0.005) * 20)), 8],
    [Math.abs(x + 90 + Math.sin(terrain.phase * 1.7) * 40 - Math.sin(z * 0.014 + terrain.phase) * 18), 10],
  ];
  for (const [dist, half] of rivers) {
    if (dist < half && h < 11) {
      const carve = Math.cos((dist / half) * Math.PI * 0.5) ** 2;
      h = h * (1 - carve) + (WATER - 1.05) * carve;
    }
  }
  return h;
}

export function inWaterAt(x: number, z: number) {
  return groundHeight(x, z) < WATER + 0.08;
}

export function regionName(x: number, z: number) {
  if (Math.hypot(x, z - CAMP.z) < 14) return "Camp rise";
  if (inWaterAt(x, z) && Math.hypot(x + 58, z + 2) < 14) return "West pool";
  if (inWaterAt(x, z)) {
    const river =
      Math.abs(x - (36 + Math.sin(z * 0.02) * 16)) < 10 ||
      Math.abs(z - (-64 + Math.sin(x * 0.017) * 14)) < 9 ||
      Math.abs(x - (52 + Math.sin(z * 0.032) * 8)) < 10;
    return river ? "River" : "Lake";
  }
  if (Math.hypot(x + 78, z + 24) < 24) return "West rise";
  if (Math.abs(z + 28) < 12 && x > -40 && x < 46) return "Long ridge";
  if (Math.hypot(x - 10, z - 52) < 18) return "South hill";
  if (z < -78) return "Far basin";
  if (x > 28) return "River wood";
  if (x < -22) return "Fern hollow";
  if (z < -16) return "Open wild";
  return "Valley floor";
}

function dry(x: number, z: number) {
  if (Math.abs(x) > WORLD_LIM - 8 || Math.abs(z) > WORLD_LIM - 8) return false;
  return groundHeight(x, z) > WATER + 0.55;
}

function slopeAt(x: number, z: number) {
  const e = 2.4;
  const dx = groundHeight(x + e, z) - groundHeight(x - e, z);
  const dz = groundHeight(x, z + e) - groundHeight(x, z - e);
  return Math.hypot(dx, dz) / (e * 2);
}

function tuckedIn(x: number, z: number) {
  const h = groundHeight(x, z);
  const steps: [number, number][] = [
    [1.8, 0],
    [-1.8, 0],
    [0, 1.8],
    [0, -1.8],
  ];
  for (const [dx, dz] of steps) {
    if (groundHeight(x + dx, z + dz) - h > 1.35) return true;
  }
  return false;
}

function openGround(x: number, z: number) {
  if (!dry(x, z)) return false;
  const r = Math.hypot(x, z) / (WORLD_LIM + 10);
  if (r > 0.66) return false;
  if (tuckedIn(x, z)) return false;
  return true;
}

export function randomWildSpot(minFromCamp = 52, avoid: { x: number; z: number }[] = []) {
  for (let i = 0; i < 90; i += 1) {
    const x = (Math.random() - 0.5) * WORLD_LIM * 1.35;
    const z = (Math.random() - 0.5) * WORLD_LIM * 1.35;
    if (!openGround(x, z) || slopeAt(x, z) > 0.2) continue;
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < minFromCamp) continue;
    if (avoid.some((p) => Math.hypot(p.x - x, p.z - z) < 40)) continue;
    return { x, z };
  }
  return { x: 68, z: -74 };
}

function farFrom(x: number, z: number, list: Scatter[], min: number) {
  const m2 = min * min;
  for (const s of list) {
    const dx = s.x - x;
    const dz = s.z - z;
    if (dx * dx + dz * dz < m2) return false;
  }
  return true;
}

function rollOre(rng: () => number): Ore {
  const r = rng();
  if (r > 0.9) return "diamond";
  if (r > 0.62) return "iron";
  return "stone";
}

export function scatterValley(): Scatter[] {
  const rng = mulberry32(11);
  const out: Scatter[] = [];

  const fixed: Scatter[] = [
    { kind: "berry", x: 7.2, z: 11.4, rot: 0.4, scale: 1 },
    { kind: "berry", x: -6.4, z: 12.2, rot: 1.1, scale: 0.9 },
    { kind: "stick", x: 1.6, z: 14.4, rot: 0.4, scale: 1 },
    { kind: "stick", x: -2.4, z: 13.1, rot: 1.6, scale: 0.9 },
    { kind: "stick", x: 4.8, z: 15.6, rot: 2.4, scale: 1.05 },
    { kind: "stick", x: -0.6, z: 19.4, rot: 0.8, scale: 1 },
    { kind: "stick", x: 3.2, z: 12.2, rot: 2.9, scale: 0.85 },
    { kind: "log", x: 3.4, z: 18.6, rot: 0.6, scale: 1 },
    { kind: "log", x: -3.1, z: 13.4, rot: 1.8, scale: 0.9 },
    { kind: "log", x: 15, z: 8, rot: 0.3, scale: 1.1 },
    { kind: "tree", x: -13, z: 9, rot: 0.5, scale: 1.15 },
    { kind: "tree", x: 17, z: 7, rot: 1.4, scale: 1.25 },
    { kind: "tree", x: -8, z: 24, rot: 2.2, scale: 1 },
  ];
  for (const s of fixed) {
    if ((s.kind === "tree" || s.kind === "log") && !openGround(s.x, s.z)) continue;
    out.push(s);
  }

  const want: { kind: NodeKind; n: number; min: number }[] = [
    { kind: "tree", n: 52, min: 6.2 },
    { kind: "rock", n: 16, min: 9 },
    { kind: "berry", n: 16, min: 5 },
    { kind: "stick", n: 28, min: 4.5 },
    { kind: "grass", n: 150, min: 2.2 },
    { kind: "log", n: 6, min: 8 },
  ];

  const span = WORLD_LIM * 2 - 36;
  for (const bag of want) {
    let placed = out.filter((s) => s.kind === bag.kind).length;
    let guard = 0;
    while (placed < bag.n && guard < bag.n * 80) {
      guard += 1;
      const x = (rng() - 0.5) * span;
      const z = (rng() - 0.5) * span;
      if (!openGround(x, z)) continue;
      const slope = slopeAt(x, z);
      if (bag.kind === "tree" && slope > 0.14) continue;
      if (bag.kind === "rock" && (slope < 0.04 || slope > 0.28)) continue;
      if ((bag.kind === "berry" || bag.kind === "log") && slope > 0.16) continue;
      if (bag.kind === "grass" && slope > 0.34) continue;
      if (Math.hypot(x, z - CAMP.z) < (bag.kind === "grass" ? 6 : 10)) continue;
      if (!farFrom(x, z, out, bag.min)) continue;
      const scale = bag.kind === "grass" ? 0.7 + rng() * 0.9 : bag.kind === "rock" ? 0.32 + rng() * 0.38 : 0.85 + rng() * 0.45;
      const ore = bag.kind === "rock" ? rollOre(rng) : undefined;
      out.push({ kind: bag.kind, x, z, rot: rng() * Math.PI * 2, scale, ore });
      placed += 1;
      if (bag.kind !== "rock") continue;
      const pals = 1 + Math.floor(rng() * 3);
      for (let p = 0; p < pals; p += 1) {
        const ang = rng() * Math.PI * 2;
        const dist = 0.9 + rng() * 1.5;
        const x2 = x + Math.cos(ang) * dist;
        const z2 = z + Math.sin(ang) * dist;
        if (!openGround(x2, z2) || slopeAt(x2, z2) > 0.3) continue;
        out.push({
          kind: "rock",
          x: x2,
          z: z2,
          rot: rng() * Math.PI * 2,
          scale: 0.22 + rng() * 0.28,
          ore,
        });
      }
    }
  }
  return out;
}
