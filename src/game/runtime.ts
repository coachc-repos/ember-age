import { ValleyAudio } from "@/game/audio";
import {
  CAMP,
  DINO_SEEDS,
  DINO_STAT,
  FIST,
  RECIPES,
  TIER_RANK,
  TOOLS,
  type Ore,
  WORLD_LIM,
  clamp,
  epitaph,
  groundHeight,
  inWaterAt,
  randomWildSpot,
  regionName,
  rollWorld,
  scatterValley,
  type DinoKind,
  type MatKey,
  type NodeKind,
  type ToolId,
  type ToolKind,
  type ToolTier,
} from "@/game/world";
import * as THREE from "three";

export type Mode = "menu" | "play" | "pause" | "dead";

export interface Snapshot {
  mode: Mode;
  dawn: number;
  score: number;
  kills: number;
  meals: number;
  drinks: number;
  epitaph: string;
  bestDawn: number;
  bestScore: number;
  muted: boolean;
  shake: boolean;
  record: boolean;
  crafting: boolean;
  slots: (ToolId | null)[];
  selected: number;
  wood: number;
  stone: number;
  stick: number;
  berry: number;
  meat: number;
  iron: number;
  diamond: number;
  wear: number[];
  hint: string;
  banner: string;
  place: string;
  toolName: string;
}

export interface HudNodes {
  hp: HTMLElement | null;
  hunger: HTMLElement | null;
  thirst: HTMLElement | null;
  stamina: HTMLElement | null;
  vignette: HTMLElement | null;
}

type Hold = "jump" | "attack" | "use" | "sprint";

interface Stats {
  name: string;
  short: string;
  kind: ToolKind;
  tier: ToolTier;
  dmg: number;
  range: number;
  cd: number;
  stam: number;
  tree: number;
  rock: number;
  uses: number;
}

interface Node {
  kind: Exclude<NodeKind, "grass">;
  x: number;
  z: number;
  y: number;
  rot: number;
  scale: number;
  hp: number;
  max: number;
  alive: boolean;
  timer: number;
  idx: number;
  hold?: boolean;
  ore?: Ore;
}

interface Dino {
  kind: DinoKind;
  x: number;
  y: number;
  z: number;
  fx: number;
  fz: number;
  face: number;
  hp: number;
  homeX: number;
  homeZ: number;
  wx: number;
  wz: number;
  wander: number;
  cd: number;
  state: "patrol" | "chase" | "flee";
  hunger: number;
  taste: number;
  anger: number;
  interested: boolean;
  lookT: number;
  dead: boolean;
  respawn: number;
  fall: number;
  hover: number;
  plant: number;
  radius: number;
  phase: number;
  group: THREE.Group;
  legs: THREE.Object3D[];
  wings: THREE.Object3D[];
  head: THREE.Group;
  jaw: THREE.Group;
  bite: number;
  biteDur: number;
  biteKind: number;
  biteHit: boolean;
  mat: THREE.MeshStandardMaterial;
}

interface Meat {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  n: number;
  life: number;
  mesh: THREE.Mesh;
}

const SAVE_KEY = "ember-age-v2";
const STEP = 1 / 60;
const WALK = 4.55;
const RUN = 12;

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      getZ: () => number;
      setKeys: (codes: string[]) => void;
      setStick?: (x: number, y: number) => void;
      setSteer?: (v: number) => void;
    };
    __wild?: {
      stats: () => {
        mode: Mode;
        hp: number;
        hunger: number;
        thirst: number;
        stamina: number;
        x: number;
        z: number;
        inWater: boolean;
        wood: number;
        stone: number;
        stick: number;
        tool: string;
      };
    };
  }
}

function maxHp(kind: Exclude<NodeKind, "grass">) {
  if (kind === "tree") return 54;
  if (kind === "rock") return 80;
  return 1;
}

export class EmberRuntime {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private audio = new ValleyAudio();
  private timer = new THREE.Timer();
  private acc = 0;
  private clock = 0;
  private dead = false;
  private reduce: boolean;
  private keys = new Set<string>();
  private holds: Record<Hold, boolean> = { jump: false, attack: false, use: false, sprint: false };
  private stick = { x: 0, y: 0 };
  private lookDx = 0;
  private lookDy = 0;
  private viewSpin = 0;
  private prevJump = false;
  private prevUse = false;
  private touchId: number | null = null;
  private touchX = 0;
  private touchY = 0;
  private unlisten: Array<() => void> = [];

  private mode: Mode = "menu";
  private crafting = false;
  private benchX = -2.4;
  private benchZ = 17.5;
  private dawn = 1;
  private dayT = 0.22;
  private night = false;
  private kills = 0;
  private meals = 0;
  private drinks = 0;
  private crafts = 0;
  private epitaphText = "";
  private record = false;
  private bestDawn = 0;
  private bestScore = 0;
  private shakeOn = true;
  private trauma = 0;
  private hint = "";
  private banner = "";
  private bannerT = 0;
  private place = "Camp rise";
  private hintAcc = 0;
  private dirty = true;

  private px = CAMP.x;
  private py = 0;
  private pz = CAMP.z;
  private vy = 0;
  private jumpH = 0;
  private camYaw = 0.4;
  private camPitch = 0.28;
  private bodyYaw = 0.4;
  private heightGrid: Float32Array | null = null;
  private terrainMesh: THREE.Mesh | null = null;
  private terrainSeg = 70;
  private terrainSpan = 700;
  private terrainOx = 0;
  private terrainOz = 0;
  private userLook = false;
  private speed = 0;
  private sprinting = false;
  private phase = 0;
  private hp = 100;
  private hunger = 78;
  private thirst = 74;
  private stamina = 100;
  private inWater = false;
  private invuln = 0;
  private attackCd = 0;
  private attackT = 0;
  private attackDur = 0.4;
  private drinkT = 0;
  private slots: (ToolId | null)[] = [null, null, null, null, null, null];
  private wear = [0, 0, 0, 0, 0, 0];
  private selected = 0;
  private tool: Stats = FIST;
  private mats: Record<MatKey, number> = { wood: 0, stone: 0, stick: 0, berry: 0, meat: 0, iron: 0, diamond: 0 };

