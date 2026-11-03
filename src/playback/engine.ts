/**
 * Playback with Tone.js. Tone is loaded on first use so it does not slow down
 * the initial page load. Notes are scheduled on the Transport in ticks, so
 * changing the tempo mid-playback takes effect immediately.
 */
import { TICKS_PER_QUARTER } from '../model/duration';
import { getInstrument, type InstrumentFamily } from '../model/instruments';
import { buildTimeline, type TimelineEvent } from '../model/timeline';
import type { Score } from '../model/types';
import { createInstrumentSynth, type InstrumentSynth } from './sounds';

type ToneNS = typeof import('tone');

export interface PlaybackCallbacks {
  /** Events that start at this moment (fired in sync with the audio). */
  onEvents(events: TimelineEvent[]): void;
  onEnd(): void;
}

let tonePromise: Promise<ToneNS> | null = null;
const loadTone = () => (tonePromise ??= import('tone'));

class PlaybackEngine {
  private tone: ToneNS | null = null;
  private output: import('tone').ToneAudioNode | null = null;
  private synths = new Map<InstrumentFamily, InstrumentSynth>();
  private callbacks: PlaybackCallbacks | null = null;

  private async ready(): Promise<ToneNS> {
    const Tone = await loadTone();
    await Tone.start();
    if (!this.output) {
      this.output = new Tone.Limiter(-2).toDestination();
      this.tone = Tone;
    }
    return Tone;
  }

  private synth(family: InstrumentFamily): InstrumentSynth {
    let synth = this.synths.get(family);
    if (!synth) {
      synth = createInstrumentSynth(this.tone!, family, this.output!);
      this.synths.set(family, synth);
    }
    return synth;
  }

  async play(score: Score, fromTick: number, callbacks: PlaybackCallbacks): Promise<void> {
    const Tone = await this.ready();
    const transport = Tone.getTransport();
    this.reset();
    this.callbacks = callbacks;
    transport.PPQ = TICKS_PER_QUARTER;
    transport.bpm.value = score.tempo;

    const timeline = buildTimeline(score);
    for (const note of timeline.notes) {
      if (note.startTick < fromTick) continue;
      const synth = this.synth(getInstrument(score.parts[note.part].instrument).family);
      const freq = Tone.Frequency(note.midi, 'midi').toFrequency();
      transport.schedule((time) => {
        const seconds = Tone.Ticks(note.durationTicks).toSeconds();
        synth.triggerAttackRelease(freq, Math.max(0.05, seconds * 0.96), time, 0.75);
      }, `${note.startTick}i`);
    }

    const byTick = new Map<number, TimelineEvent[]>();
    for (const e of timeline.events) {
      if (e.tick < fromTick) continue;
      byTick.set(e.tick, [...(byTick.get(e.tick) ?? []), e]);
    }
    const draw = Tone.getDraw();
    for (const [tick, events] of byTick) {
      transport.schedule((time) => draw.schedule(() => this.callbacks?.onEvents(events), time), `${tick}i`);
    }
    transport.schedule((time) => draw.schedule(() => this.finish(), time), `${timeline.totalTicks}i`);
    transport.start('+0.05', `${fromTick}i`);
  }

  pause(): void {
    if (!this.tone) return;
    this.tone.getTransport().pause();
    this.releaseAll();
  }

  resume(): void {
    this.tone?.getTransport().start('+0.02');
  }

  stop(): void {
    this.reset();
    this.callbacks = null;
  }

  setTempo(bpm: number): void {
    if (this.tone) this.tone.getTransport().bpm.value = bpm;
  }

  /** Short audition of a note or chord while editing. */
  async preview(instrumentId: string, midis: number[]): Promise<void> {
    if (midis.length === 0) return;
    const Tone = await this.ready();
    const synth = this.synth(getInstrument(instrumentId).family);
    const freqs = midis.map((m) => Tone.Frequency(m, 'midi').toFrequency());
    synth.triggerAttackRelease(freqs, 0.4, Tone.now() + 0.01, 0.6);
  }

  private finish(): void {
    const callbacks = this.callbacks;
    this.reset();
    this.callbacks = null;
    callbacks?.onEnd();
  }

  private reset(): void {
    if (!this.tone) return;
    const transport = this.tone.getTransport();
    transport.stop();
    transport.cancel(0);
    transport.position = 0;
    this.releaseAll();
  }

  private releaseAll(): void {
    for (const synth of this.synths.values()) synth.releaseAll();
  }
}

export const playback = new PlaybackEngine();
