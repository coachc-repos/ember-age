import { useEffect, useRef, useState, type ButtonHTMLAttributes, type PointerEvent, type ReactNode, type RefObject } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { EmberRuntime, type HudNodes, type Snapshot } from "@/game/runtime";
import { RECIPES, TOOLS, type MatKey, type ToolId } from "@/game/world";

const empty: Snapshot = {
  mode: "menu",
  dawn: 1,
  score: 0,
  kills: 0,
  meals: 0,
  drinks: 0,
  epitaph: "",
  bestDawn: 0,
  bestScore: 0,
  muted: false,
  shake: true,
  record: false,
  crafting: false,
  slots: [null, null, null, null, null, null],
  selected: 0,
  wood: 0,
  stone: 0,
  stick: 0,
  berry: 0,
  meat: 0,
  iron: 0,
  diamond: 0,
  wear: [0, 0, 0, 0, 0, 0],
  hint: "",
  banner: "",
  place: "Camp rise",
  toolName: "Fist",
};

export function EmberGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rtRef = useRef<EmberRuntime | null>(null);
  const hpRef = useRef<HTMLDivElement>(null);
  const hungerRef = useRef<HTMLDivElement>(null);
  const thirstRef = useRef<HTMLDivElement>(null);
  const staminaRef = useRef<HTMLDivElement>(null);
  const vigRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<Snapshot>(empty);
  const fit = useScreenFit();

  useEffect(() => {
    const spin = fit.cls === "force-land" ? 90 : fit.cls === "force-land-ccw" || fit.cls === "force-port" ? -90 : 0;
    rtRef.current?.setViewSpin(spin);
  }, [fit.cls]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const hud: HudNodes = {
      hp: hpRef.current,
      hunger: hungerRef.current,
      thirst: thirstRef.current,
      stamina: staminaRef.current,
      vignette: vigRef.current,
    };
    const rt = new EmberRuntime(canvas, hud, setSnap);
    rtRef.current = rt;
    return () => {
      rt.destroy();
      rtRef.current = null;
    };
  }, []);

  const hold = (name: "jump" | "attack" | "use" | "sprint") => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      rtRef.current?.unlock();
      rtRef.current?.setHold(name, true);
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      rtRef.current?.setHold(name, false);
    },
    onPointerCancel: () => rtRef.current?.setHold(name, false),
  });

  const mode = snap.mode;
  const playing = mode === "play" || mode === "pause";

  return (
    <main
      className={`game-root relative h-dvh max-h-dvh w-full overflow-hidden bg-bg text-fg ${playing ? fit.cls : ""} ${playing && fit.wide ? "is-wide" : "is-tall"}`}
    >
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-0 h-full w-full ${mode === "menu" || mode === "dead" ? "pointer-events-none" : ""}`}
        aria-label="Ember Age valley"
      />
      <div
        ref={vigRef}
        className="pointer-events-none absolute inset-0 z-10 opacity-0"
        style={{ boxShadow: "inset 0 0 140px 36px var(--color-blood)" }}
      />

      {playing && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg/80" />
      )}

      <div className={playing ? "pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-4" : "hidden"}>
        <div className="flex items-start justify-between gap-3">
          <div className="grid w-40 gap-2 sm:w-56">
            <Meter label="Life" fillRef={hpRef} tone="fill-blood" />
            <Meter label="Hunger" fillRef={hungerRef} tone="fill-ember" />
            <Meter label="Stamina" fillRef={staminaRef} tone="fill-bone" />
            <Meter label="Thirst" fillRef={thirstRef} tone="fill-pool" />
            <p className="text-xs tracking-widest text-muted uppercase">
              <span>{snap.place}</span>
            </p>
            <p className="text-xs text-muted">
              Wood {snap.wood} · Stone {snap.stone} · Iron {snap.iron} · Diamond {snap.diamond}
              <br />
              Sticks {snap.stick} · Berries {snap.berry} · Meat {snap.meat}
            </p>
          </div>
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <div className="text-right">
              <div className="font-display text-2xl leading-none">Dawn {snap.dawn}</div>
              <div className="text-sm text-muted">score {snap.score}</div>
            </div>
            <div className="flex gap-2">
              <IconButton label={snap.muted ? "Unmute" : "Mute"} onClick={() => rtRef.current?.toggleMute()}>
                {snap.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </IconButton>
              <IconButton label="Eat" onClick={() => rtRef.current?.eat()}>
                <span className="text-xs font-semibold">Eat</span>
              </IconButton>
              <IconButton label="Craft" onClick={() => rtRef.current?.toggleCraft()}>
                <span className="text-xs font-semibold">Craft</span>
              </IconButton>
              <IconButton label={mode === "pause" ? "Resume" : "Pause"} onClick={() => rtRef.current?.togglePause()}>
                {mode === "pause" ? <Play className="size-5" /> : <Pause className="size-5" />}
              </IconButton>
            </div>
          </div>
        </div>

        <div className="hotbar-wrap pointer-events-none absolute inset-x-0 flex flex-col items-center gap-2 px-3">
          {snap.banner && <p className="text-center font-display text-lg text-fg">{snap.banner}</p>}
          <p className="max-w-md text-center text-sm text-fg/90">{snap.hint}</p>
          <p className="text-xs tracking-widest text-muted uppercase">{snap.toolName}</p>
          <div className="pointer-events-auto flex gap-1">
            {snap.slots.map((id, i) => (
              <button
                key={i}
                type="button"
                className={
                  "flex h-16 w-14 flex-col items-center justify-center rounded-lg border bg-surface/85 text-fg " +
                  (i === snap.selected ? "border-ember" : "border-fg/15")
                }
                style={{ touchAction: "manipulation" }}
                onClick={() => rtRef.current?.selectSlot(i)}
              >
                <SlotGlyph id={id} wear={snap.wear[i] ?? 0} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {playing && (
        <div className="touch-ui absolute inset-x-0 bottom-0 z-30 items-end justify-between gap-2 p-3">
          <Stick
            onVec={(x, y) => {
              rtRef.current?.unlock();
              rtRef.current?.setStick(x, y);
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Touch label="Use" {...hold("use")} />
            <Touch label="Hit" {...hold("attack")} />
            <Touch label="Jump" {...hold("jump")} />
            <Touch label="Run" {...hold("sprint")} />
          </div>
        </div>
      )}

      {snap.crafting && playing && (
        <div className="absolute inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col gap-3 overflow-y-auto bg-bg/92 p-4 shadow-2xl sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-3xl">Recipe book</h2>
            <button
              type="button"
              className="rounded-full border border-fg/20 px-4 py-2 text-sm"
              onClick={() => rtRef.current?.toggleCraft()}
            >
              Close
            </button>
          </div>
          <p className="text-sm text-muted">Bindings from the river folk. The book stays on the camp table. Fists still punch, they just take more swings.</p>
          <ul className="flex flex-col gap-2">
            {RECIPES.map((recipe) => {
              const ok = canAfford(snap, recipe.cost) && snap.slots.some((s) => s === null);
              return (
                <li key={recipe.id}>
                  <button
                    type="button"
                    disabled={!ok}
                    className="flex w-full flex-col items-start gap-1 rounded-xl border border-fg/15 bg-surface px-4 py-3 text-left"
                    onClick={() => rtRef.current?.craft(recipe.id)}
                  >
                    <span className="font-semibold text-fg">{recipe.name}</span>
                    <span className="text-sm text-muted">{recipe.blurb}</span>
                    <span className="text-xs tracking-widest text-ember uppercase">{costLabel(recipe.cost)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {mode === "menu" && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center overflow-y-auto bg-bg/80 px-6 pt-10 pb-8"
          style={{ touchAction: "manipulation", pointerEvents: "auto" }}
        >
          <p className="text-xs tracking-widest text-ember uppercase">The last fire of the river folk</p>
          <h1 className="mt-2 font-display text-4xl leading-none">Ember Age</h1>
          <button
            id="enter-valley"
            type="button"
            className="mt-6 h-16 w-full max-w-xs rounded-full bg-ember text-lg font-semibold text-bg"
            style={{ touchAction: "manipulation" }}
            onClick={() => {
              rtRef.current?.unlock();
              rtRef.current?.start();
            }}
          >
            Start the hunt
          </button>
          <p className="mt-4 max-w-md text-center text-sm leading-relaxed text-muted">
            You woke by the fire with empty hands. Sticks are on the ground. Wood is in the trees. The recipe book is on the camp table.
          </p>
          <button
            type="button"
            className="mt-4 h-12 w-full max-w-xs rounded-full border border-fg/20 text-sm text-fg"
            style={{ touchAction: "manipulation" }}
            onClick={() => rtRef.current?.toggleMute()}
          >
            {snap.muted ? "Sound off" : "Sound on"}
          </button>
          <p className="mt-3 text-sm text-muted">
            Best dawn {snap.bestDawn || "—"} · best score {snap.bestScore || "—"}
          </p>
        </div>
      )}

      {mode === "pause" && !snap.crafting && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-bg/70 p-6">
          <div className="flex max-w-sm flex-col items-start gap-4">
            <h2 className="font-display text-4xl">The valley waits</h2>
            <p className="text-muted">Dawn {snap.dawn}. Nothing hunts while you breathe.</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="rounded-full bg-ember px-6 py-3 font-semibold text-bg" onClick={() => rtRef.current?.togglePause()}>
                Resume
              </button>
              <button type="button" className="rounded-full border border-fg/20 px-5 py-3 text-fg" onClick={() => rtRef.current?.toMenu()}>
                Abandon camp
              </button>
              <button type="button" className="rounded-full border border-fg/20 px-5 py-3 text-fg" onClick={() => rtRef.current?.setShake(!snap.shake)}>
                {snap.shake ? "Shake on" : "Shake off"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "dead" && (
        <div className="absolute inset-0 z-40 flex items-end bg-bg/75 sm:items-center">
          <div className="flex w-full max-w-xl flex-col gap-4 p-6 pb-12 sm:p-12">
            <p className="text-xs tracking-widest text-blood uppercase">Fallen</p>
            <h2 className="font-display text-4xl leading-tight sm:text-5xl">{snap.epitaph}</h2>
            <p className="text-muted">
              Dawn {snap.dawn} · score {snap.score} · {snap.kills} hunted · {snap.meals} meals · {snap.drinks} drinks
            </p>
            {snap.record && <p className="text-ember">A new mark on the cave wall.</p>}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full bg-ember px-6 py-3 font-semibold text-bg"
                onClick={() => {
                  askPhoneSide();
                  rtRef.current?.unlock();
                  rtRef.current?.start();
                }}
              >
                Rise again
              </button>
              <button type="button" className="rounded-full border border-fg/20 px-5 py-3 text-fg" onClick={() => rtRef.current?.toMenu()}>
                Back to camp
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function canAfford(snap: Snapshot, cost: Partial<Record<MatKey, number>>) {
  const bag: Record<MatKey, number> = {
    wood: snap.wood,
    stone: snap.stone,
    stick: snap.stick,
    berry: snap.berry,
    meat: snap.meat,
    iron: snap.iron,
    diamond: snap.diamond,
  };
  return (Object.keys(cost) as MatKey[]).every((key) => bag[key] >= (cost[key] ?? 0));
}

function costLabel(cost: Partial<Record<MatKey, number>>) {
  return (Object.keys(cost) as MatKey[])
    .map((key) => `${cost[key]} ${key}`)
    .join(" · ");
}

function SlotGlyph({ id, wear }: { id: ToolId | null; wear: number }) {
  if (!id) return <span className="text-muted">·</span>;
  const tool = TOOLS[id];
  const pct = tool.uses > 0 ? Math.max(0, Math.min(1, wear / tool.uses)) : 1;
  const tone = tool.tier === "diamond" ? "text-pool" : tool.tier === "wood" ? "text-ember" : "text-fg";
  return (
    <>
      <span className={`text-xs ${tone}`}>{tool.short}</span>
      <span className="text-[10px] tracking-widest text-muted uppercase">{tool.tier}</span>
      <span className="mt-0.5 h-1 w-10 overflow-hidden rounded-full bg-fg/20">
        <span className="block h-full bg-ember" style={{ width: `${pct * 100}%` }} />
      </span>
    </>
  );
}

function Meter({ label, fillRef, tone }: { label: string; fillRef: RefObject<HTMLDivElement | null>; tone: string }) {
  return (
    <div>
      <div className="mb-1 text-xs tracking-widest text-muted uppercase">{label}</div>
      <div className="h-2 overflow-hidden rounded-full bg-fg/15">
        <div ref={fillRef} className={`meter-fill ${tone}`} />
      </div>
    </div>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-11 min-w-11 items-center justify-center rounded-full border border-fg/20 bg-surface/80 px-3 text-fg"
      style={{ touchAction: "manipulation" }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Touch({ label, ...rest }: { label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="h-14 min-w-14 rounded-full border border-fg/20 bg-surface/90 px-3 text-sm font-semibold text-fg" style={{ touchAction: "manipulation" }} {...rest}>
      {label}
    </button>
  );
}

let askedSide = false;
function askPhoneSide() {
  try {
    if (askedSide) return;
    askedSide = true;
    const Ori = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof Ori.requestPermission === "function") {
      void Ori.requestPermission().catch(() => undefined);
    }
  } catch {
    /* the hunt still starts if motion permission is refused */
  }
}

function useScreenFit() {
  const [fit, setFit] = useState({ cls: "", wide: false });
  useEffect(() => {
    const apply = () => {
      const wide = window.innerWidth > window.innerHeight;
      setFit((prev) => (prev.wide === wide ? prev : { cls: "", wide }));
    };
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);
  return fit;
}

function Stick({ onVec }: { onVec: (x: number, y: number) => void }) {
  const knob = useRef<HTMLSpanElement>(null);
  const drag = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });

  const place = (x: number, y: number) => {
    const el = knob.current;
    if (!el) return;
    el.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  };

  const emit = (dx: number, dy: number) => {
    const len = Math.hypot(dx, dy);
    if (len < 10) {
      place(0, 0);
      onVec(0, 0);
      return;
    }
    const k = Math.min(1, len / 64);
    const x = (dx / len) * k;
    const y = (-dy / len) * k;
    place(x * 52, -y * 52);
    onVec(x, y);
  };

  const end = (e: React.PointerEvent) => {
    if (drag.current !== e.pointerId) return;
    drag.current = null;
    place(0, 0);
    onVec(0, 0);
  };

  return (
    <div
      className="relative z-40 h-36 w-36 touch-none rounded-full border border-fg/30 bg-surface/80"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        drag.current = e.pointerId;
        origin.current = { x: e.clientX, y: e.clientY };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* drag still follows pointermove on this control */
        }
      }}
      onPointerMove={(e) => {
        if (drag.current !== e.pointerId) return;
        e.preventDefault();
        emit(e.clientX - origin.current.x, e.clientY - origin.current.y);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span
        ref={knob}
        className="pointer-events-none absolute top-1/2 left-1/2 h-12 w-12 rounded-full bg-fg/85 shadow"
        style={{ transform: "translate(-50%, -50%)" }}
      />
    </div>
  );
}