  private fx = 0;
  private fz = -1;
  private rx = 1;
  private rz = 0;
  private dummy = new THREE.Object3D();
  private sky = new THREE.Color(0x8ec4e8);
  private dayC = new THREE.Color(0xe4b27a);
  private nightC = new THREE.Color(0x141822);
  private sun: THREE.DirectionalLight;
  private ambi: THREE.AmbientLight;
  private hemi: THREE.HemisphereLight;
  private fireLight: THREE.PointLight;
  private flame: THREE.Object3D;
  private player: THREE.Group;
  private arm: THREE.Group;
  private hand: THREE.Group;
  private offArm: THREE.Object3D;
  private legL: THREE.Object3D;
  private legR: THREE.Object3D;
  private elbow: THREE.Object3D;
  private offElbow: THREE.Object3D;
  private torso: THREE.Object3D;
  private skin: THREE.MeshStandardMaterial;
  private nodes: Node[] = [];
  private dinos: Dino[] = [];
  private meats: Meat[] = [];
  private trunks!: THREE.InstancedMesh;
  private leaves!: THREE.InstancedMesh;
  private rocks!: THREE.InstancedMesh;
  private berries!: THREE.InstancedMesh;
  private sticks!: THREE.InstancedMesh;
  private logs!: THREE.InstancedMesh;
  private crowns!: THREE.InstancedMesh;
  private water: THREE.Mesh;
  private waterMat!: THREE.ShaderMaterial;
  private fog: THREE.FogExp2;
  private skyMat: THREE.ShaderMaterial;
  private clouds: THREE.Group;
  private sunDisc: THREE.Mesh;
  private skyDome: THREE.Mesh;
  private contextLost = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private hud: HudNodes,
    private onSnap: (s: Snapshot) => void,
  ) {
    this.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phone =
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(pointer: coarse)").matches ||
      window.innerWidth < 900;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "default",
      failIfMajorPerformanceCaveat: false,
      stencil: false,
      depth: true,
    });
    if (!phone) {
      try {
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      } catch {
        // Some phones black the canvas if the drawing buffer is forced to sRGB.
      }
    }
    this.renderer.toneMapping = phone ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(phone ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setClearColor(0x87b4d0, 1);
    this.renderer.shadowMap.enabled = false;
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.12, 640);
    this.fog = new THREE.FogExp2(0xc4966e, 0.0072);
    this.scene.fog = this.fog;
    this.scene.background = this.sky;

    this.ambi = new THREE.AmbientLight(0xfff0dc, 0.28);
    this.hemi = new THREE.HemisphereLight(0x8ec4ee, 0x3d5228, 0.92);
    this.sun = new THREE.DirectionalLight(0xffe0a8, 2.15);
    this.sun.position.set(30, 40, 12);
    this.sun.castShadow = false;
    const shadowSize = window.innerWidth < 800 ? 512 : 1024;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.035;
    const sc = this.sun.shadow.camera;
    sc.near = 2;
    sc.far = 70;
    sc.left = -22;
    sc.right = 22;
    sc.top = 22;
    sc.bottom = -22;
    this.scene.add(this.ambi, this.hemi, this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight(0xffd8b0, 0.55);
    fill.position.set(-18, 14, 22);
    this.scene.add(fill);

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x2f78b8) },
        horizon: { value: new THREE.Color(0xf3c48a) },
        bottom: { value: new THREE.Color(0xc47842) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 top;
        uniform vec3 horizon;
        uniform vec3 bottom;
        void main() {
          float h = normalize(vPos).y;
          vec3 col = mix(horizon, top, smoothstep(0.02, 0.62, h));
          col = mix(bottom, col, smoothstep(-0.25, 0.08, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(420, 20, 12), this.skyMat);
    skyDome.frustumCulled = false;
    skyDome.renderOrder = -1;
    this.skyDome = skyDome;
    this.scene.add(skyDome);
    this.sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe6b0, fog: false }),
    );
    this.scene.add(this.sunDisc);
    this.clouds = this.buildClouds();

    this.fireLight = new THREE.PointLight(0xff7a3c, 8, 14, 2);
    this.fireLight.castShadow = false;
    this.scene.add(this.fireLight);

    rollWorld();
    const mats = this.makeMats();
    this.skin = mats.skin;
    this.buildTerrain(mats.ground);
    this.water = this.buildWater();
    this.buildScatter(mats);
    this.buildCamp(mats);
    this.flame = this.scene.getObjectByName("flame") ?? this.fireLight;
    const body = this.buildPlayer(mats);
    this.player = body.group;
    this.arm = body.arm;
    this.hand = body.hand;
    this.offArm = body.offArm;
    this.legL = body.legL;
    this.legR = body.legR;
    this.elbow = body.elbow;
    this.offElbow = body.offElbow;
    this.torso = body.torso;
    this.scene.add(this.player);
    this.buildDinos();
    this.buildMeat();
    this.load();
    this.resetSim();
    this.bind();
    this.resize();
    this.timer.connect(document);
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.contextLost = true;
      window.setTimeout(() => {
        try {
          this.renderer.forceContextRestore();
        } catch {
          // The phone will restore the picture on its own if it can.
        }
      }, 250);
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.contextLost = false;
      this.renderer.setAnimationLoop((t) => this.frame(t));
      this.resize();
    });
    this.renderer.setAnimationLoop((t) => this.frame(t));
    this.resize();
    try {
      this.renderer.render(this.scene, this.camera);
    } catch {
      // The loop will paint the valley on the next frame.
    }
    window.__controlsTest = {
      getYaw: () => this.bodyYaw,
      getSpeed: () => this.speed,
      getX: () => this.px,
      getZ: () => this.pz,
      setKeys: (codes) => {
        this.keys = new Set(codes);
      },
      setStick: (x: number, y: number) => this.setStick(x, y),
      setSteer: (v: number) => {
        this.camYaw += v;
      },
    };
    window.__wild = {
      stats: () => ({
        mode: this.mode,
        hp: this.hp,
        hunger: this.hunger,
        thirst: this.thirst,
        stamina: this.stamina,
        x: this.px,
        z: this.pz,
        inWater: this.inWater,
        wood: this.mats.wood,
        stone: this.mats.stone,
        stick: this.mats.stick,
        tool: this.tool.name,
      }),
    };
    this.publish();
  }

  destroy() {
    this.dead = true;
    this.renderer.setAnimationLoop(null);
    this.timer.disconnect();
    for (const off of this.unlisten) off();
    this.unlisten = [];
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    this.renderer.dispose();
    delete window.__controlsTest;
    delete window.__wild;
  }

  unlock() {
    this.audio.unlock();
  }

  start() {
    this.audio.unlock();
    this.exitLock();
    this.resetSim();
    this.mode = "play";
    this.crafting = false;
    this.camYaw = 0;
    this.bodyYaw = 0;
    this.camPitch = 0.22;
    this.say("Empty hands. The book is on the table.");
    this.mark();
  }

  toMenu() {
    this.exitLock();
    this.crafting = false;
    this.mode = "menu";
    this.resetSim();
    this.mark();
  }

  togglePause() {
    if (this.crafting) {
      this.crafting = false;
      this.mark();
      return;
    }
    if (this.mode === "play") {
      this.mode = "pause";
      this.exitLock();
    } else if (this.mode === "pause") this.mode = "play";
    this.mark();
  }

  toggleMute() {
    const next = !this.audio.muted;
    this.audio.setMuted(next);
    this.save();
    this.mark();
  }

  setShake(on: boolean) {
    this.shakeOn = on;
    this.save();
    this.mark();
  }

  toggleCraft() {
    if (this.mode !== "play" && this.mode !== "pause") return;
    if (this.crafting) {
      this.crafting = false;
      this.mark();
      return;
    }
    if (!this.atBench()) {
      this.say("The recipe book is on the camp table");
      this.mark();
      return;
    }
    this.crafting = true;
    this.exitLock();
    this.mark();
  }

  setHold(name: Hold, on: boolean) {
    this.holds[name] = on;
  }

  setStick(x: number, y: number) {
    this.stick.x = x;
    this.stick.y = y;
  }

  setViewSpin(spin: number) {
    this.viewSpin = spin;
  }

  private unspin(dx: number, dy: number) {
    if (this.viewSpin === 90) return { x: dy, y: -dx };
    if (this.viewSpin === -90) return { x: -dy, y: dx };
    return { x: dx, y: dy };
  }

  addLook(dx: number, dy: number) {
    this.lookDx += dx;
    this.lookDy += dy;
  }

  selectSlot(i: number) {
    if (i < 0 || i > 5 || this.mode === "menu") return;
    this.selected = i;
    this.equip();
    this.mark();
  }

  eat() {
    if (this.mode !== "play") return;
    if (this.mats.meat > 0) {
      this.mats.meat -= 1;
      this.hunger = Math.min(100, this.hunger + 42);
      this.hp = Math.min(100, this.hp + 10);
      this.meals += 1;
      this.audio.eat();
      this.say("Meat settles the belly");
    } else if (this.mats.berry > 0) {
      this.mats.berry -= 1;
      this.hunger = Math.min(100, this.hunger + 20);
      this.meals += 1;
      this.audio.eat();
      this.say("Tart berries");
    } else this.say("Nothing to eat");
    this.mark();
  }

  craft(id: ToolId) {
    if (this.mode !== "play" && this.mode !== "pause") return;
    const recipe = RECIPES.find((r) => r.id === id);
    if (!recipe) return;
    const cost = recipe.cost;
    for (const key of Object.keys(cost) as MatKey[]) {
      if (this.mats[key] < (cost[key] ?? 0)) {
        this.say("Need more " + key);
        this.mark();
        return;
      }
    }
    const empty = this.slots.findIndex((s) => s === null);
    if (empty < 0) {
      this.say("Belt is full");
      this.mark();
      return;
    }
    for (const key of Object.keys(cost) as MatKey[]) this.mats[key] -= cost[key] ?? 0;
    this.slots[empty] = id;
    this.wear[empty] = TOOLS[id].uses;
    this.selected = empty;
    this.crafts += 1;
    this.equip();
    this.audio.craft();
    this.say(TOOLS[id].name + " bound");
    this.mark();
  }

  private bind() {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.mode === "play" && (e.code === "Space" || e.code.startsWith("Arrow"))) e.preventDefault();
      if (e.code === "KeyC") this.toggleCraft();
      if (e.code === "KeyG") this.eat();
      if (e.code === "Escape") {
        if (this.crafting) this.toggleCraft();
        else if (this.mode === "play" || this.mode === "pause") this.togglePause();
      }
      if (e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 6) this.selectSlot(n - 1);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
    const onBlur = () => this.keys.clear();
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement === this.canvas) {
        const d = this.unspin(e.movementX, e.movementY);
        this.lookDx += d.x;
        this.lookDy += d.y;
      }
    };
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || this.mode !== "play" || this.crafting) return;
      if (e.target === this.canvas || document.pointerLockElement === this.canvas) this.holds.attack = true;
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) this.holds.attack = false;
    };
    const onClick = () => {
      if (this.mode === "play" && !this.crafting) {
        this.audio.unlock();
        this.canvas.requestPointerLock?.();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      this.touchId = e.pointerId;
      this.touchX = e.clientX;
      this.touchY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && (e.buttons & 1) && document.pointerLockElement !== this.canvas && this.mode === "play") {
        this.lookDx += e.movementX;
        this.lookDy += e.movementY;
      }
      if (e.pointerId !== this.touchId) return;
      const d = this.unspin(e.clientX - this.touchX, e.clientY - this.touchY);
      this.lookDx += d.x;
      this.lookDy += d.y;
      this.touchX = e.clientX;
      this.touchY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId === this.touchId) this.touchId = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (this.mode !== "play") return;
      e.preventDefault();
      const dir = Math.sign(e.deltaY);
      let i = this.selected;
      for (let n = 0; n < 6; n += 1) {
        i = (i + dir + 6) % 6;
        if (this.slots[i]) break;
      }
      this.selectSlot(i);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") this.audio.resume();
    };
    const onResize = () => {
      this.resize();
      window.setTimeout(() => this.resize(), 60);
      window.setTimeout(() => this.resize(), 240);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.screen?.orientation?.addEventListener("change", onResize);
    document.addEventListener("visibilitychange", onVis);
    this.canvas.addEventListener("click", onClick);
    this.canvas.addEventListener("pointerdown", onPointerDown);
    this.canvas.addEventListener("pointermove", onPointerMove);
    this.canvas.addEventListener("pointerup", onPointerUp);
    this.canvas.addEventListener("pointercancel", onPointerUp);
    this.canvas.addEventListener("wheel", onWheel, { passive: false });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.canvas);
    this.unlisten.push(() => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.screen?.orientation?.removeEventListener("change", onResize);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
    });
  }

  private resize() {
    const view = window.visualViewport;
    const w = Math.max(this.canvas.clientWidth || 0, view?.width || 0, window.innerWidth || 0);
    const h = Math.max(this.canvas.clientHeight || 0, view?.height || 0, window.innerHeight || 0);
    if (w < 2 || h < 2) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 74 : 56;
    this.camera.updateProjectionMatrix();
  }

  private frame(stamp: number) {
    if (this.dead) return;
    const buffer = this.renderer.domElement;
    if (buffer.clientWidth < 2 || buffer.clientHeight < 2 || this.renderer.domElement.width < 2) this.resize();
    if (this.contextLost) return;
    try {
      this.timer.update(stamp);
      const raw = this.timer.getDelta();
      const delta = Number.isFinite(raw) ? Math.min(raw, 0.05) : 0;
      this.clock += delta;
      this.applyLook(delta);
      this.acc += delta;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.sim(STEP);
        this.acc -= STEP;
        steps += 1;
      }
      this.present(delta);
      if (this.dirty) this.publish();
      this.skyDome.position.copy(this.camera.position);
    } catch (err) {
      console.error(err);
    }
    try {
      this.renderer.render(this.scene, this.camera);
    } catch (err) {
      console.error(err);
    }
  }

  private applyLook(dt: number) {
    if (this.mode !== "play" || this.crafting) {
      this.lookDx = 0;
      this.lookDy = 0;
      return;
    }
    const keyed = this.keys.has("KeyQ") || this.keys.has("KeyR");
    this.userLook = Math.abs(this.lookDx) > 0 || keyed;
    this.camYaw -= this.lookDx * 0.003;
    this.camPitch = clamp(this.camPitch + this.lookDy * 0.002, -0.45, 0.72);
    this.lookDx = 0;
    this.lookDy = 0;
    const turn = 1.9 * dt;
    if (this.keys.has("KeyQ")) this.camYaw += turn;
    if (this.keys.has("KeyR")) this.camYaw -= turn;
  }

  private sim(dt: number) {
    if (this.mode !== "play" || this.crafting) return;
    this.tickPlayer(dt);
    if (this.mode !== "play") return;
    for (const d of this.dinos) this.tickDino(d, dt);
    this.separate();
    this.keepBodiesApart();
    this.tickNodes(dt);
    this.tickMeat(dt);
    this.tickDay(dt);
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) {
        this.banner = "";
        this.mark();
      }
    }
    this.hintAcc += dt;
    if (this.hintAcc > 0.2) {
      this.hintAcc = 0;
      const hint = this.hintLine();
      const place = regionName(this.px, this.pz);
      if (hint !== this.hint) {
        this.hint = hint;
        this.mark();
      }
      if (place !== this.place) {
        this.place = place;
        this.mark();
      }
    }
  }

  private tickPlayer(dt: number) {
    let iz = 0;
    let ix = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) iz += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) iz -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) ix += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) ix -= 1;
    ix += this.stick.x;
    iz += this.stick.y;
    const magIn = Math.hypot(ix, iz);
    if (magIn < 0.16) {
      ix = 0;
      iz = 0;
    } else if (magIn > 1) {
      ix /= magIn;
      iz /= magIn;
    }
    this.basis(this.camYaw);
    const forward = magIn < 0.16 ? 0 : Math.min(1, magIn);
    const walking = forward > 0.05;
    const wantSprint =
      walking &&
      iz > 0.15 &&
      (this.holds.sprint || this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) &&
      this.stamina > 0.4 &&
      this.jumpH < 0.15;
    this.sprinting = wantSprint;
    const pace = wantSprint ? RUN : WALK;
    const wet = inWaterAt(this.px, this.pz);
    this.speed = walking ? pace * forward * (wet ? 0.62 : 1) : 0;
    if (walking) {
      const dirX = this.fx * iz + this.rx * ix;
      const dirZ = this.fz * iz + this.rz * ix;
      const dirLen = Math.hypot(dirX, dirZ) || 1;
      const face = Math.atan2(-dirX / dirLen, -dirZ / dirLen);
      this.bodyYaw = this.easeYaw(this.bodyYaw, face, dt, 10);
      const step = this.speed * dt;
      const nx = this.px + (dirX / dirLen) * step;
      const nz = this.pz + (dirZ / dirLen) * step;
      const here = this.standH(this.px, this.pz);
      const climb = (x: number, z: number) => this.standH(x, z) - here;
      if (climb(nx, nz) < 1.35 && !this.bodyAt(nx, nz)) {
        this.px = nx;
        this.pz = nz;
      } else if (climb(nx, this.pz) < 1.35 && !this.bodyAt(nx, this.pz)) this.px = nx;
      else if (climb(this.px, nz) < 1.35 && !this.bodyAt(this.px, nz)) this.pz = nz;
    }
    this.basis(this.bodyYaw);
    this.shoveWorld();
    this.px = clamp(this.px, -6000, 6000);
    this.pz = clamp(this.pz, -6000, 6000);

    const jump = this.holds.jump || this.keys.has("Space");
    if (jump && !this.prevJump && this.jumpH <= 0.02 && this.stamina >= 12) {
      this.vy = 6.5;
      this.stamina -= 12;
    }
    this.prevJump = jump;
    this.vy -= 18 * dt;
    this.jumpH += this.vy * dt;
    if (this.jumpH <= 0) {
      this.jumpH = 0;
      this.vy = 0;
    }
    const gy = this.standH(this.px, this.pz);
    this.inWater = inWaterAt(this.px, this.pz);
    const ahead = this.standH(this.px + 0.35, this.pz) - this.standH(this.px - 0.35, this.pz);
    const side = this.standH(this.px, this.pz + 0.35) - this.standH(this.px, this.pz - 0.35);
    const slope = Math.hypot(ahead, side) / 0.7;
    const lift = 0.05 + Math.min(0.24, slope * 0.18);
    const stand = this.inWater ? Math.max(gy, 1.05) : gy;
    this.py = stand + this.jumpH + lift;

    const attack = this.holds.attack || this.keys.has("KeyJ") || this.keys.has("KeyK");
    const use = this.holds.use || this.keys.has("KeyE") || this.keys.has("KeyF");
    if (attack && this.attackCd <= 0 && this.stamina >= this.tool.stam && this.drinkT <= 0) {
      this.attackCd = this.tool.cd;
      this.attackT = this.tool.cd;
      this.attackDur = Math.max(0.2, this.tool.cd);
      this.stamina -= this.tool.stam;
      this.audio.spear();
      this.doHit();
    }
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.attackT = Math.max(0, this.attackT - dt);

    if (use && this.inWater && this.thirst < 100) {
      this.drinkT += dt;
      if (this.drinkT >= 0.62) {
        this.thirst = Math.min(100, this.thirst + 36);
        this.drinkT = 0;
        this.drinks += 1;
        this.audio.drink();
        this.say("Cool water");
      }
    } else if (!use) this.drinkT = 0;
    if (use && !this.prevUse && !this.inWater) {
      if (this.pickupNear(2.15)) this.tryGather();
      else if (this.atBench()) this.toggleCraft();
      else this.tryGather();
    }
    this.prevUse = use;

    if (wantSprint) this.stamina = Math.max(0, this.stamina - 24 * dt);
    else if (this.attackT <= 0) this.stamina = Math.min(100, this.stamina + (this.thirst > 8 ? 20 : 8) * dt);

    const hungerDrain = (0.36 + (wantSprint ? 0.18 : 0)) * dt;
    const thirstDrain = (0.72 + (wantSprint ? 0.34 : 0)) * dt;
    this.hunger = Math.max(0, this.hunger - hungerDrain);
    this.thirst = Math.max(0, this.thirst - thirstDrain);
    if (this.hunger <= 0) this.hp -= 3.4 * dt;
    if (this.thirst <= 0) this.hp -= 5 * dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (walking && this.jumpH <= 0.02) {
      const prev = this.phase;
      this.phase += dt * (wantSprint ? 16 : 8.2);
      if (Math.floor(prev / Math.PI) !== Math.floor(this.phase / Math.PI)) this.audio.step();
    }
    if (this.hp <= 0) this.die(this.thirst <= 0 ? "thirst" : "hunger");
  }

  private easeYaw(current: number, target: number, dt: number, speed: number) {
    const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    const step = clamp(diff, -speed * dt, speed * dt);
    return current + step;
  }

  private standH(x: number, z: number) {
    const grid = this.heightGrid;
    const seg = this.terrainSeg;
    const span = this.terrainSpan;
    if (!grid) return groundHeight(x, z);
    const step = span / seg;
    const gx = (x - (this.terrainOx - span / 2)) / step;
    const gz = (z - (this.terrainOz - span / 2)) / step;
    if (gx < 0 || gz < 0 || gx >= seg || gz >= seg) return groundHeight(x, z);
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const tx = gx - x0;
    const tz = gz - z0;
    const stride = seg + 1;
    const at = (ix: number, iz: number) => grid[iz * stride + ix] ?? 0;
    const ha = at(x0, z0);
    const hb = at(x0, z0 + 1);
    const hc = at(x0 + 1, z0 + 1);
    const hd = at(x0 + 1, z0);
    if (tx + tz <= 1) return ha * (1 - tx - tz) + hd * tx + hb * tz;
    return hb * (1 - tx) + hd * (1 - tz) + hc * (tx + tz - 1);
  }

  private shoveWorld() {
    for (const n of this.nodes) {
      if (!n.alive) continue;
      if (n.kind === "tree") this.shove(n.x, n.z, 0.72 * n.scale + 0.28);
      else if (n.kind === "rock") this.shove(n.x, n.z, 0.7 * n.scale + 0.3);
    }
  }

  private shove(x: number, z: number, rad: number) {
    const dx = this.px - x;
    const dz = this.pz - z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.0001 && dist < rad) {
      const k = (rad - dist) / dist;
      this.px += dx * k;
      this.pz += dz * k;
    }
  }

  private doHit() {
    this.basis(this.bodyYaw);
    let bestD: Dino | null = null;
    let bestDd = 99;
    for (const d of this.dinos) {
      if (d.dead) continue;
      const dx = d.x - this.px;
      const dz = d.z - this.pz;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.001 || dist > this.tool.range + d.radius) continue;
      if (Math.abs(d.y - this.py) > 3.2) continue;
      const dot = (dx * this.fx + dz * this.fz) / dist;
      if (dot < 0.2) continue;
      if (dist < bestDd) {
        bestDd = dist;
        bestD = d;
      }
    }
    let bestN: Node | null = null;
    let bestNd = 99;
    for (const n of this.nodes) {
      if (!n.alive) continue;
      if (n.kind !== "tree" && n.kind !== "rock" && n.kind !== "berry" && n.kind !== "stick" && n.kind !== "log") continue;
      const dx = n.x - this.px;
      const dz = n.z - this.pz;
      const dist = Math.hypot(dx, dz);
      const extra = n.kind === "tree" ? 0.85 : n.kind === "rock" ? 0.7 : 0.4;
      if (dist > this.tool.range + extra) continue;
      const dot = dist < 0.001 ? 1 : (dx * this.fx + dz * this.fz) / dist;
      if (dot < 0.15) continue;
      if (dist < bestNd) {
        bestNd = dist;
        bestN = n;
      }
    }
    if (bestD && (!bestN || bestDd <= bestNd + 0.15)) {
      this.hitDino(bestD);
      return;
    }
    if (bestN) this.hitNode(bestN);
  }

  private hitDino(d: Dino) {
    d.hp -= this.tool.dmg;
    d.mat.emissive.setHex(0x6a2a1c);
    this.trauma = Math.min(1, this.trauma + 0.2);
    this.audio.hit();
    d.anger = Math.max(d.anger, 8);
    d.interested = true;
    if (d.state !== "flee") d.state = "chase";
    if (d.hp <= 0) {
      d.dead = true;
      d.respawn = d.kind === "rex" ? 55 : 26;
      d.fall = 0;
      this.kills += 1;
      this.dropMeat(d.x, d.z, DINO_STAT[d.kind].meat);
      this.say(labelDino(d.kind) + " falls");
    }
    this.spendTool();
    this.mark();
  }

  private hitNode(n: Node) {
    if (n.kind === "berry" || n.kind === "stick" || n.kind === "log") {
      this.collect(n);
      return;
    }
    const dmg = n.kind === "tree" ? this.tool.tree : this.tool.rock;
    if (n.kind === "rock") {
      const ore = n.ore ?? "stone";
      const need = ore === "diamond" ? 2 : ore === "iron" ? 1 : 0;
      if (this.tool.kind !== "pick" || TIER_RANK[this.tool.tier] < need) {
        const ask = ore === "diamond" ? "an iron pick" : ore === "iron" ? "a stone pick" : "a pickaxe";
        this.say(ore === "stone" ? "Rock · craft a pickaxe" : `${ore[0]?.toUpperCase()}${ore.slice(1)} ore needs ${ask}`);
        this.mark();
        return;
      }
    }
    n.hp -= dmg;
    this.audio.chop();
    this.trauma = Math.min(1, this.trauma + 0.08);
    this.spendTool();
    if (n.hp <= 0) {
      n.alive = false;
      n.timer = n.kind === "tree" ? 42 : 28;
      if (n.kind === "tree") {
        const got = this.spillLogs(n.x, n.z, 3);
        if (got === 0) this.gain("wood", 3);
        else this.say("The tree falls. Pick up the wood.");
      } else this.gain(n.ore ?? "stone", n.ore === "diamond" ? 1 : 2);
      this.hideNode(n);
      this.mark();
    }
  }

  private spillLogs(x: number, z: number, n: number) {
    const spots = [
      [0.75, 0.2],
      [-0.5, 0.65],
      [0.2, -0.7],
    ];
    let placed = 0;
    for (const node of this.nodes) {
      if (placed >= n) break;
      if (node.kind !== "log" || !node.hold || node.alive) continue;
      const spot = spots[placed] ?? [0, 0];
      node.x = x + (spot[0] ?? 0);
      node.z = z + (spot[1] ?? 0);
      node.y = groundHeight(node.x, node.z);
      node.alive = true;
      node.hp = 1;
      node.scale = 1;
      node.rot = placed * 1.1;
      this.showNode(node);
      placed += 1;
    }
    return placed;
  }

  private atBench() {
    return Math.hypot(this.px - this.benchX, this.pz - this.benchZ) < 2.45;
  }

  private pickupNear(rad: number) {
    for (const n of this.nodes) {
      if (!n.alive || (n.kind !== "berry" && n.kind !== "stick" && n.kind !== "log")) continue;
      if (Math.hypot(n.x - this.px, n.z - this.pz) < rad) return true;
    }
    for (const m of this.meats) {
      if (m.alive && Math.hypot(m.x - this.px, m.z - this.pz) < rad) return true;
    }
    return false;
  }

  private tryGather() {
    let best = 2.55;
    let node: Node | null = null;
    for (const n of this.nodes) {
      if (!n.alive || (n.kind !== "berry" && n.kind !== "stick" && n.kind !== "log")) continue;
      const dist = Math.hypot(n.x - this.px, n.z - this.pz);
      if (dist < best) {
        best = dist;
        node = n;
      }
    }
    let meat: Meat | null = null;
    for (const m of this.meats) {
      if (!m.alive) continue;
      const dist = Math.hypot(m.x - this.px, m.z - this.pz);
      if (dist < best) {
        best = dist;
        node = null;
        meat = m;
      }
    }
    if (meat) this.takeMeat(meat);
    else if (node) this.collect(node);
    else this.say("Nothing in reach");
  }

  private collect(n: Node) {
    if (!n.alive) return;
    if (n.kind === "berry") this.gain("berry", 2);
    else if (n.kind === "stick") this.gain("stick", 1);
    else if (n.kind === "log") this.gain("wood", 2);
    else return;
    n.alive = false;
    n.timer = n.kind === "log" ? 26 : 18;
    this.hideNode(n);
    this.audio.gather();
    this.mark();
  }

  private gain(key: MatKey, n: number) {
    const next = Math.min(99, this.mats[key] + n);
    const got = next - this.mats[key];
    this.mats[key] = next;
    const name = key === "berry" ? "Berries" : key === "stick" ? "Sticks" : key.charAt(0).toUpperCase() + key.slice(1);
    this.say(got > 0 ? `${name} +${got}` : "Can't carry more");
  }

  private dropMeat(x: number, z: number, n: number) {
    const slot = this.meats.find((m) => !m.alive);
    if (!slot) return;
    slot.alive = true;
    slot.x = x;
    slot.z = z;
    slot.y = groundHeight(x, z) + 0.2;
    slot.n = n;
    slot.life = 40;
    slot.mesh.visible = true;
    slot.mesh.position.set(slot.x, slot.y, slot.z);
  }

  private takeMeat(m: Meat) {
    this.gain("meat", m.n);
    m.alive = false;
    m.mesh.visible = false;
    this.audio.gather();
    this.mark();
  }

  private tickDino(d: Dino, dt: number) {
    const st = DINO_STAT[d.kind];
    if (d.dead) {
      d.respawn -= dt;
      d.fall = Math.min(1.2, d.fall + dt * 2.4);
      if (d.respawn <= 0) {
        d.dead = false;
        d.hp = st.hp;
        d.fall = 0;
        d.state = "patrol";
        d.cd = 0.8;
        calm(d);
        d.mat.emissive.setHex(0x000000);
        if (d.kind === "rex") this.placeRex(d);
        else {
          d.x = d.homeX;
          d.z = d.homeZ;
        }
        d.group.visible = true;
      }
      return;
    }
    if (d.mat.emissive.r > 0) d.mat.emissive.multiplyScalar(Math.max(0, 1 - dt * 6));
    const dx = this.px - d.x;
    const dz = this.pz - d.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    const aggro = st.aggro * (this.night ? 1.15 : 1);
    const see = dist < aggro;
    const herb = st.diet === "herb";
    d.anger = Math.max(0, d.anger - dt);
    if (!herb && d.hunger > 25) this.sniffMeat(d);

    if (herb) {
      const hurt = d.hp < st.hp * 0.28;
      if (hurt && d.anger <= 0) d.state = "flee";
      else if (d.anger > 0 && dist < aggro * 1.6) d.state = "chase";
      else if (d.anger <= 0 && d.state !== "patrol") d.state = "patrol";
    } else {
      d.hunger = Math.min(100, d.hunger + dt * (this.night ? 1.7 : 0.95));
      d.lookT -= dt;
      if (d.lookT <= 0 && see && d.state !== "chase") {
        d.lookT = 5 + Math.random() * 5;
        if (d.hunger >= d.taste) {
          const eagerness = Math.min(1, (d.hunger - d.taste) / 34);
          d.interested = Math.random() < 0.18 + eagerness * 0.48;
        } else d.interested = false;
      }
      if (!see && dist > aggro * 1.55) d.interested = false;
      const hunt = d.anger > 0 || (d.hunger >= d.taste && d.interested);
      if (d.kind === "compy" && d.hp < st.hp * 0.34 && see) d.state = "flee";
      else if (hunt && (see || d.anger > 0) && dist < aggro * 1.5) {
        if (d.state !== "chase") {
          d.state = "chase";
          if (d.kind === "rex" || d.kind === "raptor") this.audio.roar();
        }
      } else if (d.state === "chase" && (!hunt || dist > aggro * 1.7)) d.state = "patrol";
      else if (d.state === "flee" && !see) d.state = "patrol";
    }

    let tx = d.wx;
    let tz = d.wz;
    let spd = st.speed * 0.42;
    if (d.state === "chase") {
      tx = this.px;
      tz = this.pz;
      spd = st.speed * (d.kind === "rex" ? 1.75 : 1) * (this.night ? 1.1 : 1);
    } else if (d.state === "flee") {
      tx = d.x - (dx / dist) * 8;
      tz = d.z - (dz / dist) * 8;
      spd = st.speed * 1.15;
    } else {
      d.wander -= dt;
      if (d.wander <= 0 || Math.hypot(d.x - d.wx, d.z - d.wz) < 1.3) {
        const a = Math.random() * Math.PI * 2;
        const rad = 4 + Math.random() * (d.kind === "rex" ? 4 : 8);
        d.wx = clamp(d.homeX + Math.cos(a) * rad, -WORLD_LIM, WORLD_LIM);
        d.wz = clamp(d.homeZ + Math.sin(a) * rad, -WORLD_LIM, WORLD_LIM);
        d.wander = 2.2 + Math.random() * 3;
      }
    }
    let mx = tx - d.x;
    let mz = tz - d.z;
    const md = Math.hypot(mx, mz);
    if (md > 0.8 || d.state !== "patrol") {
      mx /= md || 1;
      mz /= md || 1;
      const want = Math.atan2(-mx, -mz);
      const turnRate = d.kind === "rex" || d.kind === "grazer" || d.kind === "frill" || d.kind === "longneck" || d.kind === "club" ? 1.25 : 2.1;
      d.face = this.easeYaw(d.face, want, dt, turnRate);
      d.fx = -Math.sin(d.face);
      d.fz = -Math.cos(d.face);
      const align = Math.max(0, d.fx * mx + d.fz * mz);
      const step = spd * align * dt;
      const nx = d.x + d.fx * step;
      const nz = d.z + d.fz * step;
      const blocked = d.kind !== "flyer" && inWaterAt(nx, nz);
      const run = Math.hypot(nx - d.x, nz - d.z);
      const rise = this.standH(nx, nz) - this.standH(d.x, d.z);
      const steep = run > 0.001 && rise / run > (d.state === "chase" ? 0.55 : 0.32);
      const intoYou = d.kind !== "flyer" && Math.hypot(nx - this.px, nz - this.pz) < 0.48 + st.radius;
      if (!blocked && !steep && !intoYou) {
        d.x = clamp(nx, -6000, 6000);
        d.z = clamp(nz, -6000, 6000);
      }
    }
    if (d.kind !== "flyer") this.leaveWater(d);
    const g = this.standH(d.x, d.z);
    if (d.kind === "flyer") {
      const dive = dist < 7.5 && d.state === "chase" ? 1.4 : 6.4;
      d.hover += (dive - d.hover) * Math.min(1, dt * 2.1);
      d.y = g + d.hover;
    } else d.y = this.standClear(d);
    d.cd -= dt;
    if (d.state === "chase" && d.cd <= 0 && dist < st.reach + 0.15 && Math.abs(d.y - this.py) < 2.6 && d.bite <= 0) {
      d.biteKind = (d.biteKind + 1 + Math.floor(Math.random() * 3)) % 4;
      d.biteDur = d.kind === "rex" ? 0.62 : 0.26 + Math.random() * 0.24;
      d.bite = d.biteDur;
      d.biteHit = false;
      d.cd = st.cd;
    }
    if (d.bite > 0 && !d.biteHit) {
      const u = 1 - d.bite / d.biteDur;
      if (u >= 0.68 && dist < st.reach + 0.35 && Math.abs(d.y - this.py) < 2.6) {
        d.biteHit = true;
        this.hurt(st.dmg, d.kind);
        if (!herb) {
          d.hunger = Math.max(0, d.hunger - 38);
          if (d.hunger < d.taste) d.interested = false;
        }
      }
    }
  }

  private standClear(d: Dino) {
    const mid = this.standH(d.x, d.z);
    if (!inWaterAt(d.x, d.z)) return mid;
    let top = mid;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      top = Math.max(top, this.standH(d.x + Math.cos(a) * 6, d.z + Math.sin(a) * 6));
    }
    return top;
  }

  private leaveWater(d: Dino) {
    if (!inWaterAt(d.x, d.z) && this.standH(d.x, d.z) > 2.2) return;
    let bestX = d.x;
    let bestZ = d.z;
    let bestH = -999;
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const tx = d.x + Math.cos(a) * (d.kind === "rex" ? 12 : 7);
      const tz = d.z + Math.sin(a) * (d.kind === "rex" ? 12 : 7);
      if (inWaterAt(tx, tz)) continue;
      const h = this.standH(tx, tz);
      if (h > bestH) {
        bestH = h;
        bestX = tx;
        bestZ = tz;
      }
    }
    if (bestH > 2) {
      d.x = bestX;
      d.z = bestZ;
      d.homeX = bestX;
      d.homeZ = bestZ;
    }
  }

  private sniffMeat(d: Dino) {
    for (const m of this.meats) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - d.x, m.z - d.z) > 1.7) continue;
      m.alive = false;
      m.mesh.visible = false;
      d.hunger = Math.max(0, d.hunger - 46);
      d.interested = false;
      return;
    }
  }

  private bodyAt(x: number, z: number) {
    for (const d of this.dinos) {
      if (d.dead || d.kind === "flyer") continue;
      if (Math.hypot(d.x - x, d.z - z) < 0.48 + d.radius) return true;
    }
    return false;
  }

  private keepBodiesApart() {
    const self = 0.48;
    for (const d of this.dinos) {
      if (d.dead || d.kind === "flyer") continue;
      const dx = d.x - this.px;
      const dz = d.z - this.pz;
      const min = self + d.radius;
      const dist = Math.hypot(dx, dz);
      if (dist >= min) continue;
      const nx = dist < 0.001 ? 1 : dx / dist;
      const nz = dist < 0.001 ? 0 : dz / dist;
      const push = min - dist;
      d.x += nx * push;
      d.z += nz * push;
      this.px -= nx * push * 0.35;
      this.pz -= nz * push * 0.35;
    }
  }

  private separate() {
    for (let i = 0; i < this.dinos.length; i += 1) {
      for (let j = i + 1; j < this.dinos.length; j += 1) {
        const a = this.dinos[i];
        const b = this.dinos[j];
        if (a.dead || b.dead) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const min = (a.radius + b.radius) * 0.85;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.001 && dist < min) {
          const p = ((min - dist) / dist) * 0.5;
          a.x -= dx * p;
          a.z -= dz * p;
          b.x += dx * p;
          b.z += dz * p;
        }
      }
    }
  }

  private hurt(amount: number, cause: string) {
    if (this.invuln > 0 || this.mode !== "play") return;
    this.hp -= amount;
    this.invuln = 0.7;
    this.trauma = Math.min(1, this.trauma + 0.55);
    this.audio.hurt();
    this.skin.emissive.setHex(0x5a1c14);
    if (this.hp <= 0) this.die(cause);
  }

  private die(cause: string) {
    if (this.mode !== "play") return;
    this.hp = 0;
    this.mode = "dead";
    this.crafting = false;
    this.epitaphText = epitaph(cause);
    this.exitLock();
    this.audio.die();
    this.commitScore();
    this.mark();
  }

  private tickNodes(dt: number) {
    for (const n of this.nodes) {
      if (n.alive || n.hold) continue;
      n.timer -= dt;
      if (n.timer <= 0) {
        n.alive = true;
        n.hp = n.max;
        n.timer = 0;
        this.showNode(n);
      }
    }
  }

  private tickMeat(dt: number) {
    for (const m of this.meats) {
      if (!m.alive) continue;
      m.life -= dt;
      m.mesh.rotation.y += dt;
      if (m.life <= 0) {
        m.alive = false;
        m.mesh.visible = false;
      }
    }
  }

  private tickDay(dt: number) {
    this.dayT += dt / 96;
    if (this.dayT >= 1) {
      this.dayT -= 1;
      this.dawn += 1;
      this.audio.dawn();
      this.say("Dawn " + this.dawn);
      this.mark();
    }
    const elev = Math.sin(this.dayT * Math.PI * 2 - 0.35);
    const daylight = clamp(elev * 0.55 + 0.38, 0.14, 1);
    const night = daylight < 0.32;
    if (night !== this.night) {
      this.night = night;
      this.audio.setNight(night);
    }
  }

  private stepLeg(leg: THREE.Object3D | undefined, swing: number) {
    if (!leg) return;
    leg.rotation.x = swing;
    const knee = leg.getObjectByName("knee");
    if (knee) knee.rotation.x = 0.22 + Math.max(0, swing) * 1.05;
  }

  private plantFeet(d: Dino) {
    d.group.updateMatrixWorld(true);
    let foot = Infinity;
    d.group.traverse((obj) => {
      if (obj.name !== "sole") return;
      const box = new THREE.Box3().setFromObject(obj);
      if (box.min.y < foot) foot = box.min.y;
    });
    if (!Number.isFinite(foot)) return;
    const ground = this.standH(d.x, d.z);
    d.group.position.y += ground - foot;
  }

  private syncSky() {
    const elev = Math.sin(this.dayT * Math.PI * 2 - 0.35);
    const daylight = clamp(elev * 0.55 + 0.38, 0.14, 1);
    this.sky.lerpColors(this.nightC, this.dayC, daylight);
    this.scene.background = this.sky;
    const horizon = this.sky.clone().lerp(new THREE.Color(0xe8a86a), daylight * 0.22);
    this.fog.color.copy(horizon);
    this.fog.density = 0.0048 + (1 - daylight) * 0.0035;
    this.ambi.intensity = 0.18 + daylight * 0.2;
    this.hemi.intensity = 0.4 + daylight * 0.62;
    this.hemi.color.lerpColors(new THREE.Color(0x243044), new THREE.Color(0x7eb6e4), daylight);
    this.sun.intensity = 0.22 + daylight * 2.05;
    this.sun.color.lerpColors(new THREE.Color(0x8aa4c8), new THREE.Color(0xffd59a), daylight);
    const ang = this.dayT * Math.PI * 2;
    const dirX = Math.cos(ang);
    const dirZ = Math.sin(ang);
    const dirY = 0.35 + daylight * 0.9;
    this.sun.position.set(this.px + dirX * 28, this.py + dirY * 24, this.pz + dirZ * 18);
    this.sun.target.position.set(this.px, this.py + 1, this.pz);
    this.sun.target.updateMatrixWorld();
    const far = 120;
    this.sunDisc.position.set(this.px + dirX * far, this.py + dirY * far * 0.72, this.pz + dirZ * far * 0.7);
    (this.sunDisc.material as THREE.MeshBasicMaterial).color.lerpColors(new THREE.Color(0x8899aa), new THREE.Color(0xffe6b0), daylight);
    this.sunDisc.scale.setScalar(0.55 + daylight * 0.7);
    const top = this.skyMat.uniforms.top.value as THREE.Color;
    const hor = this.skyMat.uniforms.horizon.value as THREE.Color;
    const bot = this.skyMat.uniforms.bottom.value as THREE.Color;
    top.lerpColors(new THREE.Color(0x0c1422), new THREE.Color(0x3d8ec9), daylight);
    hor.lerpColors(new THREE.Color(0x1a2433), new THREE.Color(0xf0b56e), daylight);
    bot.lerpColors(new THREE.Color(0x10151c), new THREE.Color(0xc46a38), daylight);
  }

  private present(dt: number) {
    this.followTerrain(this.px, this.pz);
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    if (this.skin.emissive.r > 0) this.skin.emissive.multiplyScalar(Math.max(0, 1 - dt * 4));
    const amp = Math.min(1, this.speed / WALK);
    const swing = Math.sin(this.phase);
    this.legL.rotation.x = swing * 0.7 * amp;
    this.legR.rotation.x = -swing * 0.7 * amp;
    const k = this.attackT > 0 ? Math.sin((1 - this.attackT / this.attackDur) * Math.PI) : 0;
    const armed = this.slots[this.selected] != null;
    if (!armed) {
      this.arm.rotation.set(-0.22 - k * 1.4 + swing * 0.1 * amp, 0, 0.3 - k * 0.45);
      this.elbow.rotation.set(-0.9 + k * 0.8, 0, 0);
      this.offArm.rotation.set(-0.2 - swing * 0.16 * amp, 0, -0.28);
      this.offElbow.rotation.set(-0.4, 0, 0);
    } else if (this.attackT > 0) {
      const u = 1 - this.attackT / Math.max(0.2, this.attackDur);
      this.arm.rotation.set(-2.2 + u * 2.15, 0.25, 0.62);
      this.elbow.rotation.set(-1.25 + u * 1.15, 0, 0);
      this.offArm.rotation.set(-0.4, 0, -0.5);
      this.offElbow.rotation.set(-0.3, 0, 0);
    } else {
      this.arm.rotation.set(-0.18 + swing * 0.06 * amp, 0.04, 0.5);
      this.elbow.rotation.set(-0.22, 0, 0);
      this.offArm.rotation.set(-0.28 - swing * 0.12 * amp, 0, -0.42);
      this.offElbow.rotation.set(-0.18, 0, 0);
    }
    const breathe = 1 + Math.sin(this.clock * 1.7) * 0.012;
    this.torso.scale.set(1, breathe, 1);

    this.player.position.set(this.px, this.py, this.pz);
    this.basis(this.bodyYaw);
    this.player.lookAt(this.px + this.fx, this.py, this.pz + this.fz);

    for (const d of this.dinos) {
      if (d.dead) {
        d.group.visible = d.kind !== "rex";
        d.group.position.set(d.x, d.y - d.plant - d.fall * 0.35, d.z);
        d.group.rotation.set(d.fall, d.group.rotation.y, 0);
      } else {
        d.group.visible = true;
        const gy = d.y - d.plant;
        d.group.position.set(d.x, gy, d.z);
        const reach = 3;
        d.group.lookAt(d.x + d.fx * reach, gy, d.z + d.fz * reach);
        if (d.kind !== "flyer" && d.kind !== "rex") {
          const headD = 2.4;
          const tailD = 3.6;
          const gHead = this.standH(d.x - d.fx * headD, d.z - d.fz * headD);
          const gTail = this.standH(d.x + d.fx * tailD, d.z + d.fz * tailD);
          const pitch = clamp(Math.atan2(gHead - gTail, headD + tailD), -0.38, 0.38);
          d.group.rotateX(-pitch);
        }
        const moving = d.state !== "patrol" || Math.hypot(d.wx - d.x, d.wz - d.z) > 1.1;
        if (moving && d.kind !== "flyer") {
          const prev = d.phase;
          const rate = d.state === "chase" ? 6.4 : 3.5;
          d.phase += dt * rate;
          const stride = d.kind === "rex" || d.kind === "raptor" || d.kind === "sail" ? 0.9 : 0.62;
          const s = Math.sin(d.phase);
          this.stepLeg(d.legs[0], s * stride);
          this.stepLeg(d.legs[1], -s * stride);
          this.stepLeg(d.legs[2], -s * stride);
          this.stepLeg(d.legs[3], s * stride);
          const planted = Math.floor(prev / Math.PI) !== Math.floor(d.phase / Math.PI);
          const heavy = d.kind === "rex" || d.kind === "frill" || d.kind === "sail" || d.kind === "longneck" || d.kind === "club";
          if (planted && heavy && Math.hypot(d.x - this.px, d.z - this.pz) < 34) this.audio.stomp();
        } else if (d.kind !== "flyer") {
          for (const leg of d.legs) {
            leg.rotation.x *= 0.82;
            const knee = leg.getObjectByName("knee");
            if (knee) knee.rotation.x += (0.35 - knee.rotation.x) * 0.25;
          }
        }
        if (d.kind !== "flyer") this.plantFeet(d);
        if (d.wings[0]) d.wings[0].rotation.z = Math.sin(this.clock * 7 + d.x) * 0.55;
        if (d.wings[1]) d.wings[1].rotation.z = -Math.sin(this.clock * 7 + d.x) * 0.55;
        d.head.rotation.set(0, 0, 0);
        d.jaw.rotation.set(0, 0, 0);
        if (d.bite > 0) {
          d.bite = Math.max(0, d.bite - dt);
          const u = 1 - d.bite / d.biteDur;
          if (d.kind === "rex") {
            const side = d.biteKind % 2 === 0 ? 1 : -1;
            const wind = u < 0.34;
            if (wind) {
              const t = u / 0.34;
              d.head.rotation.x = -0.22 * t;
              d.head.rotation.y = side * 0.62 * t;
              d.jaw.rotation.x = t * 1.05;
            } else if (u < 0.7) {
              const t = (u - 0.34) / 0.36;
              d.head.rotation.x = -0.22 + t * 1.05;
              d.head.rotation.y = side * 0.62 * (1 - t);
              d.jaw.rotation.x = 1.05;
              d.group.position.y -= t * 0.55;
            } else {
              const t = (u - 0.7) / 0.3;
              d.head.rotation.x = 0.83 * (1 - t * 0.45);
              d.jaw.rotation.x = 1.05 * (1 - t);
              d.group.position.y -= 0.55 * (1 - t);
            }
          } else {
            const snap = Math.sin(Math.min(1, u) * Math.PI);
            if (d.biteKind === 0) d.jaw.rotation.x = snap * 0.75;
            else if (d.biteKind === 1) {
              d.jaw.rotation.x = snap * 0.4;
              d.head.rotation.y = Math.sin(u * Math.PI * 2) * 0.4;
            } else if (d.biteKind === 2) {
              d.head.rotation.x = snap * 0.45;
              d.jaw.rotation.x = snap * 0.95;
            } else {
              d.jaw.rotation.x = Math.max(0, Math.sin(u * Math.PI * 4)) * 0.7;
              d.head.rotation.z = Math.sin(u * Math.PI * 2) * 0.18;
            }
          }
        }
      }
    }

    this.flame.scale.y = 0.85 + Math.sin(this.clock * 14) * 0.18;
    this.fireLight.intensity = 5 + Math.sin(this.clock * 11) * 1.1 + (this.night ? 7 : 0);
    this.waterMat.uniforms.uTime.value = this.clock;
    const wx = Math.round(this.px / 40) * 40;
    const wz = Math.round(this.pz / 40) * 40;
    this.water.position.set(wx, 1.18, wz);
    (this.waterMat.uniforms.uOff.value as THREE.Vector2).set(wx, wz);
    this.clouds.rotation.y = this.clock * 0.012;
    this.syncSky();
    this.aimCamera(dt);
    this.paintHud();

    const tall = this.camera.aspect < 1;
    const fov = (tall ? 74 : 56) + (this.sprinting ? 6 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }
  }

  private aimCamera(dt: number) {
    if (this.mode === "menu") {
      const ang = this.reduce ? 0.72 : 0.72 + Math.sin(this.clock * 0.15) * 0.12;
      const dist = 5.2;
      const cx = CAMP.x + Math.sin(ang) * dist;
      const cz = CAMP.z - Math.cos(ang) * dist;
      this.camera.position.set(cx, groundHeight(cx, cz) + 1.85, cz);
      this.camera.lookAt(CAMP.x, groundHeight(CAMP.x, CAMP.z) + 1.2, CAMP.z);
      return;
    }
    this.basis(this.camYaw);
    const dist = 4.7;
    const cp = Math.cos(this.camPitch);
    const sp = Math.sin(this.camPitch);
    let x = this.px - this.fx * dist * cp;
    let y = this.py + 1.62 + dist * sp;
    let z = this.pz - this.fz * dist * cp;
    const floor = Math.max(this.standH(x, z), 1.15) + 0.45;
    if (y < floor) y = floor;
    if (!this.reduce && this.speed > 0.5 && this.jumpH < 0.08) {
      y += Math.sin(this.phase) * 0.04;
      x += this.rx * Math.cos(this.phase * 0.5) * 0.025;
      z += this.rz * Math.cos(this.phase * 0.5) * 0.025;
    }
    if (!this.reduce && this.shakeOn && this.trauma > 0) {
      const s = this.trauma * this.trauma;
      x += (Math.random() - 0.5) * s * 0.35;
      y += (Math.random() - 0.5) * s * 0.22;
    }
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.px, this.py + 1.28, this.pz);
    void dt;
  }

  private paintHud() {
    const bar = (el: HTMLElement | null, v: number) => {
      if (el) el.style.width = `${clamp(v, 0, 100)}%`;
    };
    bar(this.hud.hp, this.hp);
    bar(this.hud.hunger, this.hunger);
    bar(this.hud.thirst, this.thirst);
    bar(this.hud.stamina, this.stamina);
    if (this.hud.vignette) {
      let a = 0;
      if (this.mode === "play" && this.invuln > 0) a = 0.45;
      else if (this.mode === "play" && this.hp < 32) a = 0.28;
      this.hud.vignette.style.opacity = String(a);
    }
  }

  private hintLine() {
    if (this.crafting) return "The book is open. E or C closes it.";
    if (this.mode !== "play") return "";
    if (this.inWater && this.thirst < 99) return "Water · hold E to drink";
    if (this.thirst < 30) return "Thirsty. River is east, pool is west — not ahead.";
    if (this.hunger < 32) return "Hungry · G eats meat, then berries";
    const near = this.nearLine();
    if (near) return near;
    if (!this.slots[this.selected]) return "Empty hands. Punch with click or J. Craft at the camp table.";
    return "WASD · mouse look · Shift sprint · J strike · E gather";
  }

  private nearLine() {
    let best = 2.6;
    let text = "";
    for (const n of this.nodes) {
      if (!n.alive) continue;
      const dist = Math.hypot(n.x - this.px, n.z - this.pz);
      if (dist > best) continue;
      if (n.kind === "berry") text = "Berries · E to pick";
      else if (n.kind === "stick") text = "Stick · E to pick up";
      else if (n.kind === "log") text = "Wood · E to pick up";
      else if (n.kind === "tree") text = this.tool.kind === "axe" ? "Tree · one axe swing fells it" : "Tree · an axe fells it fast";
      else if (n.kind === "rock") {
        const ore = n.ore ?? "stone";
        const label = ore === "stone" ? "Rock" : ore === "iron" ? "Iron ore" : "Diamond ore";
        const need = ore === "diamond" ? "iron" : ore === "iron" ? "stone" : "wood";
        if (this.tool.kind !== "pick") text = `${label} · craft a pickaxe`;
        else if (TIER_RANK[this.tool.tier] < TIER_RANK[need]) text = `${label} · needs a ${need} pick`;
        else text = `${label} · the pick breaks it`;
      }
      else continue;
      best = dist;
    }
    for (const m of this.meats) {
      if (!m.alive) continue;
      const dist = Math.hypot(m.x - this.px, m.z - this.pz);
      if (dist < best) {
        best = dist;
        text = "Meat · E to take";
      }
    }
    if (this.atBench() && best > 2.1) return "Recipe book · E to open";
    return text;
  }

  private basis(yaw: number) {
    this.fx = -Math.sin(yaw);
    this.fz = -Math.cos(yaw);
    this.rx = Math.cos(yaw);
    this.rz = -Math.sin(yaw);
  }

  private resetSim() {
    this.px = CAMP.x;
    this.pz = CAMP.z;
    this.py = groundHeight(this.px, this.pz);
    this.vy = 0;
    this.jumpH = 0;
    this.speed = 0;
    this.hp = 100;
    this.hunger = 78;
    this.thirst = 74;
    this.stamina = 100;
    this.invuln = 0;
    this.attackCd = 0;
    this.attackT = 0;
    this.drinkT = 0;
    this.kills = 0;
    this.meals = 0;
    this.drinks = 0;
    this.crafts = 0;
    this.dawn = 1;
    this.dayT = 0.22;
    this.slots = [null, null, null, null, null, null];
    this.wear = [0, 0, 0, 0, 0, 0];
    this.selected = 0;
    this.mats = { wood: 0, stone: 0, stick: 0, berry: 0, meat: 0, iron: 0, diamond: 0 };
    this.banner = "";
    this.bannerT = 0;
    this.hint = "Empty hands. Punch with click or J. The recipe book is on the camp table.";
    this.place = "Camp rise";
    this.record = false;
    this.epitaphText = "";
    this.equip();
    for (const n of this.nodes) {
      if (n.hold) {
        n.alive = false;
        n.timer = 0;
        this.hideNode(n);
        continue;
      }
      n.alive = true;
      n.hp = n.max;
      n.timer = 0;
      this.showNode(n);
    }
    for (const d of this.dinos) {
      const st = DINO_STAT[d.kind];
      if (d.kind === "rex") {
        d.dead = true;
        d.fall = 0;
        d.hp = st.hp;
        d.respawn = 28 + Math.random() * 50;
        d.group.visible = false;
        this.placeRex(d);
      } else {
        const used = this.dinos.filter((o) => o !== d).map((o) => ({ x: o.homeX, z: o.homeZ }));
        let spot = { x: d.homeX, z: d.homeZ };
        for (let i = 0; i < 12; i += 1) {
          const trySpot = randomWildSpot(d.kind === "flyer" ? 18 : 14, used);
          if (d.kind === "flyer" || !inWaterAt(trySpot.x, trySpot.z)) {
            spot = trySpot;
            break;
          }
        }
        d.homeX = spot.x;
        d.homeZ = spot.z;
        d.wx = spot.x;
        d.wz = spot.z;
        d.x = spot.x;
        d.z = spot.z;
        d.y = this.standH(d.x, d.z) + (d.kind === "flyer" ? 6 : 0);
        d.hp = st.hp;
        d.dead = false;
        d.fall = 0;
        d.respawn = 0;
        d.group.visible = true;
      }
      d.state = "patrol";
      d.cd = 1;
      calm(d);
      d.hover = d.kind === "flyer" ? 6 : 0;
      d.mat.emissive.setHex(0x000000);
    }
    for (const m of this.meats) {
      m.alive = false;
      m.mesh.visible = false;
    }
    if (this.mode === "menu") {
      this.camYaw = 0.15;
      this.bodyYaw = 0.05;
    }
  }

  private placeRex(d: Dino) {
    let spot = randomWildSpot(84);
    for (let i = 0; i < 10; i += 1) {
      const trySpot = randomWildSpot(84);
      const far = Math.hypot(trySpot.x - this.px, trySpot.z - this.pz) > 36;
      if (far && !inWaterAt(trySpot.x, trySpot.z) && this.standH(trySpot.x, trySpot.z) > 3) {
        spot = trySpot;
        break;
      }
    }
    d.homeX = spot.x;
    d.homeZ = spot.z;
    d.x = spot.x;
    d.z = spot.z;
    d.wx = spot.x;
    d.wz = spot.z - 6;
    d.y = this.standH(spot.x, spot.z);
    d.fx = 0;
    d.fz = -1;
    d.face = 0;
  }

  private spendTool() {
    const id = this.slots[this.selected];
    if (!id) return;
    this.wear[this.selected] = Math.max(0, this.wear[this.selected] - 1);
    if (this.wear[this.selected] > 0) {
      this.mark();
      return;
    }
    const name = TOOLS[id].name;
    this.slots[this.selected] = null;
    this.equip();
    this.say(name + " broke");
    this.mark();
  }

  private equip() {
    const id = this.slots[this.selected];
    this.tool = id ? TOOLS[id] : FIST;
    const old = this.hand.getObjectByName("tool");
    if (old) {
      this.hand.remove(old);
      old.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material;
        if (!Array.isArray(mat) && mat) mat.dispose();
      });
    }
    if (id) {
      const tool = makeTool(this.tool.kind, this.tool.tier);
      tool.name = "tool";
      this.hand.add(tool);
    }
  }

  private say(text: string) {
    this.banner = text;
    this.bannerT = 1.7;
    this.mark();
  }

  private mark() {
    this.dirty = true;
  }

  private currentScore() {
    return (this.dawn - 1) * 100 + this.kills * 25 + this.crafts * 12 + this.meals * 6 + this.drinks * 6;
  }

  private commitScore() {
    const score = this.currentScore();
    this.record = score > this.bestScore || this.dawn > this.bestDawn;
    if (score > this.bestScore) this.bestScore = score;
    if (this.dawn > this.bestDawn) this.bestDawn = this.dawn;
    this.save();
  }

  private snapshot(): Snapshot {
    return {
      mode: this.mode,
      dawn: this.dawn,
      score: this.currentScore(),
      kills: this.kills,
      meals: this.meals,
      drinks: this.drinks,
      epitaph: this.epitaphText,
      bestDawn: this.bestDawn,
      bestScore: this.bestScore,
      muted: this.audio.muted,
      shake: this.shakeOn,
      record: this.record,
      crafting: this.crafting,
      slots: [...this.slots],
      selected: this.selected,
      wood: this.mats.wood,
      stone: this.mats.stone,
      stick: this.mats.stick,
      berry: this.mats.berry,
      meat: this.mats.meat,
      iron: this.mats.iron,
      diamond: this.mats.diamond,
      wear: [...this.wear],
      hint: this.hint,
      banner: this.banner,
      place: this.place,
      toolName: this.slots[this.selected]
        ? `${this.tool.name} ${this.wear[this.selected]}/${this.tool.uses}`
        : this.tool.name,
    };
  }

  private publish() {
    this.dirty = false;
    this.onSnap(this.snapshot());
  }

  private exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem("ember-age-v1");
      if (!raw) return;
      const data = JSON.parse(raw) as { bestDawn?: number; bestScore?: number; muted?: boolean; shake?: boolean };
      this.bestDawn = data.bestDawn ?? 0;
      this.bestScore = data.bestScore ?? 0;
      this.shakeOn = data.shake !== false;
      if (data.muted) this.audio.setMuted(true);
    } catch {
      /* ignore broken saves */
    }
  }

  private save() {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ bestDawn: this.bestDawn, bestScore: this.bestScore, muted: this.audio.muted, shake: this.shakeOn }),
      );
    } catch {
      /* private mode */
    }
  }

  private makeMats() {
    const std = (color: number, roughness = 0.86, map?: THREE.Texture) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness: 0.02,
        ...(map ? { map } : {}),
      });
    const grass = texCanvas(256, (ctx) => {
      noisePaint(ctx, "#c8c2b4", ["#b7c4a4", "#d2c6b0", "#9aaa88", "#ddd4c4", "#8e9a78"], 180);
    }, 10);
    const bark = texCanvas(128, (ctx) => {
      ctx.fillStyle = "#6a4328";
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 18; i += 1) {
        ctx.fillStyle = i % 2 ? "#3e2616" : "#8a5a34";
        ctx.fillRect(i * 7 + 2, 0, 2 + (i % 3), 128);
      }
    });
    const leaf = texCanvas(128, (ctx) => {
      noisePaint(ctx, "#2f5c2c", ["#1e4420", "#4e8434", "#163618", "#6a9a40", "#245028"], 280);
    });
    const leafLight = texCanvas(128, (ctx) => {
      noisePaint(ctx, "#6a8a3c", ["#7ea04a", "#4e7030", "#8aaa52", "#3d5e28"], 200);
    });
    const rock = texCanvas(128, (ctx) => {
      noisePaint(ctx, "#7a756c", ["#5c5852", "#918b82", "#6a6560", "#a39c92", "#4a4642"], 280);
    });
    const hide = texCanvas(256, (ctx) => {
      noisePaint(ctx, "#6b4128", ["#4a2c18", "#8a5836", "#3a2214", "#a06840", "#5c3420"], 340);
      ctx.strokeStyle = "#ead8b0";
      ctx.lineWidth = 2;
      for (let y = 18; y < 256; y += 32) {
        ctx.beginPath();
        for (let x = 6; x < 250; x += 12) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + 5, y + 7);
        }
        ctx.stroke();
      }
    });
    const skinTex = texCanvas(128, (ctx) => {
      noisePaint(ctx, "#d9a784", ["#e8c09a", "#c48b68", "#f0d0b0", "#b87d5c", "#e0b48c"], 220);
    });
    return {
      ground: new THREE.MeshStandardMaterial({
        map: grass,
        vertexColors: true,
        roughness: 0.94,
        metalness: 0,
      }),
      trunk: std(0xffffff, 0.9, bark),
      leaf: std(0xffffff, 0.88, leaf),
      leafLight: std(0xffffff, 0.86, leafLight),
      rock: std(0xffffff, 0.92, rock),
      berry: std(0x8a3e4a, 0.8),
      stick: std(0x7a5232, 0.86),
      tuft: std(0x4e8a48, 0.84),
      wood: std(0x8a5a32, 0.84),
      woodDark: std(0x5a3a22, 0.86),
      stone: new THREE.MeshStandardMaterial({ color: 0xc8c2b8, roughness: 0.42, metalness: 0.18, map: rock }),
      skin: std(0xffffff, 0.58, skinTex),
      hide: std(0xffffff, 0.82, hide),
      hair: std(0x24160f, 0.8),
      fire: new THREE.MeshBasicMaterial({ color: 0xff6a2a }),
      fireCore: new THREE.MeshBasicMaterial({ color: 0xffe08a }),
      meat: std(0x8a3a32, 0.7),
      pelt: std(0xffffff, 0.86, hide),
    };
  }

  private buildTerrain(mat: THREE.Material) {
    const seg = this.terrainSeg;
    const span = this.terrainSpan;
    const geo = new THREE.PlaneGeometry(span, span, seg, seg);
    geo.rotateX(-Math.PI / 2);
    this.heightGrid = new Float32Array(geo.attributes.position.count);
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.terrainMesh = mesh;
    this.scene.add(mesh);
    this.followTerrain(0, 0, true);
  }

  private followTerrain(x: number, z: number, force = false) {
    const mesh = this.terrainMesh;
    const grid = this.heightGrid;
    if (!mesh || !grid) return;
    const seg = this.terrainSeg;
    const span = this.terrainSpan;
    const step = span / seg;
    const ox = Math.round(x / step) * step;
    const oz = Math.round(z / step) * step;
    if (!force && ox === this.terrainOx && oz === this.terrainOz) return;
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const col = geo.attributes.color;
    if (!col) return;
    const stride = seg + 1;
    mesh.position.set(ox, 0, oz);
    for (let i = 0; i < pos.count; i += 1) {
      const h = groundHeight(pos.getX(i) + ox, pos.getZ(i) + oz);
      grid[i] = h;
      pos.setY(i, h);
    }
    const c = new THREE.Color();
    const grass = new THREE.Color(0x3f6b32);
    const alpine = new THREE.Color(0x6d8a48);
    const dry = new THREE.Color(0x8a7348);
    const mud = new THREE.Color(0x6a4e34);
    const rock = new THREE.Color(0x6e6860);
    for (let iz = 0; iz < stride; iz += 1) {
      for (let ix = 0; ix < stride; ix += 1) {
        const i = iz * stride + ix;
        const h = grid[i] ?? 0;
        const l = grid[iz * stride + Math.max(0, ix - 1)] ?? h;
        const r = grid[iz * stride + Math.min(seg, ix + 1)] ?? h;
        const d = grid[Math.max(0, iz - 1) * stride + ix] ?? h;
        const u = grid[Math.min(seg, iz + 1) * stride + ix] ?? h;
        const slope = Math.hypot(r - l, u - d) / step;
        if (h < 1.6) c.copy(mud);
        else if (slope > 0.34) c.copy(rock);
        else if (slope > 0.2) c.copy(dry);
        else if (h > 12) c.copy(alpine);
        else c.copy(grass);
        c.lerp(new THREE.Color(0xfff6ea), 0.12);
        col.setXYZ(i, c.r, c.g, c.b);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeVertexNormals();
    const normals = geo.attributes.normal;
    if (normals) normals.needsUpdate = true;
    this.terrainOx = ox;
    this.terrainOz = oz;
  }

  private buildWater() {
    this.waterMat = new THREE.ShaderMaterial({
      transparent: true,
      fog: true,
      uniforms: {
        uTime: { value: 0 },
        uOff: { value: new THREE.Vector2() },
        uColor: { value: new THREE.Color(0x2f8f86) },
        uDeep: { value: new THREE.Color(0x0d3c42) },
        fogColor: { value: new THREE.Color(0xd7b48a) },
        fogDensity: { value: 0.016 },
        fogNear: { value: 1 },
        fogFar: { value: 120 },
      },
      vertexShader: `
        #include <fog_pars_vertex>
        uniform float uTime;
        uniform vec2 uOff;
        varying float vW;
        void main() {
          vec3 p = position;
          float x = p.x + uOff.x;
          float y = p.y + uOff.y;
          float w = sin(x * 0.42 + uTime * 1.3) * cos(y * 0.33 + uTime * 0.9) * 0.12;
          w += sin(x * 0.15 - uTime * 0.6) * 0.05;
          p.z += w;
          vW = w;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        #include <fog_pars_fragment>
        uniform vec3 uColor;
        uniform vec3 uDeep;
        varying float vW;
        void main() {
          vec3 col = mix(uDeep, uColor, clamp(0.45 + vW * 3.5, 0.0, 1.0));
          col += vec3(0.35, 0.45, 0.4) * smoothstep(0.04, 0.1, vW);
          gl_FragColor = vec4(col, 0.84);
          #include <fog_fragment>
        }
      `,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(860, 860, 24, 24), this.waterMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 1.18;
    this.scene.add(mesh);
    return mesh;
  }

  private buildScatter(mats: ReturnType<EmberRuntime["makeMats"]>) {
    const items = scatterValley();
    const buckets: Record<Exclude<NodeKind, "grass"> | "grass", number> = {
      tree: 0,
      rock: 0,
      berry: 0,
      stick: 0,
      log: 0,
      grass: 0,
    };
    for (const s of items) buckets[s.kind] += 1;
    this.trunks = this.instances(new THREE.CylinderGeometry(0.18, 0.34, 2.15, 7), mats.trunk, buckets.tree);
    this.leaves = this.instances(new THREE.IcosahedronGeometry(0.95, 1), mats.leaf, buckets.tree);
    this.crowns = this.instances(new THREE.IcosahedronGeometry(0.62, 0), mats.leafLight, buckets.tree);
    this.rocks = this.instances(new THREE.IcosahedronGeometry(0.72, 1), mats.rock, buckets.rock);
    this.berries = this.instances(new THREE.IcosahedronGeometry(0.42, 0), mats.berry, buckets.berry);
    this.sticks = this.instances(new THREE.CylinderGeometry(0.035, 0.045, 0.85, 5), mats.stick, buckets.stick);
    this.logs = this.instances(new THREE.CylinderGeometry(0.13, 0.16, 1.25, 7), mats.trunk, buckets.log + 18);
    const grass = this.instances(new THREE.ConeGeometry(0.08, 0.55, 4), mats.tuft, buckets.grass);
    grass.castShadow = false;
    grass.receiveShadow = false;
    const cursor = { tree: 0, rock: 0, berry: 0, stick: 0, log: 0, grass: 0 };
    for (const s of items) {
      const y = this.standH(s.x, s.z);
      const i = cursor[s.kind];
      cursor[s.kind] += 1;
      if (s.kind === "grass") {
        this.setInstance(grass, i, s.x, y + 0.18 * s.scale, s.z, 0, s.rot, 0, s.scale, s.scale, s.scale);
        continue;
      }
      const oreHp = s.ore === "diamond" ? 150 : s.ore === "iron" ? 110 : 80;
      const node: Node = {
        kind: s.kind,
        x: s.x,
        z: s.z,
        y,
        rot: s.rot,
        scale: s.scale,
        hp: s.kind === "rock" ? oreHp : maxHp(s.kind),
        max: s.kind === "rock" ? oreHp : maxHp(s.kind),
        alive: true,
        timer: 0,
        idx: i,
        ore: s.ore,
      };
      this.nodes.push(node);
      this.showNode(node);
    }
    for (let i = 0; i < 18; i += 1) {
      const node: Node = {
        kind: "log",
        x: 0,
        z: 0,
        y: -8,
        rot: 0,
        scale: 1,
        hp: 1,
        max: 1,
        alive: false,
        timer: 0,
        idx: buckets.log + i,
        hold: true,
      };
      this.nodes.push(node);
      this.hideNode(node);
    }
  }

  private instances(geo: THREE.BufferGeometry, mat: THREE.Material, count: number) {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
    mesh.frustumCulled = false;
    mesh.count = count;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  private showNode(n: Node) {
    const s = n.scale;
    if (n.kind === "tree") {
      this.setInstance(this.trunks, n.idx, n.x, n.y + 1.05 * s, n.z, 0, n.rot, 0, s * 0.85, s, s * 0.85);
      this.setInstance(this.leaves, n.idx, n.x, n.y + 2.15 * s, n.z, 0.15, n.rot, 0.1, s * 1.15, s * 0.82, s * 1.15);
      this.setInstance(this.crowns, n.idx, n.x + 0.05 * s, n.y + 2.85 * s, n.z, 0.2, n.rot, 0, s * 0.95, s * 0.7, s * 0.95);
    } else if (n.kind === "rock") {
      const lean = Math.sin(n.x * 0.37 + n.z * 0.21) * 0.28;
      this.setInstance(this.rocks, n.idx, n.x, n.y - 0.34 * s, n.z, lean, n.rot, lean * 0.45, s * 1.35, s * 0.48, s * 1.05);
      const tint = n.ore === "diamond" ? 0x8fd4ea : n.ore === "iron" ? 0xb08a62 : 0xffffff;
      this.rocks.setColorAt(n.idx, new THREE.Color(tint));
      if (this.rocks.instanceColor) this.rocks.instanceColor.needsUpdate = true;
    } else if (n.kind === "berry") {
      this.setInstance(this.berries, n.idx, n.x, n.y + 0.28 * s, n.z, 0, n.rot, 0, s, s * 0.8, s);
    } else if (n.kind === "stick") {
      this.setInstance(this.sticks, n.idx, n.x, n.y + 0.05, n.z, 0, n.rot, Math.PI / 2, s, s, s);
    } else if (n.kind === "log") {
      this.setInstance(this.logs, n.idx, n.x, n.y + 0.16, n.z, 0, 0, Math.PI / 2, s, s, s);
    }
  }

  private hideNode(n: Node) {
    const s = n.kind === "tree" ? 0.22 : 0.001;
    if (n.kind === "tree") {
      this.setInstance(this.trunks, n.idx, n.x, n.y + 0.12, n.z, 0, n.rot, 0, n.scale, 0.2, n.scale);
      this.setInstance(this.leaves, n.idx, n.x, n.y, n.z, 0, 0, 0, 0.001, 0.001, 0.001);
      this.setInstance(this.crowns, n.idx, n.x, n.y, n.z, 0, 0, 0, 0.001, 0.001, 0.001);
    } else if (n.kind === "rock") {
      this.setInstance(this.rocks, n.idx, n.x, n.y, n.z, 0, 0, 0, s, s, s);
    } else if (n.kind === "berry") {
      this.setInstance(this.berries, n.idx, n.x, n.y, n.z, 0, 0, 0, s, s, s);
    } else if (n.kind === "stick") {
      this.setInstance(this.sticks, n.idx, n.x, n.y, n.z, 0, 0, 0, s, s, s);
    } else if (n.kind === "log") {
      this.setInstance(this.logs, n.idx, n.x, n.y, n.z, 0, 0, 0, s, s, s);
    }
  }

  private setInstance(
    mesh: THREE.InstancedMesh,
    i: number,
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
    sx: number,
    sy: number,
    sz: number,
  ) {
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(rx, ry, rz);
    this.dummy.scale.set(sx, sy, sz);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(i, this.dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  private buildCamp(mats: ReturnType<EmberRuntime["makeMats"]>) {
    const y = groundHeight(CAMP.x, CAMP.z);
    const ring = new THREE.Group();
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), mats.rock);
      stone.position.set(Math.cos(a) * 0.78, 0.1, Math.sin(a) * 0.78);
      stone.scale.set(1, 0.65, 1);
      stone.castShadow = true;
      ring.add(stone);
    }
    for (let i = 0; i < 3; i += 1) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 6), mats.trunk);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = i * 0.7;
      log.position.y = 0.08 + i * 0.05;
      log.castShadow = true;
      ring.add(log);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.62, 6), mats.fire);
    flame.name = "flame";
    flame.position.y = 0.46;
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38, 5), mats.fireCore);
    core.position.y = 0.42;
    ring.add(flame, core);
    ring.position.set(CAMP.x + 1.6, y, CAMP.z + 0.2);
    this.fireLight.position.set(CAMP.x + 1.6, y + 0.9, CAMP.z + 0.2);
    this.scene.add(ring);
    this.buildBench(mats, groundHeight(this.benchX, this.benchZ));
  }

  private buildBench(mats: ReturnType<EmberRuntime["makeMats"]>, y: number) {
    const table = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.72), mats.wood);
    top.position.y = 0.72;
    const page = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.3), mats.stone);
    page.position.set(0.05, 0.78, 0.02);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.02, 0.34), mats.woodDark);
    cover.position.set(0.02, 0.8, 0.02);
    cover.rotation.y = -0.2;
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.34), mats.hide);
    spine.position.set(-0.2, 0.79, 0.02);
    for (const [x, z] of [
      [-0.42, -0.24],
      [0.42, -0.24],
      [-0.42, 0.24],
      [0.42, 0.24],
    ] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.7, 6), mats.trunk);
      leg.position.set(x, 0.35, z);
      table.add(leg);
    }
    table.add(top, page, cover, spine);
    table.position.set(this.benchX, y, this.benchZ);
    shadeCast(table);
    this.scene.add(table);
  }

  private buildClouds() {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff7ee, transparent: true, opacity: 0.72, depthWrite: false, fog: false });
    const spots = [
      [-28, 38, -10],
      [18, 42, -24],
      [40, 36, 8],
      [-8, 46, 30],
      [6, 40, -48],
      [-36, 44, -36],
    ];
    for (const [x, y, z] of spots) {
      const puff = new THREE.Group();
      for (let i = 0; i < 4; i += 1) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(2.4 + (i % 3), 8, 6), mat);
        s.position.set((i - 1.5) * 2.2, (i % 2) * 0.6, (i % 2) * 0.4);
        s.scale.set(1.3, 0.55, 0.9);
        puff.add(s);
      }
      puff.position.set(x ?? 0, y ?? 40, z ?? 0);
      group.add(puff);
    }
    this.scene.add(group);
    return group;
  }

  private buildPlayer(mats: ReturnType<EmberRuntime["makeMats"]>) {
    const group = new THREE.Group();
    const legGeo = new THREE.CapsuleGeometry(0.075, 0.36, 4, 8);
    legGeo.translate(0, -0.28, 0);
    const legL = new THREE.Group();
    const legR = new THREE.Group();
    const bootMat = mats.woodDark;
    for (const [leg, x] of [
      [legL, -0.12],
      [legR, 0.12],
    ] as const) {
      const thigh = new THREE.Mesh(legGeo, mats.skin);
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.086, 0.08, 8), mats.hide);
      wrap.position.y = -0.22;
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.22), bootMat);
      boot.position.set(0, -0.52, 0.03);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.06), mats.pelt);
      strap.position.set(0, -0.48, 0.06);
      leg.add(thigh, wrap, boot, strap);
      leg.position.set(x, 0.64, 0);
    }

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.28), mats.hide);
    torso.position.set(0, 1.04, 0);
    const pelt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), mats.pelt);
    pelt.position.set(0, 1.24, -0.02);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 12), mats.woodDark);
    belt.rotation.x = Math.PI / 2;
    belt.position.set(0, 0.78, 0);
    belt.scale.set(1.15, 1, 0.78);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.08), mats.hide);
    skirt.position.set(0, 0.66, 0.06);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 14), mats.skin);
    head.scale.set(0.94, 1.08, 0.96);
    head.position.set(0, 1.48, 0.02);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 12), mats.hair);
    hair.scale.set(1.08, 0.62, 1.15);
    hair.position.set(0, 1.56, -0.03);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.22, 3, 6), mats.hair);
    tail.position.set(0, 1.38, -0.12);
    tail.rotation.x = 0.6;
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.028, 0.04), mats.hair);
    brow.position.set(0, 1.53, 0.12);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.1), mats.skin);
    nose.position.set(0, 1.46, 0.16);
    const beard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.1), mats.hair);
    beard.position.set(0, 1.34, 0.08);
    const earGeo = new THREE.SphereGeometry(0.028, 6, 5);
    const earL = new THREE.Mesh(earGeo, mats.skin);
    const earR = new THREE.Mesh(earGeo, mats.skin);
    earL.position.set(-0.13, 1.48, 0);
    earR.position.set(0.13, 1.48, 0);
    const white = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.35 });
    const pupil = new THREE.MeshStandardMaterial({ color: 0x1a120e, roughness: 0.3 });
    const eyeGeo = new THREE.SphereGeometry(0.022, 8, 6);
    const eyeL = new THREE.Mesh(eyeGeo, white);
    const eyeR = new THREE.Mesh(eyeGeo, white);
    eyeL.position.set(-0.048, 1.49, 0.12);
    eyeR.position.set(0.048, 1.49, 0.12);
    const dotGeo = new THREE.SphereGeometry(0.01, 6, 5);
    const dotL = new THREE.Mesh(dotGeo, pupil);
    const dotR = new THREE.Mesh(dotGeo, pupil);
    dotL.position.set(-0.048, 1.49, 0.138);
    dotR.position.set(0.048, 1.49, 0.138);

    const arm = this.makeArm(mats, 1);
    const off = this.makeArm(mats, -1);
    group.add(
      legL,
      legR,
      torso,
      pelt,
      belt,
      skirt,
      head,
      hair,
      tail,
      brow,
      nose,
      beard,
      earL,
      earR,
      eyeL,
      eyeR,
      dotL,
      dotR,
      arm.shoulder,
      off.shoulder,
    );
    shadeCast(group);
    return { group, arm: arm.shoulder, hand: arm.palm, offArm: off.shoulder, elbow: arm.elbow, offElbow: off.elbow, legL, legR, torso };
  }

  private makeArm(mats: ReturnType<EmberRuntime["makeMats"]>, side: 1 | -1) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.24 * side, 1.24, 0.02);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), mats.skin);
    upper.position.y = -0.16;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.058, 0.07, 8), mats.hide);
    band.position.y = -0.08;
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.18, 4, 8), mats.skin);
    fore.position.y = -0.14;
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.05, 0.09, 8), mats.pelt);
    wrap.position.y = -0.1;
    const palm = new THREE.Group();
    palm.position.y = -0.28;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mats.skin);
    ball.scale.set(1.05, 0.75, 1.2);
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), mats.skin);
    thumb.position.set(-0.04 * side, 0.01, 0.03);
    palm.add(ball, thumb);
    fore.add(wrap);
    elbow.add(fore, palm);
    shoulder.add(upper, band, elbow);
    return { shoulder, elbow, palm };
  }

  private buildDinos() {
    for (const seed of DINO_SEEDS) {
      const st = DINO_STAT[seed.kind];
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: hideMap(seed.kind),
        roughness: seed.kind === "flyer" ? 0.62 : 0.74,
        metalness: 0.03,
      });
      const rig = makeDino(seed.kind, mat);
      rig.group.scale.setScalar(st.scale);
      rig.group.updateMatrixWorld(true);
      let plant = 0;
      if (seed.kind !== "flyer") {
        rig.group.updateMatrixWorld(true);
        let minY = Infinity;
        rig.group.traverse((obj) => {
          if (obj.name !== "sole") return;
          const box = new THREE.Box3().setFromObject(obj);
          if (box.min.y < minY) minY = box.min.y;
        });
        plant = Number.isFinite(minY) ? minY : 0;
      }
      this.scene.add(rig.group);
      this.dinos.push({
        kind: seed.kind,
        x: seed.x,
        y: groundHeight(seed.x, seed.z),
        z: seed.z,
        fx: 0,
        fz: -1,
        face: 0,
        hp: st.hp,
        homeX: seed.x,
        homeZ: seed.z,
        wx: seed.x,
        wz: seed.z - 2,
        wander: 1,
        cd: 1,
        state: "patrol",
        ...mood(),
        dead: false,
        respawn: 0,
        fall: 0,
        hover: seed.kind === "flyer" ? 6 : 0,
        plant,
        radius: st.radius,
        phase: Math.random() * 6,
        group: rig.group,
        legs: rig.legs,
        wings: rig.wings,
        head: rig.head,
        jaw: rig.jaw,
        bite: 0,
        biteDur: 0.4,
        biteKind: 0,
        biteHit: false,
        mat,
      });
    }
  }

  private buildMeat() {
    const geo = new THREE.BoxGeometry(0.28, 0.12, 0.18);
    const mat = new THREE.MeshLambertMaterial({ color: 0x8a3a32 });
    for (let i = 0; i < 12; i += 1) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.meats.push({ alive: false, x: 0, y: 0, z: 0, n: 1, life: 0, mesh });
    }
  }
}

