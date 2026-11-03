/**
 * A tiny text shorthand for writing events by hand, used for the welcome
 * score and in tests:
 *
 *   "C4:q E4:8 G4:8. r:16 C4+E4+G4:h~ Bb3:q F#5:w"
 *
 * Each token is `pitches:duration`. Pitches are a letter, optional
 * accidentals (# ## b bb) and an octave, joined with + for chords, or `r` for
 * a rest. The duration is w h q 8 16 32, followed by dots and an optional ~
 * meaning "tie to the next note".
 */
import { makeNote, makeRest } from './score';
import type { DurationType, MusicEvent, Pitch, Step } from './types';

const PITCH = /^([A-G])(##|#|bb|b)?(-?\d)$/;
const DURATION = /^(w|h|q|8|16|32)(\.{0,2})(~?)$/;

export function parsePitch(text: string): Pitch {
  const m = PITCH.exec(text);
  if (!m) throw new Error(`Bad pitch "${text}"`);
  const acc = m[2] ?? '';
  const alter = acc === '#' ? 1 : acc === '##' ? 2 : acc === 'b' ? -1 : acc === 'bb' ? -2 : 0;
  return { step: m[1] as Step, alter, octave: Number(m[3]) };
}

export function parseEvents(text: string): MusicEvent[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const [pitchPart, durPart] = token.split(':');
      const d = DURATION.exec(durPart ?? '');
      if (!d) throw new Error(`Bad duration in "${token}"`);
      const duration = { type: d[1] as DurationType, dots: d[2].length };
      if (pitchPart === 'r') return makeRest(duration);
      return makeNote(pitchPart.split('+').map(parsePitch), duration, d[3] === '~');
    });
}
