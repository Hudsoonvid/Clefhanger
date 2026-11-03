import { Midi } from '@tonejs/midi';
import { describe as group, expect, it } from 'vitest';
import { exportMidi } from '../../src/io/midi/export';
import { parseProject, ProjectError, serializeProject } from '../../src/io/project';
import { createWelcomeScore } from '../../src/model/demo';
import { addPart } from '../../src/model/operations';
import { createScore } from '../../src/model/score';
import { fill, withoutIds } from '../helpers';

group('MIDI export', () => {
  it('writes tempo, time signature, one track per part and merged ties', () => {
    let score = fill(createScore({ tempo: 90, measures: 2 }), 0, 0, 0, 'C4:h E4:h~');
    score = fill(score, 0, 0, 1, 'E4:q r:q r:h');
    score = addPart(score, 'violin');
    score = fill(score, 1, 0, 1, 'A4:w');

    const midi = new Midi(exportMidi(score));
    expect(Math.round(midi.header.tempos[0].bpm)).toBe(90);
    expect(midi.header.timeSignatures[0].timeSignature).toEqual([4, 4]);
    expect(midi.tracks).toHaveLength(2);
    expect(midi.tracks[1].instrument.number).toBe(40);

    const ppq = midi.header.ppq;
    const piano = midi.tracks[0].notes.map((n) => [n.midi, n.ticks / ppq, n.durationTicks / ppq]);
    expect(piano).toEqual([
      [60, 0, 2],
      [64, 2, 3],
    ]);
    const violin = midi.tracks[1].notes.map((n) => [n.midi, n.ticks / ppq]);
    expect(violin).toEqual([[69, 4]]);
  });

  it('never assigns the percussion channel', () => {
    let score = createScore();
    for (let i = 0; i < 11; i++) score = addPart(score, 'flute');
    const midi = new Midi(exportMidi(score));
    expect(midi.tracks.map((t) => t.channel)).not.toContain(9);
  });
});

group('project files', () => {
  it('round-trips a score exactly, ids included', () => {
    const score = createWelcomeScore();
    expect(parseProject(serializeProject(score))).toEqual(score);
  });

  it('rejects other files with a readable error', () => {
    expect(() => parseProject('not json')).toThrow(ProjectError);
    expect(() => parseProject('{"format":"something-else"}')).toThrow('not a Clefhanger project');
    expect(() => parseProject(JSON.stringify({ format: 'clefhanger', version: 99, score: {} }))).toThrow('newer version');
  });

  it('repairs measures that do not add up', () => {
    const score = createScore({ measures: 1 });
    const file = JSON.parse(serializeProject(score));
    file.score.parts[0].staves[0].measures[0].events = [
      { id: 'a', kind: 'note', duration: { type: 'q', dots: 0 }, pitches: [{ step: 'C', alter: 0, octave: 4 }] },
    ];
    const repaired = parseProject(JSON.stringify(file));
    expect(repaired.parts[0].staves[0].measures[0].events).toHaveLength(3);
    expect(withoutIds(repaired)).toMatchObject({ title: 'Untitled score' });
  });
});