function makeDino(kind: DinoKind, mat: THREE.MeshStandardMaterial) {
  if (kind === "frill") return makeFrill(mat);
  if (kind === "grazer") return makeGrazer(mat);
  if (kind === "flyer") return makeFlyer(mat);
  if (kind === "sail") return makeSail(mat);
  if (kind === "longneck") return makeLongneck(mat);
  if (kind === "club") return makeClub(mat);
  if (kind === "rex") return makeHunter(mat, "rex");
  if (kind === "raptor") return makeMovieRaptor(mat);
  return makeHunter(mat, "compy");
}

function makeSail(mat: THREE.Material) {
  const group = new THREE.Group();
  group.add(
    spineMesh(
      [
        { x: 0, y: 0.85, z: -1.8, rx: 0.04, ry: 0.03 },
        { x: 0, y: 0.95, z: -0.8, rx: 0.16, ry: 0.18 },
        { x: 0, y: 1.02, z: 0.05, rx: 0.22, ry: 0.24 },
        { x: 0, y: 1.08, z: 0.55, rx: 0.14, ry: 0.15 },
        { x: 0, y: 1.16, z: 0.9, rx: 0.09, ry: 0.1 },
        { x: 0, y: 1.24, z: 1.2, rx: 0.07, ry: 0.075 },
        { x: 0, y: 1.3, z: 1.42, rx: 0.055, ry: 0.06 },
      ],
      8,
      mat,
    ),
  );
  const finMat = new THREE.MeshStandardMaterial({ color: 0x6a3428, roughness: 0.7, side: THREE.DoubleSide });
  const sailShape = new THREE.Shape();
  sailShape.moveTo(-0.7, 0);
  sailShape.lineTo(-0.4, 0.28);
  sailShape.lineTo(0.05, 0.48);
  sailShape.lineTo(0.38, 0.36);
  sailShape.lineTo(0.68, 0.08);
  sailShape.lineTo(0.74, 0);
  sailShape.closePath();
  const sailGeo = new THREE.ExtrudeGeometry(sailShape, {
    depth: 0.03,
    bevelEnabled: false,
  });
  sailGeo.translate(0, 0, -0.015);
  const sail = new THREE.Mesh(sailGeo, finMat);
  sail.rotation.y = Math.PI / 2;
  sail.position.set(0, 1.32, -0.15);
  group.add(sail);
  const bite = beastHead(mat, 1.38, 1.62, 0.16, 0.28, 6, 0.035, 0.028, 0.55);
  group.add(bite.head);
  for (const side of [-1, 1] as const) clawArm(group, mat, side, 0.2, 1.02, 0.5, 0.2, 0.16, 0.035, 3, 0.08, "hang");
  const legL = hoofLeg(mat, -0.16, 0.95, 0.1, 0.78, 0.09, false);
  const legR = hoofLeg(mat, 0.16, 0.95, -0.05, 0.78, 0.09, false);
  group.add(legL, legR);
  shadeCast(group);
  return { group, legs: [legL, legR], wings: [] as THREE.Object3D[], head: bite.head, jaw: bite.jaw };
}

