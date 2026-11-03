import { describe as group, expect, it } from 'vitest';
import { measureTicks } from '../../src/model/duration';
import { parsePitch } from '../../src/model/notation';
import {
  addPart,
  addPitch,
  changeDuration,
  deleteMeasures,
  insertMeasures,
  movePart,
  removePart,
  setPitches,
  setTie,
  setTimeSignature,
  tiedChain,
  toRest,
  writeEvent,
} from '../../src/model/operations';
import {
  createScore,
  eventTicks,
  locationAfter,
  locationBefore,
  measureCount,
  normalizeScore,
} from '../../src/model/score';
import { createWelcomeScore } from '../../src/model/demo';
import type { Score } from '../../src/model/types';
import { fill, staffText } from '../helpers';

const q = { type: 'q', dots: 0 } as const;
const h = { type: 'h', dots: 0 } as const;
const loc = (measure: number, event: number, part = 0, staff = 0) => ({ part, staff, measure, event });
const C4 = { kind: 'note' as const, pitches: [parsePitch('C4')] };

function assertFull(score: Score) {
  const cap = measureTicks(score.timeSignature);
  const count = measureCount(score);
  for (const part of score.parts) {
    for (const staff of part.staves) {
      expect(staff.measures).toHaveLength(count);
      for (const m of staff.measures) {
        expect(m.events.reduce((n, e) => n + eventTicks(e), 0)).toBe(cap);
      }
    }
  }
}

group('createScore', () => {
  it('creates full measures of rests for every staff', () => {
    const score = createScore({ instruments: ['piano', 'violin'], measures: 4 });
    expect(score.parts).toHaveLength(2);
    expect(score.parts[0].staves.map((s) => s.clef)).toEqual(['treble', 'bass']);
    expect(score.parts[1].staves.map((s) => s.clef)).toEqual(['treble']);
    expect(staffText(score)).toEqual(['r:w', 'r:w', 'r:w', 'r:w']);
    assertFull(score);
  });

  it('fills odd meters with the right rests', () => {
    const score = createScore({ timeSignature: { beats: 3, beatType: 4 }, measures: 1 });
    expect(staffText(score)).toEqual(['r:h.']);
  });

  it('builds a valid welcome score', () => {
    assertFull(createWelcomeScore());
  });
});

group('writeEvent (overwrite input)', () => {
  it('writes a note over a rest and leaves the remainder as rests', () => {
    const score = createScore({ measures: 2 });
    const { score: next, first } = writeEvent(score, loc(0, 0), C4, q);
    expect(staffText(next)[0]).toBe('C4:q r:q r:h');
    expect(first).toEqual(loc(0, 0));
    assertFull(next);
  });

  it('overwrites following notes when the new value is longer', () => {
    const score = fill(createScore({ measures: 1 }), 0, 0, 0, 'C4:q D4:q E4:q F4:q');
    const { score: next } = writeEvent(score, loc(0, 1), { kind: 'note', pitches: [parsePitch('G4')] }, h);
    expect(staffText(next)[0]).toBe('C4:q G4:h F4:q');
  });

  it('turns a partially covered note tail into rests', () => {
    const score = fill(createScore({ measures: 1 }), 0, 0, 0, 'C4:h D4:h');
    const { score: next } = writeEvent(score, loc(0, 1), C4, { type: '8', dots: 0 });
    expect(staffText(next)[0]).toBe('C4:h C4:8 r:8 r:q');
  });

  it('splits values across the barline with a tie', () => {
    const score = fill(createScore({ measures: 2 }), 0, 0, 0, 'C4:h. r:q');
    const { score: next, first, last } = writeEvent(score, loc(0, 1), { kind: 'note', pitches: [parsePitch('E4')] }, h);
    expect(staffText(next)).toEqual(['C4:h. E4:q~', 'E4:q r:q r:h']);
    expect(first).toEqual(loc(0, 1));
    expect(last).toEqual(loc(1, 0));
    assertFull(next);
  });

  it('appends measures when writing past the end', () => {
    const score = createScore({ measures: 1 });
    const { score: next } = writeEvent(score, loc(0, 0), C4, { type: 'w', dots: 1 });
    expect(measureCount(next)).toBe(2);
    expect(staffText(next)).toEqual(['C4:w~', 'C4:h r:h']);
    // Every other staff grows too.
    assertFull(next);
  });

  it('does not mutate the original score', () => {
    const score = createScore({ measures: 1 });
    const before = JSON.stringify(score);
    writeEvent(score, loc(0, 0), C4, q);
    expect(JSON.stringify(score)).toBe(before);
  });
});

