import { describe as group, expect, it } from 'vitest';
import { addPart } from '../../src/model/operations';
import { createScore } from '../../src/model/score';
import { buildTimeline } from '../../src/model/timeline';
import { fill } from '../helpers';

group('buildTimeline', () => {
  it('lays out notes in absolute ticks and skips rests', () => {
    const score = fill(createScore({ measures: 2 }), 0, 0, 1, 'C4:q r:q E4:h');
    const { notes, totalTicks } = buildTimeline(score);
    expect(totalTicks).toBe(3840);
    expect(notes).toEqual([
      { part: 0, staff: 0, midi: 60, startTick: 1920, durationTicks: 480 },
      { part: 0, staff: 0, midi: 64, startTick: 2880, durationTicks: 960 },
    ]);
  });

  it('merges tied notes, including across barlines', () => {
    let score = fill(createScore({ measures: 2 }), 0, 0, 0, 'r:h C4:h~');
    score = fill(score, 0, 0, 1, 'C4:q~ C4:q D4:h');
    const { notes } = buildTimeline(score);
    expect(notes.map((n) => [n.midi, n.startTick, n.durationTicks])).toEqual([
      [60, 960, 1920],
      [62, 2880, 960],
    ]);
  });

  it('only ties the chord tones that continue', () => {
    const score = fill(createScore({ measures: 1 }), 0, 0, 0, 'C4+E4:h~ C4+G4:h');
    const { notes } = buildTimeline(score);
    expect(notes.map((n) => [n.midi, n.startTick, n.durationTicks])).toEqual([
      [60, 0, 1920],
      [64, 0, 960],
      [67, 960, 960],
    ]);
  });

  it('includes every staff and part', () => {
    let score = fill(createScore({ measures: 1 }), 0, 1, 0, 'C3:w');
    score = addPart(score, 'flute');
    score = fill(score, 1, 0, 0, 'G5:w');
    const { notes, events } = buildTimeline(score);
    expect(notes.map((n) => [n.part, n.staff, n.midi])).toEqual([
      [0, 1, 48],
      [1, 0, 79],
    ]);
    expect(events).toHaveLength(3);
  });
});