function makeLongneck(mat: THREE.Material) {
  const group = new THREE.Group();
  group.add(
    spineMesh(
      [
        { x: 0, y: 1.3, z: -2.4, rx: 0.08, ry: 0.06 },
        { x: 0, y: 1.55, z: -1.2, rx: 0.28, ry: 0.32 },
        { x: 0, y: 1.7, z: 0.2, rx: 0.42, ry: 0.48 },
        { x: 0, y: 2.15, z: 0.85, rx: 0.16, ry: 0.16 },
        { x: 0, y: 2.7, z: 1.15, rx: 0.1, ry: 0.1 },
        { x: 0, y: 3.15, z: 1.35, rx: 0.08, ry: 0.08 },
      ],
      10,
      mat,
    ),
  );
  const bite = beastHead(mat, 3.45, 1.5, 0.16, 0.1, 0, 0.02, 0.03, 0.9);
  group.add(bite.head);
  const hips: [number, number, number][] = [
    [-0.28, 1.35, 0.35],
    [0.28, 1.35, 0.35],
    [-0.26, 1.35, -0.55],
    [0.26, 1.35, -0.55],
  ];
  const legs = hips.map(([x, y, z]) => hoofLeg(mat, x, y, z, 1.15, 0.1, true));
  for (const leg of legs) group.add(leg);
  shadeCast(group);
  return { group, legs, wings: [] as THREE.Object3D[], head: bite.head, jaw: bite.jaw };
}

