import type { ClefType } from './types';

export type InstrumentFamily = 'keyboard' | 'strings' | 'woodwind' | 'brass' | 'plucked' | 'voice';

export interface InstrumentDef {
  id: string;
  name: string;
  abbreviation: string;
  /** One clef per staff. */
  clefs: ClefType[];
  /** General MIDI program, 0-based. */
  midiProgram: number;
  family: InstrumentFamily;
}

/**
 * Built-in instruments. Everything is written at concert pitch for now;
 * transposing instruments are a planned feature.
 */
export const INSTRUMENTS: InstrumentDef[] = [
  { id: 'piano', name: 'Piano', abbreviation: 'Pno.', clefs: ['treble', 'bass'], midiProgram: 0, family: 'keyboard' },
  { id: 'organ', name: 'Organ', abbreviation: 'Org.', clefs: ['treble', 'bass'], midiProgram: 19, family: 'keyboard' },
  { id: 'violin', name: 'Violin', abbreviation: 'Vln.', clefs: ['treble'], midiProgram: 40, family: 'strings' },
  { id: 'viola', name: 'Viola', abbreviation: 'Vla.', clefs: ['alto'], midiProgram: 41, family: 'strings' },
  { id: 'cello', name: 'Cello', abbreviation: 'Vc.', clefs: ['bass'], midiProgram: 42, family: 'strings' },
  { id: 'contrabass', name: 'Contrabass', abbreviation: 'Cb.', clefs: ['bass'], midiProgram: 43, family: 'strings' },
  { id: 'flute', name: 'Flute', abbreviation: 'Fl.', clefs: ['treble'], midiProgram: 73, family: 'woodwind' },
  { id: 'oboe', name: 'Oboe', abbreviation: 'Ob.', clefs: ['treble'], midiProgram: 68, family: 'woodwind' },
  { id: 'clarinet', name: 'Clarinet', abbreviation: 'Cl.', clefs: ['treble'], midiProgram: 71, family: 'woodwind' },
  { id: 'bassoon', name: 'Bassoon', abbreviation: 'Bsn.', clefs: ['bass'], midiProgram: 70, family: 'woodwind' },
  { id: 'alto-sax', name: 'Alto Saxophone', abbreviation: 'A. Sax.', clefs: ['treble'], midiProgram: 65, family: 'woodwind' },
  { id: 'trumpet', name: 'Trumpet', abbreviation: 'Tpt.', clefs: ['treble'], midiProgram: 56, family: 'brass' },
  { id: 'horn', name: 'Horn', abbreviation: 'Hn.', clefs: ['treble'], midiProgram: 60, family: 'brass' },
  { id: 'trombone', name: 'Trombone', abbreviation: 'Tbn.', clefs: ['bass'], midiProgram: 57, family: 'brass' },
  { id: 'tuba', name: 'Tuba', abbreviation: 'Tba.', clefs: ['bass'], midiProgram: 58, family: 'brass' },
  { id: 'guitar', name: 'Guitar', abbreviation: 'Gtr.', clefs: ['treble'], midiProgram: 24, family: 'plucked' },
  { id: 'bass-guitar', name: 'Bass Guitar', abbreviation: 'B. Gtr.', clefs: ['bass'], midiProgram: 33, family: 'plucked' },
  { id: 'harp', name: 'Harp', abbreviation: 'Hp.', clefs: ['treble', 'bass'], midiProgram: 46, family: 'plucked' },
  { id: 'soprano', name: 'Soprano', abbreviation: 'S.', clefs: ['treble'], midiProgram: 52, family: 'voice' },
  { id: 'alto', name: 'Alto', abbreviation: 'A.', clefs: ['treble'], midiProgram: 52, family: 'voice' },
  { id: 'tenor', name: 'Tenor', abbreviation: 'T.', clefs: ['treble'], midiProgram: 52, family: 'voice' },
  { id: 'bass-voice', name: 'Bass', abbreviation: 'B.', clefs: ['bass'], midiProgram: 52, family: 'voice' },
];

const BY_ID = new Map(INSTRUMENTS.map((i) => [i.id, i]));

export function getInstrument(id: string): InstrumentDef {
  return BY_ID.get(id) ?? INSTRUMENTS[0];
}

/** Best guess at a built-in instrument from a part name and/or GM program (used by importers). */
export function guessInstrument(name: string, midiProgram: number | null): InstrumentDef {
  const lower = name.toLowerCase();
  const byName = [...INSTRUMENTS]
    .sort((a, b) => b.name.length - a.name.length)
    .find((i) => lower.includes(i.name.toLowerCase()));
  if (byName) return byName;
  if (midiProgram !== null) {
    const byProgram = INSTRUMENTS.find((i) => i.midiProgram === midiProgram);
    if (byProgram) return byProgram;
  }
  return INSTRUMENTS[0];
}
