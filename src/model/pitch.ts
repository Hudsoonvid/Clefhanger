import type { ClefType, Pitch, Step } from './types';

export const STEPS: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const STEP_SEMITONES: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const SHARP_ORDER: Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER: Step[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

export const MIN_OCTAVE = 0;
export const MAX_OCTAVE = 8;

export function pitchToMidi(p: Pitch): number {
  return (p.octave + 1) * 12 + STEP_SEMITONES[p.step] + p.alter;
}

/** Number of diatonic steps above C0. Ignores accidentals. */
export function diatonicIndex(p: Pick<Pitch, 'step' | 'octave'>): number {
  return p.octave * 7 + STEPS.indexOf(p.step);
}

export function fromDiatonicIndex(index: number, alter = 0): Pitch {
  const octave = Math.floor(index / 7);
  const step = STEPS[((index % 7) + 7) % 7];
  return { step, octave, alter };
}

/** Alteration the key signature applies to a step (e.g. F in G major is +1). */
export function keyAlter(step: Step, fifths: number): number {
  if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(step) ? 1 : 0;
  if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).includes(step) ? -1 : 0;
  return 0;
}

export function samePitch(a: Pitch, b: Pitch): boolean {
  return a.step === b.step && a.octave === b.octave && a.alter === b.alter;
}

export function sortPitches(pitches: Pitch[]): Pitch[] {
  return [...pitches].sort(
    (a, b) => pitchToMidi(a) - pitchToMidi(b) || diatonicIndex(a) - diatonicIndex(b),
  );
}

function clampPitch(p: Pitch): Pitch {
  if (p.octave < MIN_OCTAVE) return { ...p, octave: MIN_OCTAVE };
  if (p.octave > MAX_OCTAVE) return { ...p, octave: MAX_OCTAVE };
  return p;
}

/** Move by diatonic steps, taking the accidental the key signature implies. */
export function stepDiatonic(p: Pitch, steps: number, fifths: number): Pitch {
  const next = fromDiatonicIndex(diatonicIndex(p) + steps);
  return clampPitch({ ...next, alter: keyAlter(next.step, fifths) });
}

export function transposeOctave(p: Pitch, octaves: number): Pitch {
  return clampPitch({ ...p, octave: p.octave + octaves });
}

/**
 * Spell a MIDI note number. Notes that belong to the key are spelled as the
 * key does; anything else uses sharps or flats depending on `preferFlats`.
 */
export function spellMidi(midi: number, fifths: number, preferFlats: boolean): Pitch {
  const octave = Math.floor(midi / 12) - 1;
  const pc = ((midi % 12) + 12) % 12;
  for (const step of STEPS) {
    const alter = keyAlter(step, fifths);
    const raw = STEP_SEMITONES[step] + alter;
    if ((raw + 12) % 12 === pc) {
      // Cb and B# belong to the neighbouring octave.
      const oct = raw < 0 ? octave + 1 : raw > 11 ? octave - 1 : octave;
      return { step, alter, octave: oct };
    }
  }
  for (const step of STEPS) {
    if (STEP_SEMITONES[step] === pc) return { step, alter: 0, octave };
  }
  if (preferFlats) {
    const step = STEPS.find((s) => STEP_SEMITONES[s] === pc + 1)!;
    return { step, alter: -1, octave };
  }
  const step = STEPS.find((s) => STEP_SEMITONES[s] === pc - 1)!;
  return { step, alter: 1, octave };
}

/** Move by semitones and respell: sharps going up, flats going down. */
export function transposeChromatic(p: Pitch, semitones: number, fifths: number): Pitch {
  const midi = Math.max(0, Math.min(127, pitchToMidi(p) + semitones));
  return clampPitch(spellMidi(midi, fifths, semitones < 0));
}

/** Diatonic index of the top staff line for each clef. */
const CLEF_TOP_LINE: Record<ClefType, number> = {
  treble: diatonicIndex({ step: 'F', octave: 5 }),
  bass: diatonicIndex({ step: 'A', octave: 3 }),
  alto: diatonicIndex({ step: 'G', octave: 4 }),
  tenor: diatonicIndex({ step: 'E', octave: 4 }),
};

/** Pitch on the middle staff line, used as the reference for the first note typed. */
export function clefMiddlePitch(clef: ClefType): Pitch {
  return fromDiatonicIndex(CLEF_TOP_LINE[clef] - 4);
}

/**
 * Staff position counted in half-spaces below the top line (0 is the top
 * line, 8 the bottom line, negative values are above the staff).
 */
export function staffPosition(p: Pick<Pitch, 'step' | 'octave'>, clef: ClefType): number {
  return CLEF_TOP_LINE[clef] - diatonicIndex(p);
}

export function pitchAtStaffPosition(position: number, clef: ClefType, fifths: number): Pitch {
  const p = fromDiatonicIndex(CLEF_TOP_LINE[clef] - position);
  return clampPitch({ ...p, alter: keyAlter(p.step, fifths) });
}

/**
 * The octave of `step` closest to `reference`, as when typing letter names:
 * typing E after C4 gives E4, typing A after C4 gives A3.
 */
export function nearestPitchForStep(step: Step, reference: Pitch, fifths: number): Pitch {
  const ref = diatonicIndex(reference);
  const options = [-1, 0, 1].map((o) =>
    fromDiatonicIndex((reference.octave + o) * 7 + STEPS.indexOf(step)),
  );
  const best = options.reduce((a, b) =>
    Math.abs(diatonicIndex(b) - ref) < Math.abs(diatonicIndex(a) - ref) ? b : a,
  );
  return clampPitch({ ...best, alter: keyAlter(step, fifths) });
}

const KEY_NAMES_MAJOR = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const KEY_NAMES_MINOR = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];

/** Major key name for a key signature, e.g. 1 gives "G". */
export function keyName(fifths: number): string {
  return KEY_NAMES_MAJOR[fifths + 7];
}

export function relativeMinorName(fifths: number): string {
  return KEY_NAMES_MINOR[fifths + 7];
}

export function pitchLabel(p: Pitch): string {
  const acc = p.alter > 0 ? '♯'.repeat(p.alter) : '♭'.repeat(-p.alter);
  return `${p.step}${acc}${p.octave}`;
}