function makeClub(mat: THREE.Material) {
  const group = new THREE.Group();
  group.add(
    spineMesh(
      [
        { x: 0, y: 0.55, z: -1.15, rx: 0.08, ry: 0.06 },
        { x: 0, y: 0.62, z: -0.3, rx: 0.38, ry: 0.28 },
        { x: 0, y: 0.64, z: 0.45, rx: 0.4, ry: 0.26 },
        { x: 0, y: 0.58, z: 0.95, rx: 0.16, ry: 0.12 },
      ],
      8,
      mat,
    ),
  );
  const club = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat);
  club.scale.set(1.35, 0.85, 1.15);
  club.position.set(0, 0.42, -1.42);
  const clubKnob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), mat);
  clubKnob.position.set(0.12, 0.08, -0.06);
  club.add(clubKnob);
  group.add(club);
  const armor = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.78 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mat);
  shell.scale.set(0.95, 0.16, 1.7);
  shell.position.set(0, 0.8, 0.05);
  group.add(shell);
  for (let row = 0; row < 5; row += 1) {
    for (let col = -1; col <= 1; col += 1) {
      const scute = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), armor);
      scute.scale.set(1.05, 0.32, 0.7);
      scute.position.set(col * 0.12, 0.84, -0.42 + row * 0.22);
      group.add(scute);
    }
  }
  for (let i = 0; i < 5; i += 1) {
    for (const side of [-1, 1] as const) {
      const flank = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), armor);
      flank.scale.set(0.35, 0.7, 0.85);
      flank.position.set(side * 0.4, 0.58, -0.4 + i * 0.22);
      flank.rotation.z = side * 0.35;
      group.add(flank);
    }
  }
  for (const side of [-1, 1] as const) {
    const shoulder = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 5), armor);
    shoulder.position.set(side * 0.4, 0.95, 0.35);
    shoulder.rotation.z = side * 0.4;
    group.add(shoulder);
  }
  for (let i = 0; i < 3; i += 1) {
    const band = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), mat);
    band.scale.set(1.5, 0.55, 0.45);
    band.position.set(0, 0.5, -0.82 - i * 0.2);
    group.add(band);
  }
  const bite = beastHead(mat, 0.72, 1.05, 0.16, 0.1, 0, 0.02, 0.03, 1.1);
  group.add(bite.head);
  const hips: [number, number, number][] = [
    [-0.28, 0.48, 0.35],
    [0.28, 0.48, 0.35],
    [-0.26, 0.48, -0.25],
    [0.26, 0.48, -0.25],
  ];
  const legs = hips.map(([x, y, z]) => hoofLeg(mat, x, y, z, 0.38, 0.07, true));
  for (const leg of legs) group.add(leg);
  shadeCast(group);
  return { group, legs, wings: [] as THREE.Object3D[], head: bite.head, jaw: bite.jaw };
}

