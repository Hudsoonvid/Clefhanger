import type { InstrumentFamily } from '../model/instruments';

type Tone = typeof import('tone');

/**
 * Synthesised instrument sounds. Everything is generated in the browser, so
 * playback works offline and never fetches samples from a third party.
 */
export function createInstrumentSynth(Tone: Tone, family: InstrumentFamily, output: import('tone').ToneAudioNode) {
  const lowpass = (freq: number) => new Tone.Filter(freq, 'lowpass').connect(output);
  switch (family) {
    case 'keyboard': {
      const synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2,
        modulationIndex: 1.6,
        envelope: { attack: 0.002, decay: 1.4, sustain: 0.08, release: 1.1 },
        modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0.1, release: 0.6 },
      });
      synth.volume.value = -9;
      return synth.connect(lowpass(5000));
    }
    case 'strings': {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 16 },
        envelope: { attack: 0.12, decay: 0.2, sustain: 0.85, release: 0.6 },
      });
      synth.volume.value = -17;
      return synth.connect(lowpass(2400));
    }
    case 'woodwind': {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fattriangle', count: 2, spread: 8 },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.9, release: 0.25 },
      });
      synth.volume.value = -10;
      return synth.connect(lowpass(3500));
    }
    case 'brass': {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 2, spread: 10 },
        envelope: { attack: 0.06, decay: 0.2, sustain: 0.75, release: 0.3 },
      });
      synth.volume.value = -16;
      return synth.connect(lowpass(1700));
    }
    case 'plucked': {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.6 },
      });
      synth.volume.value = -6;
      return synth.connect(lowpass(4000));
    }
    case 'voice': {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsine', count: 3, spread: 14 },
        envelope: { attack: 0.15, decay: 0.2, sustain: 0.8, release: 0.5 },
      });
      synth.volume.value = -11;
      return synth.connect(lowpass(3000));
    }
  }
}

export type InstrumentSynth = ReturnType<typeof createInstrumentSynth>;
