import { parseEvents } from './notation';
import { createScore, normalizeScore } from './score';
import type { Score } from './types';

/** A short original piece shown on first launch so there is something to play. */
export function createWelcomeScore(): Score {
  const score = createScore({ title: 'Welcome to Clefhanger', tempo: 96, measures: 8 });
  const right = [
    'E4:q G4:q C5:h',
    'B4:q A4:8 G4:8 A4:h',
    'F4:q A4:q D5:q. C5:8',
    'B4:q G4:q C5:h~',
    'C5:q E5:8 D5:8 C5:q B4:q',
    'A4:h. r:q',
  ];
  const left = [
    'C3+G3:w',
    'F2+C3:w',
    'D3+A3:h G2+D3:h',
    'G2+D3:h C3+G3:h~',
    'C3+G3:h G2+D3:h',
    'A2+E3:h. r:q',
  ];
  const [treble, bass] = score.parts[0].staves;
  right.forEach((text, i) => (treble.measures[i] = { ...treble.measures[i], events: parseEvents(text) }));
  left.forEach((text, i) => (bass.measures[i] = { ...bass.measures[i], events: parseEvents(text) }));
  return normalizeScore(score);
}