const ivory = new THREE.MeshStandardMaterial({ color: 0xf6f1e6, roughness: 0.4 });
const gum = new THREE.MeshStandardMaterial({ color: 0x3a1614, roughness: 0.58 });
const cream = new THREE.MeshStandardMaterial({ color: 0xf3e4c4, roughness: 0.72 });
const hornMat = new THREE.MeshStandardMaterial({ color: 0xead9b2, roughness: 0.34, metalness: 0.08 });
const scleraMat = new THREE.MeshStandardMaterial({ color: 0xe6d3a8, roughness: 0.22, metalness: 0.04 });
const pupilMat = new THREE.MeshStandardMaterial({ color: 0x120e0c, roughness: 0.2 });
const socketMat = new THREE.MeshStandardMaterial({ color: 0x1c140f, roughness: 0.7 });
const glintMat = new THREE.MeshBasicMaterial({ color: 0xfff8ea });

function part(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  parent.add(mesh);
  return mesh;
}

function clawArm(
  parent: THREE.Group,
  mat: THREE.Material,
  side: 1 | -1,
  x: number,
  y: number,
  z: number,
  upperLen: number,
  foreLen: number,
  thick: number,
  fingers: number,
  clawLen: number,
  pose: "tuck" | "reach" | "hang",
  feather?: THREE.Material,
) {
  const shoulder = new THREE.Group();
  shoulder.position.set(x * side, y, z);
  const socket = new THREE.Mesh(new THREE.SphereGeometry(thick * 1.65, 8, 6), mat);
  shoulder.add(socket);
  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(thick, Math.max(0.04, upperLen), 3, 6), mat);
  upper.position.y = -upperLen * 0.5;
  const elbow = new THREE.Group();
  elbow.position.y = -upperLen;
  const fore = new THREE.Mesh(new THREE.CapsuleGeometry(thick * 0.82, Math.max(0.04, foreLen), 3, 6), mat);
  fore.position.y = -foreLen * 0.5;
  const wrist = new THREE.Group();
  wrist.position.y = -foreLen;
  wrist.add(new THREE.Mesh(new THREE.SphereGeometry(thick * 0.95, 6, 5), mat));
  for (let i = 0; i < fingers; i += 1) {
    const spread = (i - (fingers - 1) / 2) * thick * 1.2;
    const claw = new THREE.Mesh(new THREE.ConeGeometry(Math.max(0.008, thick * 0.32), clawLen, 5), ivory);
    claw.position.set(spread, -clawLen * 0.15, thick * 0.7);
    claw.rotation.x = Math.PI / 2 + 0.65;
    wrist.add(claw);
  }
  if (feather) {
    for (let i = 0; i < 4; i += 1) {
      fore.add(quill(feather, side * thick * 0.2, -foreLen * (0.25 + i * 0.22), 0, foreLen * 0.42, -0.35, 0, side * 0.2));
    }
  }
  elbow.add(fore, wrist);
  shoulder.add(upper, elbow);
  if (pose === "tuck") {
    shoulder.rotation.set(-0.3, 0, side * 0.12);
    elbow.rotation.set(0.4, 0, 0);
  } else if (pose === "reach") {
    shoulder.rotation.set(-0.55, side * 0.12, side * 0.22);
    elbow.rotation.set(0.85, 0, 0);
  } else {
    shoulder.rotation.set(-0.4, 0, side * 0.18);
    elbow.rotation.set(0.5, 0, 0);
  }
  parent.add(shoulder);
}

