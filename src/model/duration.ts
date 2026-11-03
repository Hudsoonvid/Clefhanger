import type { Duration, DurationType, TimeSignature } from './types';

/** Internal resolution. 480 is a common MIDI PPQ and divides cleanly for dots and future tuplets. */
export const TICKS_PER_QUARTER = 480;

/** Longest to shortest. */
export const DURATION_TYPES: DurationType[] = ['w', 'h', 'q', '8', '16', '32'];

const BASE_TICKS: Record<DurationType, number> = {
  w: TICKS_PER_QUARTER * 4,
  h: TICKS_PER_QUARTER * 2,
  q: TICKS_PER_QUARTER,
  '8': TICKS_PER_QUARTER / 2,
  '16': TICKS_PER_QUARTER / 4,
  '32': TICKS_PER_QUARTER / 8,
};

export const DURATION_NAMES: Record<DurationType, string> = {
  w: 'Whole',
  h: 'Half',
  q: 'Quarter',
  '8': 'Eighth',
  '16': 'Sixteenth',
  '32': 'Thirty-second',
};

export const MAX_DOTS = 2;

export function baseTicks(type: DurationType): number {
  return BASE_TICKS[type];
}

export function durationTicks(d: Duration): number {
  let ticks = BASE_TICKS[d.type];
  let add = ticks;
  for (let i = 0; i < d.dots; i++) {
    add /= 2;
    ticks += add;
  }
  return ticks;
}

export function measureTicks(ts: TimeSignature): number {
  return (ts.beats * TICKS_PER_QUARTER * 4) / ts.beatType;
}

/**
 * The beat that rests should not straddle: a dotted quarter in compound
 * meters (6/8, 9/8, 12/8), otherwise the beat type.
 */
export function beatTicks(ts: TimeSignature): number {
  const compound = ts.beatType >= 8 && ts.beats % 3 === 0 && ts.beats > 3;
  return ((compound ? 3 : 1) * TICKS_PER_QUARTER * 4) / ts.beatType;
}

/** Every representable duration (0–2 dots), longest first. */
const ALL_DURATIONS: Duration[] = DURATION_TYPES.flatMap((type) =>
  [0, 1, 2].map((dots) => ({ type, dots })),
)
  .filter((d) => Number.isInteger(durationTicks(d)))
  .sort((a, b) => durationTicks(b) - durationTicks(a));

/** The duration with exactly this many ticks, preferring fewer dots, or null. */
export function durationFromTicks(ticks: number): Duration | null {
  const matches = ALL_DURATIONS.filter((d) => durationTicks(d) === ticks);
  if (matches.length === 0) return null;
  return { ...matches.sort((a, b) => a.dots - b.dots)[0] };
}

/**
 * Split a span of `length` ticks starting at measure offset `start` into
 * notated durations. Prefers values that line up with the beat (so a
 * three-beat rest on beat 2 of 4/4 becomes quarter + half, not a dotted half),
 * and uses at most one dot. `beat` comes from beatTicks(). Any remainder
 * smaller than a 32nd is dropped.
 */
export function fillTicks(start: number, length: number, beat = TICKS_PER_QUARTER): Duration[] {
  const candidates = ALL_DURATIONS.filter((d) => d.dots <= 1);
  const out: Duration[] = [];
  let pos = start;
  let remaining = length;
  while (remaining > 0) {
    const fits = candidates.filter((d) => durationTicks(d) <= remaining);
    if (fits.length === 0) break;
    // Undotted values must start on a multiple of their own length; dotted
    // values on a beat that is also a multiple of their full length.
    const aligned = fits.find((d) =>
      d.dots ? pos % beat === 0 && pos % durationTicks(d) === 0 : pos % baseTicks(d.type) === 0,
    );
    const pick = aligned ?? fits[0];
    out.push({ ...pick });
    const t = durationTicks(pick);
    pos += t;
    remaining -= t;
  }
  return out;
}
