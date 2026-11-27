// Walking camera: makes the camera feel like it's being carried by someone walking while
// the player types. Pure math, no React — the same model is ported line-for-line to
// flutter_game/lib/ui/widgets/walk_camera.dart.
//
//   correct key on a MOVE/ESCAPE word → "footstep energy" (bob grows, corridor creeps forward)
//   word completed (a step)           → forward lurch down the corridor
//   typo                              → stumble (sharp sideways jolt)
//   chase                             → running: faster, bigger, shakier bob
//   idle                              → energy fades to a slow breathing sway

export interface WalkState {
  t: number; // seconds since start
  energy: number; // 0..1 — how much the player is "walking" right now
  phase: number; // footstep cycle (radians)
  depth: number; // how far down the corridor the camera is (eased)
  depthTarget: number;
  stumble: number; // 0..1, decays fast
}

export const initialWalk = (): WalkState => ({ t: 0, energy: 0, phase: 0, depth: 0, depthTarget: 0, stumble: 0 });

export const walkKeystroke = (s: WalkState): WalkState => ({ ...s, energy: Math.min(1, s.energy + 0.22) });
export const walkStep = (s: WalkState): WalkState => ({ ...s, depthTarget: s.depthTarget + 0.6 });
export const walkStumble = (s: WalkState): WalkState => ({ ...s, stumble: 1, energy: s.energy * 0.5 });

/** Advance the simulation by dt seconds. */
export function walkAdvance(s: WalkState, dt: number, running: boolean): WalkState {
  const d = Math.min(dt, 0.05); // clamp after tab switches / hitches
  const energy = s.energy * Math.exp(-d * (running ? 1.2 : 2.2));
  const speed = (running ? 13 : 8) * (0.3 + 0.7 * energy);
  const creep = d * energy * (running ? 0.9 : 0.45);
  const depthTarget = s.depthTarget + creep;
  return {
    t: s.t + d,
    energy,
    phase: s.phase + d * speed * (energy > 0.02 ? 1 : 0),
    depthTarget,
    depth: s.depth + (depthTarget - s.depth) * Math.min(1, d * 3),
    stumble: s.stumble * Math.exp(-d * 6),
  };
}

export interface CameraPose {
  x: number; // px
  y: number; // px
  roll: number; // radians
}

/** Where the camera is this frame. Amplitudes are in px for a ~400px tall view; scale with [unit]. */
export function walkPose(s: WalkState, running: boolean, unit = 1): CameraPose {
  const amp = (running ? 14 : 9) * unit;
  const step = Math.abs(Math.sin(s.phase)); // one bob per footstep
  return {
    x: Math.sin(s.phase * 0.5) * amp * 0.6 * s.energy + Math.sin(s.t * 45) * 9 * unit * s.stumble,
    y: -step * amp * s.energy + Math.sin(s.t * 1.6) * 1.2 * unit + 4 * unit * s.stumble,
    roll: Math.sin(s.phase * 0.5) * 0.012 * s.energy + (running ? Math.sin(s.t * 23) * 0.004 * s.energy : 0),
  };
}

// ------------------------------------------------------------------ corridor

export type Atmosphere = 'flickering' | 'misty' | 'sterile' | 'flooded' | string;

export interface Pt { x: number; y: number }
export interface Shape {
  kind: 'poly' | 'line' | 'rect';
  points?: Pt[]; // poly / line
  rect?: { x: number; y: number; w: number; h: number };
  fill?: string; // rgba()
  stroke?: string;
  width?: number;
}

const rgba = (r: number, g: number, b: number, a: number) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Box { l: number; t: number; r: number; b: number }
const lerpBox = (a: Box, b: Box, t: number): Box => ({ l: lerp(a.l, b.l, t), t: lerp(a.t, b.t, t), r: lerp(a.r, b.r, t), b: lerp(a.b, b.b, t) });

export const CORRIDOR_RINGS = 7;

/**
 * A one-point-perspective corridor whose cross-section "rings" slide toward the viewer as
 * [depth] grows — that's what sells the walking. Each level gets its own details.
 */