function hoofLeg(mat: THREE.Material, x: number, y: number, z: number, len: number, r: number, hoof: boolean, sickle = false, clawScale = 1) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const haunch = new THREE.Mesh(new THREE.SphereGeometry(r * 2.15, 8, 6), mat);
  haunch.scale.set(1.05, 1.25, 0.8);
  haunch.position.y = -len * 0.08;
  const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(r * 1.85, len * 0.36, 4, 8), mat);
  thigh.position.y = -len * 0.2;
  const knee = new THREE.Group();
  knee.name = "knee";
  knee.position.y = -len * 0.42;
  knee.rotation.x = 0.35;
  const shin = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.95, len * 0.32, 3, 7), mat);
  shin.position.y = -len * 0.2;
  const foot = new THREE.Mesh(new THREE.SphereGeometry(r * 1.35, 8, 6), hoof ? hornMat : mat);
  foot.name = "sole";
  foot.scale.set(0.85, 0.38, hoof ? 1.35 : 1.7);
  foot.position.set(0, -len * 0.42, 0.04);
  const calf = new THREE.Mesh(new THREE.SphereGeometry(r * 1.35, 7, 6), mat);
  calf.position.y = -len * 0.02;
  knee.add(shin, calf, foot);
  if (!hoof) {
    for (const ox of [-0.65, 0.1, 0.7]) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55 * clawScale, r * 2.2 * clawScale, 5), ivory);
      claw.rotation.x = Math.PI / 2;
      claw.position.set(ox * r * 1.05, foot.position.y - r * 0.08, foot.position.z + r * (0.85 + 0.45 * clawScale));
      knee.add(claw);
    }
  }
  if (sickle) {
    const toe = new THREE.Mesh(new THREE.ConeGeometry(r * 0.35, r * 2.4, 5), ivory);
    toe.rotation.x = -1.15;
    toe.position.set(x > 0 ? -r * 0.4 : r * 0.4, foot.position.y + r * 0.2, 0.02);
    knee.add(toe);
  }
  pivot.add(haunch, thigh, knee);
  return pivot;
}

type Station = { x: number; y: number; z: number; rx: number; ry: number };

function spineMesh(stations: Station[], sides: number, mat: THREE.Material) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const rings: THREE.Vector3[][] = [];
  for (let i = 0; i < stations.length; i += 1) {
    const s = stations[i];
    const prev = stations[Math.max(0, i - 1)];
    const next = stations[Math.min(stations.length - 1, i + 1)];
    let fx = next.x - prev.x;
    let fy = next.y - prev.y;
    let fz = next.z - prev.z;
    const fl = Math.hypot(fx, fy, fz) || 1;
    fx /= fl;
    fy /= fl;
    fz /= fl;
    let rx = -fz;
    let ry = 0;
    let rz = fx;
    let rl = Math.hypot(rx, ry, rz);
    if (rl < 0.2) {
      rx = 1;
      ry = 0;
      rz = 0;
      rl = 1;
    }
    rx /= rl;
    ry /= rl;
    rz /= rl;
    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;
    const ring: THREE.Vector3[] = [];
    for (let k = 0; k < sides; k += 1) {
      const a = (k / sides) * Math.PI * 2;
      const cx = Math.cos(a) * s.rx;
      const cy = Math.sin(a) * s.ry;
      ring.push(new THREE.Vector3(s.x + rx * cx + ux * cy, s.y + ry * cx + uy * cy, s.z + rz * cx + uz * cy));
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length; i += 1) {
    for (let k = 0; k < sides; k += 1) {
      const v = rings[i][k];
      positions.push(v.x, v.y, v.z);
      uvs.push(k / sides, i / Math.max(1, rings.length - 1));
    }
  }
  for (let i = 0; i < rings.length - 1; i += 1) {
    for (let k = 0; k < sides; k += 1) {
      const k2 = (k + 1) % sides;
      const a = i * sides + k;
      const b = i * sides + k2;
      const c = (i + 1) * sides + k;
      const d = (i + 1) * sides + k2;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

function beastHead(
  mat: THREE.Material,
  y: number,
  z: number,
  skull: number,
  snout: number,
  teeth: number,
  tooth: number,
  eye: number,
  wide = 1,
  eyes = true,
) {
  const head = new THREE.Group();
  head.position.set(0, y, z);
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(skull, 16, 12), mat);
  cranium.scale.set(0.72 * wide, 0.58, 1.35);
  cranium.position.z = -skull * 0.08;
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(skull * 0.46 * Math.min(wide, 1.05), skull * 0.9, 3, 6), mat);
  neck.rotation.x = Math.PI / 2;
  neck.position.set(0, -skull * 0.18, -skull * 0.72);
  const snoutLen = Math.max(snout * 1.8, skull * 0.85);
  const muzzle = new THREE.Mesh(new THREE.CapsuleGeometry(Math.max(0.02, snout * 0.42), snoutLen, 4, 8), mat);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.scale.set(Math.min(wide, 1.05), 0.48, 1);
  muzzle.position.set(0, -skull * 0.14, skull * 0.35 + snoutLen * 0.22);
  head.add(neck, cranium, muzzle);
  const n = Math.max(0, teeth);
  if (n > 1) {
    for (let i = 0; i < n; i += 1) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(tooth * 0.38, tooth, 5), ivory);
      const u = i / (n - 1) - 0.5;
      fang.position.set(u * snout * 1.35 * wide, -snout * 0.42, skull * 0.95 + (i % 2) * tooth * 0.2);
      fang.rotation.x = Math.PI;
      head.add(fang);
    }
  }
  const jaw = new THREE.Group();
  jaw.position.set(0, -skull * 0.28, skull * 0.35);
  const bone = new THREE.Mesh(jawWedge(snout * 1.7 * wide, skull * 1.15, snout * 0.42), mat);
  jaw.add(bone);
  if (n > 1) {
    for (let i = 0; i < n; i += 1) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(tooth * 0.34, tooth * 0.95, 5), ivory);
      const u = i / (n - 1) - 0.5;
      fang.position.set(u * snout * 1.2 * wide, snout * 0.08, skull * 0.55 + (i % 2) * tooth * 0.12);
      jaw.add(fang);
    }
  }
  head.add(jaw);
  if (eyes) {
    const xRadius = skull * 0.72 * Math.max(wide, 0.7);
    const eyeR = Math.min(skull * 0.2, Math.max(eye, skull * 0.13));
    const eyeX = Math.max(eyeR * 0.8, xRadius - eyeR * 0.35);
    addEye(head, -eyeX, skull * 0.1, skull * 0.42, eyeR, scleraMat, pupilMat, glintMat);
    addEye(head, eyeX, skull * 0.1, skull * 0.42, eyeR, scleraMat, pupilMat, glintMat);
  }
  return { head, jaw };
}

function flesh(geo: THREE.BufferGeometry, pinch: number) {
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;
    const lump = Math.sin(nx * 3.2 + 0.7) * Math.cos(ny * 4.1) * Math.sin(nz * 2.6 + ny);
    const s = 1 + lump * pinch;
    const front = Math.max(0, nz);
    pos.setXYZ(i, x * s * (1 - front * 0.12), y * s * (1 - front * 0.22), z * s * (1 + front * 0.28));
  }
  geo.computeVertexNormals();
  return geo;
}

function jawWedge(width: number, depth: number, thick: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.5, 0);
  shape.bezierCurveTo(-width * 0.42, depth * 0.45, -width * 0.16, depth * 0.82, 0, depth);
  shape.bezierCurveTo(width * 0.16, depth * 0.82, width * 0.42, depth * 0.45, width * 0.5, 0);
  shape.lineTo(-width * 0.5, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: thick * 0.35,
    bevelSize: width * 0.06,
    bevelSegments: 2,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -thick * 0.35, 0);
  return geo;
}

function makeGrazer(mat: THREE.Material) {
  const group = new THREE.Group();
  group.add(
    spineMesh(
      [
        { x: 0, y: 1.12, z: -1.7, rx: 0.05, ry: 0.04 },
        { x: 0, y: 1.28, z: -1.05, rx: 0.16, ry: 0.16 },
        { x: 0, y: 1.32, z: -0.2, rx: 0.36, ry: 0.42 },
        { x: 0, y: 1.28, z: 0.45, rx: 0.38, ry: 0.48 },
        { x: 0, y: 1.5, z: 0.82, rx: 0.2, ry: 0.22 },
        { x: 0, y: 1.78, z: 1.02, rx: 0.16, ry: 0.18 },
      ],
      12,
      mat,
    ),
  );
  const bite = beastHead(mat, 1.98, 1.08, 0.22, 0.14, 0, 0.02, 0.04, 1.15);
  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0xd7c39a, roughness: 0.55 }));
  bill.scale.set(1.6, 0.35, 1);
  bill.rotation.x = Math.PI / 2;
  bill.position.set(0, -0.06, 0.48);
  const crest = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.55, 4, 6), mat);
  crest.position.set(0, 0.28, -0.05);
  crest.rotation.x = 0.9;
  bite.head.add(bill, crest);
  group.add(bite.head);
  for (const side of [-1, 1] as const) {
    clawArm(group, mat, side, 0.42, 1.22, 0.62, 0.26, 0.2, 0.045, 3, 0.07, "hang");
  }
  const legL = hoofLeg(mat, -0.24, 1.08, 0.12, 0.9, 0.11, true);
  const legR = hoofLeg(mat, 0.24, 1.08, -0.1, 0.9, 0.11, true);
  group.add(legL, legR);
  shadeCast(group);
  return { group, legs: [legL, legR], wings: [] as THREE.Object3D[], head: bite.head, jaw: bite.jaw };
}

function makeFrill(mat: THREE.Material) {
  const group = new THREE.Group();
  group.add(
    spineMesh(
      [
        { x: 0, y: 0.72, z: -2.35, rx: 0.04, ry: 0.035 },
        { x: 0, y: 0.78, z: -1.35, rx: 0.12, ry: 0.1 },
        { x: 0, y: 0.92, z: -0.35, rx: 0.38, ry: 0.32 },
        { x: 0, y: 1.02, z: 0.35, rx: 0.48, ry: 0.4 },
        { x: 0, y: 0.98, z: 0.85, rx: 0.34, ry: 0.3 },
      ],
      10,
      mat,
    ),
  );
  const bite = beastHead(mat, 1.15, 1.15, 0.28, 0.2, 0, 0.02, 0.05, 0.9, false);
  for (const side of [-1, 1] as const) {
    addEye(bite.head, side * 0.2, 0.05, 0.2, 0.046, scleraMat, pupilMat, glintMat);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.07), mat);
    brow.position.set(side * 0.2, 0.1, 0.2);
    bite.head.add(brow);
  }
  const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat);
  cheek.scale.set(1.4, 0.7, 0.8);
  cheek.position.set(0, -0.02, 0.16);
  bite.head.add(cheek);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 6), hornMat);
  beak.scale.set(1.15, 0.62, 1);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.02, 0.52);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.22), new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.8 }));
  mouth.position.set(0, -0.07, 0.42);
  bite.head.add(beak, mouth);
  for (const side of [-1, 1] as const) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.075, 1.05, 7), hornMat);
    horn.position.set(side * 0.2, 0.16, 0.08);
    horn.rotation.x = 1.05;
    horn.rotation.z = -side * 0.28;
    bite.head.add(horn);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.32, 6), hornMat);
  nose.position.set(0, 0.08, 0.38);
  nose.rotation.x = 0.7;
  bite.head.add(nose);
  const shield = new THREE.Group();
  shield.position.set(0, 0.04, -0.22);
  shield.rotation.x = -0.42;
  const frillR = 0.62;
  const frillShape = new THREE.Shape();
  frillShape.absarc(0, 0, frillR, 0, Math.PI, false);
  frillShape.closePath();
  const plate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(frillShape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.02,
      bevelSegments: 1,
    }),
    mat,
  );
  plate.position.z = -0.05;
  shield.add(plate);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 7) * Math.PI;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.1, 4), hornMat);
    spike.position.set(Math.cos(a) * frillR, Math.sin(a) * frillR, 0);
    spike.rotation.z = a - Math.PI / 2;
    shield.add(spike);
  }
  bite.head.add(shield);
  group.add(bite.head);
  const hips: [number, number, number, number][] = [
    [-0.32, 0.78, 0.55, 0.62],
    [0.32, 0.78, 0.55, 0.62],
    [-0.3, 0.85, -0.35, 0.72],
    [0.3, 0.85, -0.35, 0.72],
  ];
  const legs = hips.map(([x, y, z, len]) => hoofLeg(mat, x, y, z, len, 0.13, true));
  for (const leg of legs) group.add(leg);
  shadeCast(group);
  return { group, legs, wings: [] as THREE.Object3D[], head: bite.head, jaw: bite.jaw };
}

function makeFlyer(mat: THREE.Material) {
  const group = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: hideMap("flyer"),
    roughness: 0.62,
    side: THREE.DoubleSide,
  });
  group.add(
    spineMesh(
      [
        { x: 0, y: 0.62, z: -0.55, rx: 0.02, ry: 0.02 },
        { x: 0, y: 0.7, z: -0.1, rx: 0.1, ry: 0.09 },
        { x: 0, y: 0.78, z: 0.25, rx: 0.1, ry: 0.09 },
        { x: 0, y: 0.9, z: 0.48, rx: 0.08, ry: 0.07 },
      ],
      8,
      mat,
    ),
  );
  const bite = beastHead(mat, 0.92, 0.72, 0.1, 0.05, 0, 0.02, 0.024, 0.55);
  const crest = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.55, 4, 6), mat);
  crest.position.set(0, 0.16, -0.22);
  crest.rotation.x = -1.15;
  bite.head.add(crest);
  group.add(bite.head);
  const wings: THREE.Object3D[] = [];
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.05, -0.02);
  wingShape.quadraticCurveTo(0.55, -0.16, 1.15, -0.02);
  wingShape.quadraticCurveTo(1.48, 0.08, 1.42, 0.16);
  wingShape.quadraticCurveTo(1.05, 0.42, 0.55, 0.5);
  wingShape.quadraticCurveTo(0.22, 0.36, 0.02, 0.16);
  wingShape.closePath();
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  for (const side of [-1, 1] as const) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.12, 0.84, 0.1);
    const spar = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 1.25, 3, 5), mat);
    spar.rotation.z = side * Math.PI / 2;
    spar.position.set(side * 0.62, 0.03, 0.02);
    const membrane = new THREE.Mesh(wingGeo, leather);
    membrane.rotation.x = -Math.PI / 2;
    membrane.scale.x = side;
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.7, 2, 4), mat);
    finger.position.set(side * 0.42, -0.02, -0.18);
    finger.rotation.z = side * 1.15;
    finger.rotation.x = 0.5;
    const hand = new THREE.Group();
    hand.position.set(side * 1.28, 0.04, 0.02);
    for (let i = 0; i < 3; i += 1) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.07, 4), ivory);
      claw.rotation.x = Math.PI / 2 + 0.4;
      claw.position.set(0, (i - 1) * 0.02, 0.02);
      hand.add(claw);
    }
    wing.add(spar, membrane, finger, hand);
    group.add(wing);
    wings.push(wing);
  }
  const legL = hoofLeg(mat, -0.06, 0.48, 0.05, 0.22, 0.028, false);
  const legR = hoofLeg(mat, 0.06, 0.48, -0.02, 0.22, 0.028, false);
  group.add(legL, legR);
  shadeCast(group);
  return { group, legs: [legL, legR], wings, head: bite.head, jaw: bite.jaw };
}

