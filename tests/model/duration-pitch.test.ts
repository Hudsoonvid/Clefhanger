import { describe as group, expect, it } from 'vitest';
import { durationFromTicks, durationTicks, fillTicks, measureTicks } from '../../src/model/duration';
import {
  keyAlter,
  nearestPitchForStep,
  pitchAtStaffPosition,
  pitchToMidi,
  spellMidi,
  staffPosition,
  stepDiatonic,
  transposeChromatic,
} from '../../src/model/pitch';
import { parsePitch } from '../../src/model/notation';

group('durations', () => {
  it('converts durations to ticks, including dots', () => {
    expect(durationTicks({ type: 'q', dots: 0 })).toBe(480);
    expect(durationTicks({ type: 'q', dots: 1 })).toBe(720);
    expect(durationTicks({ type: 'h', dots: 2 })).toBe(1680);
    expect(durationTicks({ type: '32', dots: 0 })).toBe(60);
  });

  it('computes measure lengths', () => {
    expect(measureTicks({ beats: 4, beatType: 4 })).toBe(1920);
    expect(measureTicks({ beats: 6, beatType: 8 })).toBe(1440);
    expect(measureTicks({ beats: 2, beatType: 2 })).toBe(1920);
  });

  it('finds the duration for an exact tick count', () => {
    expect(durationFromTicks(1440)).toEqual({ type: 'h', dots: 1 });
    expect(durationFromTicks(480)).toEqual({ type: 'q', dots: 0 });
    expect(durationFromTicks(100)).toBeNull();
  });

  it('splits gaps on the beat', () => {
    // Three beats starting on beat 2 of 4/4: quarter then half.
    expect(fillTicks(480, 1440)).toEqual([
      { type: 'q', dots: 0 },
      { type: 'h', dots: 0 },
    ]);
    // A full bar of 3/4 is a dotted half.
    expect(fillTicks(0, 1440)).toEqual([{ type: 'h', dots: 1 }]);
    // The second half of a 6/8 bar is a dotted quarter.
    expect(fillTicks(720, 720, 720)).toEqual([{ type: 'q', dots: 1 }]);
    // ...but the second half of beat 2 in 3/4 is an eighth then a quarter.
    expect(fillTicks(720, 720, 480)).toEqual([
      { type: '8', dots: 0 },
      { type: 'q', dots: 0 },
    ]);
    // An offbeat eighth then the rest of the bar.
    expect(fillTicks(240, 1680)).toEqual([
      { type: '8', dots: 0 },
      { type: 'q', dots: 0 },
      { type: 'h', dots: 0 },
    ]);
  });
});

group('pitches', () => {
  it('converts to MIDI numbers', () => {
    expect(pitchToMidi(parsePitch('C4'))).toBe(60);
    expect(pitchToMidi(parsePitch('A4'))).toBe(69);
    expect(pitchToMidi(parsePitch('Bb3'))).toBe(58);
    expect(pitchToMidi(parsePitch('B#3'))).toBe(60);
  });

  it('knows key signature accidentals', () => {
    expect(keyAlter('F', 1)).toBe(1);
    expect(keyAlter('C', 1)).toBe(0);
    expect(keyAlter('B', -1)).toBe(-1);
    expect(keyAlter('A', -3)).toBe(-1);
    expect(keyAlter('D', -3)).toBe(0);
  });

  it('steps diatonically within the key', () => {
    expect(stepDiatonic(parsePitch('E4'), 1, 1)).toEqual(parsePitch('F#4'));
    expect(stepDiatonic(parsePitch('B4'), 1, 0)).toEqual(parsePitch('C5'));
    expect(stepDiatonic(parsePitch('C4'), -1, -1)).toEqual(parsePitch('Bb3'));
  });

  it('spells chromatic steps with sharps going up and flats going down', () => {
    expect(transposeChromatic(parsePitch('C4'), 1, 0)).toEqual(parsePitch('C#4'));
    expect(transposeChromatic(parsePitch('D4'), -1, 0)).toEqual(parsePitch('Db4'));
    // In F major B-flat is in the key, so it wins over A-sharp.
    expect(transposeChromatic(parsePitch('A4'), 1, -1)).toEqual(parsePitch('Bb4'));
    expect(spellMidi(71, -7, false)).toEqual(parsePitch('Cb5'));
  });

  it('maps staff positions to pitches per clef', () => {
    expect(staffPosition(parsePitch('F5'), 'treble')).toBe(0);
    expect(staffPosition(parsePitch('E4'), 'treble')).toBe(8);
    expect(staffPosition(parsePitch('G2'), 'bass')).toBe(8);
    expect(pitchAtStaffPosition(4, 'alto', 0)).toEqual(parsePitch('C4'));
    expect(pitchAtStaffPosition(10, 'treble', 0)).toEqual(parsePitch('C4'));
    expect(pitchAtStaffPosition(0, 'treble', 2)).toEqual(parsePitch('F#5'));
  });

  it('picks the nearest octave when typing letter names', () => {
    expect(nearestPitchForStep('E', parsePitch('C4'), 0)).toEqual(parsePitch('E4'));
    expect(nearestPitchForStep('A', parsePitch('C4'), 0)).toEqual(parsePitch('A3'));
    expect(nearestPitchForStep('B', parsePitch('C5'), 0)).toEqual(parsePitch('B4'));
    expect(nearestPitchForStep('F', parsePitch('E4'), 2)).toEqual(parsePitch('F#4'));
  });
});
