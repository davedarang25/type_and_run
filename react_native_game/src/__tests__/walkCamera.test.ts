import { describe, expect, it } from 'vitest';
import { corridorShapes, initialWalk, isWalkingPrompt, walkAdvance, walkKeystroke, walkPose, walkStep, walkStumble } from '../engine/walkCamera';

const run = (s: ReturnType<typeof initialWalk>, seconds: number, running = false) => {
  for (let t = 0; t < seconds; t += 1 / 60) s = walkAdvance(s, 1 / 60, running);
  return s;
};

describe('walking camera', () => {
  it('typing builds footstep energy that bobs the camera; idling settles it', () => {
    let s = initialWalk();
    for (let i = 0; i < 5; i++) s = walkKeystroke(s);
    expect(s.energy).toBeGreaterThan(0.9);
    let maxBob = 0;
    for (let i = 0; i < 30; i++) { s = walkAdvance(s, 1 / 60, false); maxBob = Math.max(maxBob, Math.abs(walkPose(s, false).y)); }
    expect(maxBob).toBeGreaterThan(3);
    s = run(s, 4);
    expect(s.energy).toBeLessThan(0.01);
    expect(Math.abs(walkPose(s, false).y)).toBeLessThan(1.5); // just breathing
  });

  it('each completed word moves the camera down the corridor', () => {
    let s = walkStep(walkStep(initialWalk()));
    s = run(s, 3);
    expect(s.depth).toBeCloseTo(1.2, 1);
  });

  it('running (chase) bobs harder than walking', () => {
    const typed = walkKeystroke(walkKeystroke(walkKeystroke(walkKeystroke(initialWalk()))));
    const peak = (running: boolean) => {
      let s = typed, m = 0;
      for (let i = 0; i < 40; i++) { s = walkAdvance(s, 1 / 60, running); m = Math.max(m, Math.abs(walkPose(s, running).y)); }
      return m;
    };
    expect(peak(true)).toBeGreaterThan(peak(false));
  });

  it('a typo stumbles the camera sideways, then recovers', () => {
    let s = walkStumble(initialWalk());
    let jolt = 0;
    for (let i = 0; i < 10; i++) { s = walkAdvance(s, 1 / 60, false); jolt = Math.max(jolt, Math.abs(walkPose(s, false).x)); }
    expect(jolt).toBeGreaterThan(3);
    s = run(s, 1.5);
    expect(s.stumble).toBeLessThan(0.001);
  });

  it('only movement words count as footsteps', () => {
    expect(isWalkingPrompt('move')).toBe(true);
    expect(isWalkingPrompt('escape')).toBe(true);
    expect(isWalkingPrompt('pickup')).toBe(false);
    expect(isWalkingPrompt('exorcise')).toBe(false);
  });

  it('every level draws its own corridor details', () => {
    const count = (a: string) => corridorShapes(400, 400, 0.5, 1, a).length;
    const base = count('unknown');
    for (const a of ['flickering', 'misty', 'sterile', 'flooded']) expect(count(a)).toBeGreaterThan(base);
  });
});
