/**
 * The Clefhanger score model.
 *
 * This is the single source of truth for a piece of music. It is plain,
 * serialisable data with no references to rendering, audio or the DOM, so the
 * renderer, playback engine and file formats can all be swapped or extended
 * independently. Edits never mutate a Score; operations return a new one.
 */

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export interface Pitch {
  step: Step;
  /** Chromatic alteration in semitones: -2 (double flat) … +2 (double sharp). */
  alter: number;
  /** Scientific pitch notation octave. Middle C is C4. */
  octave: number;
}

export type DurationType = 'w' | 'h' | 'q' | '8' | '16' | '32';

export interface Duration {
  type: DurationType;
  /** Augmentation dots, 0–2. */
  dots: number;
}

export type ClefType = 'treble' | 'bass' | 'alto' | 'tenor';

/** Major-mode key signature expressed as a position on the circle of fifths (-7 … 7). */
export interface KeySignature {
  fifths: number;
}

export interface TimeSignature {
  beats: number;
  beatType: number;
}

interface BaseEvent {
  id: string;
  duration: Duration;
}

export interface NoteEvent extends BaseEvent {
  kind: 'note';
  /** One pitch for a single note, several for a chord. Kept sorted low to high. */
  pitches: Pitch[];
  /** Tie into the next event on the same staff when it shares a pitch. */
  tie?: boolean;
}

export interface RestEvent extends BaseEvent {
  kind: 'rest';
}

export type MusicEvent = NoteEvent | RestEvent;

/**
 * A measure on one staff. Invariant: the events always fill the measure
 * exactly (gaps are explicit rests), which keeps rendering and playback simple.
 */
export interface Measure {
  id: string;
  events: MusicEvent[];
}

export interface Staff {
  id: string;
  clef: ClefType;
  measures: Measure[];
}

export interface Part {
  id: string;
  name: string;
  abbreviation: string;
  instrument: string;
  staves: Staff[];
}

export interface Score {
  id: string;
  title: string;
  composer: string;
  /** Quarter notes per minute. */
  tempo: number;
  keySignature: KeySignature;
  timeSignature: TimeSignature;
  parts: Part[];
}

/** Address of a single event in a score. */
export interface EventLocation {
  part: number;
  staff: number;
  measure: number;
  event: number;
}
