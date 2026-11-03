import { Midi } from '@tonejs/midi';
import { TICKS_PER_QUARTER } from '../../model/duration';
import { getInstrument } from '../../model/instruments';
import { keyName } from '../../model/pitch';
import { buildTimeline } from '../../model/timeline';
import type { Score } from '../../model/types';

/** Standard MIDI File (type 1): one track per part, ties merged into single notes. */
export function exportMidi(score: Score): Uint8Array {
  const midi = new Midi();
  const scale = midi.header.ppq / TICKS_PER_QUARTER;
  midi.header.name = score.title;
  midi.header.setTempo(score.tempo);
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [score.timeSignature.beats, score.timeSignature.beatType],
  });
  midi.header.keySignatures.push({ ticks: 0, key: keyName(score.keySignature.fifths), scale: 'major' });
  midi.header.update();

  const { notes } = buildTimeline(score);
  score.parts.forEach((part, index) => {
    const track = midi.addTrack();
    track.name = part.name;
    // Channel 10 (index 9) is reserved for percussion in General MIDI.
    track.channel = index >= 9 ? (index + 1) % 16 : index;
    track.instrument.number = getInstrument(part.instrument).midiProgram;
    for (const n of notes) {
      if (n.part !== index) continue;
      track.addNote({
        midi: n.midi,
        ticks: Math.round(n.startTick * scale),
        durationTicks: Math.round(n.durationTicks * scale),
        velocity: 0.75,
      });
    }
  });
  return midi.toArray();
}