export function corridorShapes(w: number, h: number, depth: number, t: number, atmosphere: Atmosphere): Shape[] {
  const vp = { x: w / 2, y: h * 0.45 };
  const far: Box = { l: vp.x - w * 0.09, t: vp.y - h * 0.1, r: vp.x + w * 0.09, b: vp.y + h * 0.1 };
  const near: Box = { l: -w * 0.1, t: -h * 0.1, r: w * 1.1, b: h * 1.1 };
  const out: Shape[] = [];

  // floor + ceiling planes
  const floorColor = atmosphere === 'flooded' ? rgba(20, 40, 60, 0.45) : rgba(0, 0, 0, 0.35);
  out.push({ kind: 'poly', points: [{ x: near.l, y: near.b }, { x: near.r, y: near.b }, { x: far.r, y: far.b }, { x: far.l, y: far.b }], fill: floorColor });
  out.push({ kind: 'poly', points: [{ x: near.l, y: near.t }, { x: near.r, y: near.t }, { x: far.r, y: far.t }, { x: far.l, y: far.t }], fill: rgba(0, 0, 0, 0.25) });
  // the dark end of the corridor
  out.push({ kind: 'rect', rect: { x: far.l, y: far.t, w: far.r - far.l, h: far.b - far.t }, fill: rgba(0, 0, 0, 0.55) });

  // edges converging on the vanishing point
  const edge = rgba(232, 228, 216, 0.07);
  for (const [a, b] of [[{ x: near.l, y: near.t }, { x: far.l, y: far.t }], [{ x: near.r, y: near.t }, { x: far.r, y: far.t }],
    [{ x: near.l, y: near.b }, { x: far.l, y: far.b }], [{ x: near.r, y: near.b }, { x: far.r, y: far.b }]] as [Pt, Pt][]) {
    out.push({ kind: 'line', points: [a, b], stroke: edge, width: 1 });
  }

  // rings: u = 0 at the far end → 1 at the camera; they move toward you as depth grows
  for (let i = 0; i < CORRIDOR_RINGS; i++) {
    const u = (((i + depth) % CORRIDOR_RINGS) + CORRIDOR_RINGS) % CORRIDOR_RINGS / CORRIDOR_RINGS;
    const s = Math.pow(u, 2.2);
    const r = lerpBox(far, near, s);
    const a = Math.sin(u * Math.PI); // fade at both ends
    const rw = r.r - r.l;
    const rh = r.b - r.t;
    out.push({ kind: 'rect', rect: { x: r.l, y: r.t, w: rw, h: rh }, stroke: rgba(232, 228, 216, 0.11 * a), width: 1 + 2 * s });

    if (atmosphere === 'flickering' && i % 2 === 0) {
      // dorm room doors on both walls
      const dw = rw * 0.07;
      const dh = rh * 0.62;
      out.push({ kind: 'rect', rect: { x: r.l + rw * 0.01, y: r.b - dh, w: dw, h: dh }, stroke: rgba(244, 184, 96, 0.16 * a), width: 1 + s });
      out.push({ kind: 'rect', rect: { x: r.r - rw * 0.01 - dw, y: r.b - dh, w: dw, h: dh }, stroke: rgba(244, 184, 96, 0.16 * a), width: 1 + s });
    } else if (atmosphere === 'sterile') {
      // buzzing ceiling lights
      const on = 0.5 + 0.5 * Math.sin(t * 9 + i * 2.3) > 0.15 ? 1 : 0.25;
      out.push({ kind: 'rect', rect: { x: vp.x - rw * 0.12, y: r.t + rh * 0.015, w: rw * 0.24, h: Math.max(1, rh * 0.018) }, fill: rgba(210, 255, 235, 0.22 * a * on) });
    } else if (atmosphere === 'flooded') {
      // ripples on the water
      const y = r.b - rh * 0.01;
      const shift = Math.sin(t * 2 + i) * rw * 0.04;
      out.push({ kind: 'line', points: [{ x: vp.x - rw * 0.3 + shift, y }, { x: vp.x - rw * 0.05 + shift, y }], stroke: rgba(150, 200, 255, 0.18 * a), width: 1 + s });
      out.push({ kind: 'line', points: [{ x: vp.x + rw * 0.08 - shift, y }, { x: vp.x + rw * 0.32 - shift, y }], stroke: rgba(150, 200, 255, 0.14 * a), width: 1 + s });
    } else if (atmosphere === 'misty' && i % 2 === 1) {
      // hanging vines / balete roots at the ring tops
      for (const fx of [0.15, 0.35, 0.7, 0.88]) {
        const x = r.l + rw * fx;
        out.push({ kind: 'line', points: [{ x, y: r.t }, { x: x + Math.sin(t + fx * 9) * rw * 0.01, y: r.t + rh * (0.12 + fx * 0.1) }], stroke: rgba(120, 150, 120, 0.2 * a), width: 1 + s });
      }
    }
  }

  // drifting fog for the mansion
  if (atmosphere === 'misty') {
    for (let k = 0; k < 3; k++) {
      const y = h * (0.55 + k * 0.12);
      const x = ((t * (12 + k * 7) + k * w * 0.4) % (w * 1.6)) - w * 0.6;
      // three stacked bands → soft-edged fog without blur filters
      for (const f of [1, 0.6, 0.3]) {
        out.push({ kind: 'rect', rect: { x: x + w * 0.45 * (1 - f), y: y + h * 0.035 * (1 - f), w: w * 0.9 * f, h: h * 0.07 * f }, fill: rgba(200, 210, 220, 0.03) });
      }
    }
  }
  return out;
}

/** Which prompts count as walking (footsteps); pickups and chants stand still. */
export const isWalkingPrompt = (kind: string | undefined) => kind === 'move' || kind === 'escape';