function makeMovieRaptor(mat: THREE.Material) {
  const group = new THREE.Group();
  group.add(
    spineMesh(
      [
        { x: 0, y: 0.7, z: -2.6, rx: 0.012, ry: 0.01 },
        { x: 0, y: 0.76, z: -1.75, rx: 0.04, ry: 0.035 },
        { x: 0, y: 0.84, z: -0.9, rx: 0.08, ry: 0.09 },
        { x: 0, y: 0.96, z: -0.15, rx: 0.15, ry: 0.18 },
        { x: 0, y: 1.04, z: 0.32, rx: 0.12, ry: 0.15 },
        { x: 0, y: 1.2, z: 0.55, rx: 0.07, ry: 0.08 },
        { x: 0, y: 1.34, z: 0.72, rx: 0.055, ry: 0.06 },
        { x: 0, y: 1.44, z: 0.86, rx: 0.045, ry: 0.05 },
      ],
      10,
      mat,
    ),
  );
  const bite = beastHead(mat, 1.46, 0.92, 0.14, 0.2, 8, 0.034, 0.026, 0.72);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.08), mat);
  brow.position.set(0, 0.06, 0.04);
  bite.head.add(brow);
  group.add(bite.head);
  for (const side of [-1, 1] as const) {
    clawArm(group, mat, side, 0.13, 1.02, 0.34, 0.2, 0.18, 0.03, 3, 0.09, "reach");
  }
  const legL = hoofLeg(mat, -0.11, 0.96, 0.02, 0.76, 0.08, false, true, 1);
  const legR = hoofLeg(mat, 0.11, 0.96, -0.1, 0.76, 0.08, false, true, 1);
  group.add(legL, legR);
  shadeCast(group);
  return { group, legs: [legL, legR], wings: [] as THREE.Object3D[], head: bite.head, jaw: bite.jaw };
}

function makeHunter(mat: THREE.Material, kind: "rex" | "raptor" | "compy") {
  const group = new THREE.Group();
  const rex = kind === "rex";
  const compy = kind === "compy";
  const feather = new THREE.MeshStandardMaterial({ color: 0xffffff, map: featherMap(), roughness: 0.76 });
  const spine = rex
    ? [
        { x: 0, y: 1.55, z: -3.5, rx: 0.06, ry: 0.05 },
        { x: 0, y: 1.62, z: -2.2, rx: 0.16, ry: 0.14 },
        { x: 0, y: 1.72, z: -0.7, rx: 0.42, ry: 0.46 },
        { x: 0, y: 1.68, z: 0.35, rx: 0.48, ry: 0.5 },
        { x: 0, y: 1.78, z: 0.95, rx: 0.32, ry: 0.34 },
        { x: 0, y: 1.95, z: 1.35, rx: 0.22, ry: 0.22 },
      ]
    : compy
      ? [
          { x: 0, y: 0.48, z: -0.7, rx: 0.015, ry: 0.015 },
          { x: 0, y: 0.58, z: -0.3, rx: 0.07, ry: 0.08 },
          { x: 0, y: 0.62, z: 0.05, rx: 0.12, ry: 0.12 },
          { x: 0, y: 0.74, z: 0.22, rx: 0.07, ry: 0.07 },
        ]
      : [
          { x: 0, y: 0.72, z: -2.35, rx: 0.02, ry: 0.018 },
          { x: 0, y: 0.82, z: -1.35, rx: 0.07, ry: 0.06 },
          { x: 0, y: 0.95, z: -0.35, rx: 0.2, ry: 0.24 },
          { x: 0, y: 1.02, z: 0.35, rx: 0.16, ry: 0.18 },
          { x: 0, y: 1.18, z: 0.72, rx: 0.1, ry: 0.09 },
        ];
  group.add(spineMesh(spine, rex ? 12 : 8, mat));
  if (kind === "raptor") {
    for (let i = 0; i < 10; i += 1) {
      const z = -2.15 + i * 0.3;
      const y = 0.82 + Math.sin((i / 9) * Math.PI) * 0.28;
      group.add(quill(feather, 0, y + 0.16, z, 0.26, -0.55, 0, 0));
      group.add(quill(feather, 0.07, y + 0.08, z, 0.18, -0.4, 0.3, 0.45));
      group.add(quill(feather, -0.07, y + 0.08, z, 0.18, -0.4, -0.3, -0.45));
    }
  }
  const bite = rex
    ? beastHead(mat, 2.05, 1.5, 0.36, 0.24, 8, 0.07, 0.045, 0.92)
    : compy
      ? beastHead(mat, 0.8, 0.32, 0.09, 0.055, 5, 0.03, 0.022, 0.85)
      : beastHead(mat, 1.22, 0.95, 0.13, 0.16, 9, 0.05, 0.04, 0.7);
  if (rex) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.18), mat);
    brow.position.set(0, 0.16, 0.2);
    bite.head.add(brow);
  }
  group.add(bite.head);
  if (!rex) {
    for (const side of [-1, 1] as const) {
      if (compy) clawArm(group, mat, side, 0.14, 0.74, 0.22, 0.1, 0.09, 0.018, 3, 0.055, "reach", feather);
      else clawArm(group, mat, side, 0.28, 1.15, 0.55, 0.32, 0.28, 0.045, 3, 0.14, "reach", feather);
    }
  } else {
    for (const side of [-1, 1] as const) {
      clawArm(group, mat, side, 0.36, 1.42, 0.62, 0.26, 0.2, 0.05, 2, 0.11, "tuck");
    }
  }
  const hipY = rex ? 1.62 : compy ? 0.55 : 0.95;
  const legLen = rex ? 1.45 : compy ? 0.36 : 0.72;
  const legR = rex ? 0.2 : compy ? 0.045 : 0.08;
  const legL = hoofLeg(mat, rex ? -0.22 : -0.1, hipY, rex ? 0.05 : 0.08, legLen, legR, false, kind === "raptor", rex ? 0.4 : 1);
  const legRt = hoofLeg(mat, rex ? 0.22 : 0.1, hipY, rex ? -0.2 : -0.05, legLen, legR, false, kind === "raptor", rex ? 0.4 : 1);
  group.add(legL, legRt);
  shadeCast(group);
  return { group, legs: [legL, legRt], wings: [] as THREE.Object3D[], head: bite.head, jaw: bite.jaw };
}

function addEye(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  s: number,
  sclera: THREE.Material,
  pupil: THREE.Material,
  glint: THREE.Material,
) {
  const side = Math.sign(x) || 1;
  const eye = new THREE.Group();
  eye.position.set(x, y, z);
  eye.rotation.y = side * 0.4;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(s, 14, 12), sclera);
  ball.scale.set(1, 0.9, 0.82);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(s * 0.62, 12, 10), irisMat());
  iris.scale.set(1, 1, 0.28);
  iris.position.z = s * 0.7;
  const pupilMesh = new THREE.Mesh(new THREE.SphereGeometry(s * 0.26, 8, 6), pupil);
  pupilMesh.scale.set(0.62, 1.05, 0.35);
  pupilMesh.position.z = s * 0.82;
  const spark = new THREE.Mesh(new THREE.SphereGeometry(s * 0.09, 5, 4), glint);
  spark.position.set(s * 0.16, s * 0.18, s * 0.9);
  const upper = new THREE.Mesh(new THREE.SphereGeometry(s * 1.2, 10, 8), socketMat);
  upper.scale.set(1.2, 0.38, 0.72);
  upper.position.set(0, s * 0.48, s * 0.12);
  const lower = new THREE.Mesh(new THREE.SphereGeometry(s * 1.15, 10, 8), socketMat);
  lower.scale.set(1.15, 0.32, 0.65);
  lower.position.set(0, -s * 0.42, s * 0.08);
  eye.add(ball, iris, pupilMesh, spark, upper, lower);
  group.add(eye);
}

let sharedIris: THREE.Material | null = null;

function irisMat() {
  if (sharedIris) return sharedIris;
  sharedIris = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texCanvas(64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, "#1a0e06");
      g.addColorStop(0.16, "#7a4010");
      g.addColorStop(0.42, "#e2a23a");
      g.addColorStop(0.72, "#a85a16");
      g.addColorStop(1, "#241208");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = "rgba(70, 28, 8, 0.55)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 28; i += 1) {
        const a = (i / 28) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(32 + Math.cos(a) * 6, 32 + Math.sin(a) * 6);
        ctx.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30);
        ctx.stroke();
      }
    }),
    roughness: 0.28,
    metalness: 0.06,
  });
  return sharedIris;
}

function quill(mat: THREE.Material, x: number, y: number, z: number, len: number, rx: number, ry: number, rz: number) {
  const geo = new THREE.ConeGeometry(0.018, len, 4);
  geo.translate(0, len * 0.45, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  return mesh;
}

const hideCache = new Map<string, THREE.Texture>();

function hideMap(style: string) {
  const cached = hideCache.get(style);
  if (cached) return cached;
  const tex = texCanvas(128, (ctx) => paintHide(ctx, style), 2);
  hideCache.set(style, tex);
  return tex;
}

function paintHide(ctx: CanvasRenderingContext2D, style: string) {
  const pal: Record<string, [string, string, string]> = {
    rex: ["#3a332c", "#1a1612", "#6b5848"],
    raptor: ["#6a4328", "#24160e", "#c4a06a"],
    compy: ["#e08840", "#8a4018", "#f0b06a"],
    flyer: ["#6a5e52", "#3a322c", "#a89884"],
    grazer: ["#7a8a48", "#4a5a28", "#c4b48a"],
    frill: ["#8d7b66", "#4a4036", "#c8b69a"],
    sail: ["#8a7048", "#3a2a18", "#d2b48a"],
    longneck: ["#6a6248", "#3e3828", "#c8b898"],
    club: ["#5a4632", "#2a1c14", "#a08058"],
  };
  const [base, dark, light] = pal[style] ?? pal.rex;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 14; row += 1) {
    const off = (row % 2) * 6;
    for (let col = 0; col < 14; col += 1) {
      ctx.fillStyle = (col + row) % 3 === 0 ? dark : light;
      ctx.beginPath();
      ctx.ellipse(col * 10 + off, row * 10, 5, 3.4, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (style === "grazer") {
    ctx.fillStyle = "#f3e6c0";
    for (let i = 0; i < 6; i += 1) ctx.fillRect(8 + i * 20, 0, 6, 128);
  }
  if (style === "frill") {
    ctx.fillStyle = "#6e6254";
    for (let i = 0; i < 7; i += 1) ctx.fillRect(4 + i * 18, 0, 3, 128);
  }
  ctx.fillStyle = "rgba(243, 228, 196, 0.4)";
  ctx.fillRect(82, 0, 24, 128);
  if (style === "raptor") {
    ctx.fillStyle = "#efe0c4";
    ctx.fillRect(0, 82, 128, 46);
    ctx.fillStyle = "#2c1810";
    for (let i = 0; i < 7; i += 1) {
      ctx.beginPath();
      ctx.ellipse(16 + i * 16, 36, 9, 26, 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (style === "rex") {
    ctx.fillStyle = "#c4a882";
    ctx.fillRect(96, 0, 32, 128);
  }
}

let sharedFeather: THREE.Texture | null = null;

function featherMap() {
  if (sharedFeather) return sharedFeather;
  sharedFeather = texCanvas(128, (ctx) => {
    ctx.fillStyle = "#8a5a34";
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 14; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? "#e0a060" : "#5a341c";
      ctx.beginPath();
      ctx.moveTo(i * 9, 128);
      ctx.quadraticCurveTo(i * 9 + 8, 36, i * 9 + 3, 0);
      ctx.lineTo(i * 9 + 12, 0);
      ctx.quadraticCurveTo(i * 9 + 16, 42, i * 9 + 14, 128);
      ctx.fill();
      ctx.strokeStyle = "#2a160e";
      ctx.beginPath();
      ctx.moveTo(i * 9 + 7, 128);
      ctx.lineTo(i * 9 + 7, 6);
      ctx.stroke();
    }
  }, 2);
  return sharedFeather;
}

function labelDino(kind: DinoKind) {
  if (kind === "compy") return "Compy";
  if (kind === "raptor") return "Velociraptor";
  if (kind === "flyer") return "Glider";
  if (kind === "grazer") return "Broadbill";
  if (kind === "frill") return "Triceratops";
  if (kind === "sail") return "Spinosaurus";
  if (kind === "longneck") return "Longneck";
  if (kind === "club") return "Ankylosaurus";
  return "Tyrant";
}

function mood() {
  return {
    hunger: 8 + Math.random() * 28,
    taste: 62 + Math.random() * 26,
    anger: 0,
    interested: false,
    lookT: 1 + Math.random() * 4,
  };
}

function calm(d: { hunger: number; anger: number; interested: boolean; lookT: number }) {
  d.hunger = 8 + Math.random() * 24;
  d.anger = 0;
  d.interested = false;
  d.lookT = 2 + Math.random() * 4;
}

function makeTool(kind: ToolKind, tier: ToolTier) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4e2e, roughness: 0.82 });
  const tipColor = tier === "diamond" ? 0x7ee8f0 : tier === "iron" ? 0xd5dbe2 : tier === "stone" ? 0xd5cfc4 : 0x4e3424;
  const tip = new THREE.MeshStandardMaterial({
    color: tipColor,
    roughness: tier === "wood" ? 0.78 : tier === "stone" ? 0.4 : 0.22,
    metalness: tier === "diamond" ? 0.55 : tier === "iron" ? 0.72 : tier === "stone" ? 0.16 : 0,
  });
  if (kind === "pick") {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.72, 6), wood);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.1), tip);
    head.position.set(0, 0.32, 0);
    const point = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 5), tip);
    point.rotation.z = Math.PI / 2;
    point.position.set(0.16, 0.32, 0);
    g.add(handle, head, point);
  } else if (kind === "sword") {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.038, 0.28, 6), wood);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.025), tip);
    blade.position.y = 0.46;
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), wood);
    pommel.position.y = -0.18;
    g.add(grip, blade, pommel);
  } else {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.7, 6), wood);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.1), tip);
    head.position.set(0.1, 0.32, 0);
    g.add(handle, head);
  }
  shadeCast(g);
  return g;
}

function shadeCast(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

function heightNormal(size: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const blank = new THREE.CanvasTexture(canvas);
  if (!ctx) return blank;
  paint(ctx);
  const src = ctx.getImageData(0, 0, size, size);
  const out = ctx.createImageData(size, size);
  const sample = (x: number, y: number) => {
    const xx = (x + size) % size;
    const yy = (y + size) % size;
    return src.data[(yy * size + xx) * 4] / 255;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = sample(x + 1, y) - sample(x - 1, y);
      const dy = sample(x, y + 1) - sample(x, y - 1);
      const nx = -dx * 3;
      const ny = -dy * 3;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      out.data[i] = (nx / len * 0.5 + 0.5) * 255;
      out.data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      out.data[i + 2] = (nz / len * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}

function texCanvas(size: number, paint: (ctx: CanvasRenderingContext2D) => void, repeat = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  paint(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.repeat.set(repeat, repeat);
  return tex;
}

function noisePaint(ctx: CanvasRenderingContext2D, base: string, specks: string[], n: number) {
  const s = ctx.canvas.width;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i += 1) {
    ctx.fillStyle = specks[i % specks.length] ?? base;
    const x = Math.random() * s;
    const y = Math.random() * s;
    const r = 1.5 + Math.random() * 6;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.45 + Math.random() * 0.7), Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
}