group('event edits', () => {
  it('changes duration shorter and longer', () => {
    const score = fill(createScore({ measures: 1 }), 0, 0, 0, 'C4:h D4:q E4:q');
    expect(staffText(changeDuration(score, loc(0, 0), q)!.score)[0]).toBe('C4:q r:q D4:q E4:q');
    expect(staffText(changeDuration(score, loc(0, 0), { type: 'h', dots: 1 })!.score)[0]).toBe('C4:h. E4:q');
  });

  it('adds chord tones and keeps them sorted', () => {
    const score = fill(createScore({ measures: 1 }), 0, 0, 0, 'E4:w');
    const next = addPitch(addPitch(score, loc(0, 0), parsePitch('C4')), loc(0, 0), parsePitch('G4'));
    expect(staffText(next)[0]).toBe('C4+E4+G4:w');
    // Adding a duplicate is a no-op.
    expect(addPitch(next, loc(0, 0), parsePitch('E4'))).toBe(next);
  });

  it('turns rests into notes and notes into rests', () => {
    const score = createScore({ measures: 1 });
    const withNote = setPitches(score, loc(0, 0), [parsePitch('A4')]);
    expect(staffText(withNote)[0]).toBe('A4:w');
    expect(staffText(toRest(withNote, loc(0, 0)))[0]).toBe('r:w');
  });

  it('toggles ties and follows tie chains', () => {
    let score = fill(createScore({ measures: 2 }), 0, 0, 0, 'C4:h C4:h');
    score = fill(score, 0, 0, 1, 'C4:h D4:h');
    score = setTie(score, loc(0, 0), true);
    score = setTie(score, loc(0, 1), true);
    expect(tiedChain(score, loc(0, 0))).toEqual([loc(0, 0), loc(0, 1), loc(1, 0)]);
    score = setTie(score, loc(0, 1), false);
    expect(tiedChain(score, loc(0, 0))).toEqual([loc(0, 0), loc(0, 1)]);
  });
});

group('measures', () => {
  it('inserts and deletes measures on every staff', () => {
    const score = fill(createScore({ instruments: ['piano', 'flute'], measures: 2 }), 0, 0, 1, 'C4:w');
    const inserted = insertMeasures(score, 1, 2);
    expect(measureCount(inserted)).toBe(4);
    expect(staffText(inserted)).toEqual(['r:w', 'r:w', 'r:w', 'C4:w']);
    assertFull(inserted);
    const deleted = deleteMeasures(inserted, 0, 3);
    expect(staffText(deleted)).toEqual(['C4:w']);
    // Never deletes the last measure.
    expect(measureCount(deleteMeasures(deleted, 0, 1))).toBe(1);
  });

  it('navigates across measures', () => {
    const score = fill(createScore({ measures: 2 }), 0, 0, 0, 'C4:h D4:h');
    expect(locationAfter(score, loc(0, 1))).toEqual(loc(1, 0));
    expect(locationBefore(score, loc(1, 0))).toEqual(loc(0, 1));
    expect(locationAfter(score, loc(1, 0))).toBeNull();
  });
});

group('setTimeSignature', () => {
  it('re-bars music and ties notes over the new barlines', () => {
    const score = fill(createScore({ measures: 2 }), 0, 0, 0, 'C4:q D4:q E4:h');
    const next = setTimeSignature(score, { beats: 3, beatType: 4 });
    expect(staffText(next)).toEqual(['C4:q D4:q E4:q~', 'E4:q r:q r:q', 'r:h.']);
    assertFull(next);
  });

  it('keeps every staff the same length', () => {
    const score = createScore({ instruments: ['piano', 'violin'], measures: 3 });
    const next = setTimeSignature(score, { beats: 6, beatType: 8 });
    assertFull(next);
  });
});

group('parts', () => {
  it('adds, moves and removes parts', () => {
    let score = createScore({ measures: 3 });
    score = addPart(score, 'violin');
    score = addPart(score, 'cello');
    expect(score.parts.map((p) => p.name)).toEqual(['Piano', 'Violin', 'Cello']);
    assertFull(score);
    score = movePart(score, 2, -1);
    expect(score.parts.map((p) => p.name)).toEqual(['Piano', 'Cello', 'Violin']);
    score = removePart(score, 0);
    expect(score.parts.map((p) => p.name)).toEqual(['Cello', 'Violin']);
    score = removePart(removePart(score, 0), 0);
    expect(score.parts).toHaveLength(1);
  });
});

group('normalizeScore', () => {
  it('pads short measures, trims long ones and equalises staff lengths', () => {
    const score = createScore({ instruments: ['violin', 'cello'], measures: 1 });
    const broken: Score = JSON.parse(JSON.stringify(score));
    broken.parts[0].staves[0].measures[0].events = fill(score, 0, 0, 0, 'C4:q').parts[0].staves[0].measures[0].events;
    broken.parts[1].staves[0].measures[0].events = fill(score, 1, 0, 0, 'C3:w D3:q').parts[1].staves[0].measures[0].events;
    broken.parts[1].staves[0].measures.push({ id: 'x', events: [] });
    const fixed = normalizeScore(broken);
    expect(staffText(fixed, 0)).toEqual(['C4:q r:q r:h', 'r:w']);
    expect(staffText(fixed, 1)).toEqual(['C3:w', 'r:w']);
  });
});
