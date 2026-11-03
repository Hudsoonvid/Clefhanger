import { beatTicks, durationTicks, fillTicks, measureTicks, TICKS_PER_QUARTER } from './duration';
import { newId } from './ids';
import { getInstrument } from './instruments';
import { sortPitches } from './pitch';
import type {
  ClefType,
  Duration,
  EventLocation,
  KeySignature,
  Measure,
  MusicEvent,
  NoteEvent,
  Part,
  Pitch,
  RestEvent,
  Score,
  Staff,
  TimeSignature,
} from './types';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function makeRest(duration: Duration): RestEvent {
  return { id: newId(), kind: 'rest', duration: { ...duration } };
}

export function makeNote(pitches: Pitch[], duration: Duration, tie = false): NoteEvent {
  const note: NoteEvent = {
    id: newId(),
    kind: 'note',
    pitches: sortPitches(pitches),
    duration: { ...duration },
  };
  if (tie) note.tie = true;
  return note;
}

/** Rests that exactly fill `length` ticks starting at measure offset `start`. */
export function restsFor(start: number, length: number, beat = TICKS_PER_QUARTER): RestEvent[] {
  return fillTicks(start, length, beat).map(makeRest);
}

export function createEmptyMeasure(ts: TimeSignature): Measure {
  return { id: newId(), events: restsFor(0, measureTicks(ts), beatTicks(ts)) };
}

export function createStaff(clef: ClefType, measures: number, ts: TimeSignature): Staff {
  return {
    id: newId(),
    clef,
    measures: Array.from({ length: measures }, () => createEmptyMeasure(ts)),
  };
}

export function createPart(instrumentId: string, measures: number, ts: TimeSignature): Part {
  const def = getInstrument(instrumentId);
  return {
    id: newId(),
    name: def.name,
    abbreviation: def.abbreviation,
    instrument: def.id,
    staves: def.clefs.map((clef) => createStaff(clef, measures, ts)),
  };
}

export interface CreateScoreOptions {
  title?: string;
  composer?: string;
  tempo?: number;
  keySignature?: KeySignature;
  timeSignature?: TimeSignature;
  instruments?: string[];
  measures?: number;
}

export function createScore(options: CreateScoreOptions = {}): Score {
  const timeSignature = options.timeSignature ?? { beats: 4, beatType: 4 };
  const measures = Math.max(1, options.measures ?? 8);
  return {
    id: newId(),
    title: options.title ?? 'Untitled score',
    composer: options.composer ?? '',
    tempo: options.tempo ?? 100,
    keySignature: options.keySignature ?? { fifths: 0 },
    timeSignature,
    parts: (options.instruments ?? ['piano']).map((id) => createPart(id, measures, timeSignature)),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function eventTicks(e: MusicEvent): number {
  return durationTicks(e.duration);
}

export function measureCount(score: Score): number {
  return score.parts[0]?.staves[0]?.measures.length ?? 0;
}

export function capacity(score: Score): number {
  return measureTicks(score.timeSignature);
}

export function getStaff(score: Score, loc: Pick<EventLocation, 'part' | 'staff'>): Staff | undefined {
  return score.parts[loc.part]?.staves[loc.staff];
}

export function getMeasure(score: Score, loc: Omit<EventLocation, 'event'>): Measure | undefined {
  return getStaff(score, loc)?.measures[loc.measure];
}

export function getEvent(score: Score, loc: EventLocation): MusicEvent | undefined {
  return getMeasure(score, loc)?.events[loc.event];
}

/** Tick offset of an event from the start of its measure. */
export function eventOffset(measure: Measure, index: number): number {
  let t = 0;
  for (let i = 0; i < index && i < measure.events.length; i++) t += eventTicks(measure.events[i]);
  return t;
}

/** Absolute tick at which the event at `loc` starts. */
export function absoluteTick(score: Score, loc: EventLocation): number {
  const measure = getMeasure(score, loc);
  return loc.measure * capacity(score) + (measure ? eventOffset(measure, loc.event) : 0);
}

/** Index of the event sounding at `tick` (measure offset) in a measure. */
export function eventIndexAtTick(measure: Measure, tick: number): number {
  let t = 0;
  for (let i = 0; i < measure.events.length; i++) {
    t += eventTicks(measure.events[i]);
    if (tick < t) return i;
  }
  return Math.max(0, measure.events.length - 1);
}

export function isValidLocation(score: Score, loc: EventLocation | null): loc is EventLocation {
  return !!loc && !!getEvent(score, loc);
}

/** Nearest valid location, e.g. after an undo removed measures. */
export function clampLocation(score: Score, loc: EventLocation): EventLocation {
  const part = Math.min(Math.max(0, loc.part), score.parts.length - 1);
  const staff = Math.min(Math.max(0, loc.staff), score.parts[part].staves.length - 1);
  const measure = Math.min(Math.max(0, loc.measure), measureCount(score) - 1);
  const events = score.parts[part].staves[staff].measures[measure].events.length;
  const event = Math.min(Math.max(0, loc.event), events - 1);
  return { part, staff, measure, event };
}

export function locationAfter(score: Score, loc: EventLocation): EventLocation | null {
  const measure = getMeasure(score, loc);
  if (!measure) return null;
  if (loc.event + 1 < measure.events.length) return { ...loc, event: loc.event + 1 };
  if (loc.measure + 1 < measureCount(score)) return { ...loc, measure: loc.measure + 1, event: 0 };
  return null;
}

export function locationBefore(score: Score, loc: EventLocation): EventLocation | null {
  if (loc.event > 0) return { ...loc, event: loc.event - 1 };
  if (loc.measure > 0) {
    const prev = getMeasure(score, { ...loc, measure: loc.measure - 1 });
    if (prev) return { ...loc, measure: loc.measure - 1, event: prev.events.length - 1 };
  }
  return null;
}

/** All staves in score order, flattened. Useful for moving between staves. */
export function staffAddresses(score: Score): { part: number; staff: number }[] {
  return score.parts.flatMap((p, part) => p.staves.map((_, staff) => ({ part, staff })));
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** Copy of an event with a new duration (and optionally a new id and tie flag). */
export function withDuration(e: MusicEvent, duration: Duration, tie?: boolean, keepId = true): MusicEvent {
  const id = keepId ? e.id : newId();
  if (e.kind === 'rest') return { id, kind: 'rest', duration: { ...duration } };
  const note: NoteEvent = { id, kind: 'note', pitches: e.pitches.map((p) => ({ ...p })), duration: { ...duration } };
  if (tie ?? e.tie) note.tie = true;
  return note;
}

/**
 * Make a list of events fill exactly `cap` ticks: events that overflow are
 * shortened (tied where they are split) or dropped, and gaps become rests.
 */
export function fitEvents(events: MusicEvent[], cap: number, beat = TICKS_PER_QUARTER): MusicEvent[] {
  const out: MusicEvent[] = [];
  let t = 0;
  for (const e of events) {
    const len = eventTicks(e);
    if (t + len <= cap) {
      out.push(e);
      t += len;
      continue;
    }
    const pieces = fillTicks(t, cap - t, beat);
    pieces.forEach((d, i) => out.push(withDuration(e, d, i < pieces.length - 1 ? true : e.kind === 'note' && e.tie, i === 0)));
    t = cap;
    break;
  }
  if (t < cap) out.push(...restsFor(t, cap - t, beat));
  return out;
}

/** Rewrite each run of consecutive rests as the tidiest rests for that span. */
export function mergeRests(events: MusicEvent[], beat = TICKS_PER_QUARTER): MusicEvent[] {
  const out: MusicEvent[] = [];
  let t = 0;
  let runStart = -1;
  const flush = (end: number) => {
    if (runStart >= 0) out.push(...restsFor(runStart, end - runStart, beat));
    runStart = -1;
  };
  for (const e of events) {
    if (e.kind === 'rest') {
      if (runStart < 0) runStart = t;
    } else {
      flush(t);
      out.push(e);
    }
    t += eventTicks(e);
  }
  flush(t);
  return out;
}

/**
 * Repair a score so it satisfies the model invariants: every measure is full,
 * every staff has the same number of measures, chords are sorted and there is
 * at least one part. Used after loading or importing files.
 */
export function normalizeScore(score: Score): Score {
  const cap = measureTicks(score.timeSignature);
  const beat = beatTicks(score.timeSignature);
  const parts = score.parts.length > 0 ? score.parts : createScore({ timeSignature: score.timeSignature }).parts;
  const count = Math.max(1, ...parts.flatMap((p) => p.staves.map((s) => s.measures.length)));
  return {
    ...score,
    tempo: clampTempo(score.tempo),
    parts: parts.map((part) => ({
      ...part,
      staves: part.staves.map((staff) => {
        const measures = staff.measures.map((m) => ({
          ...m,
          events: fitEvents(
            m.events.map((e) => (e.kind === 'note' ? { ...e, pitches: sortPitches(e.pitches) } : e)),
            cap,
            beat,
          ),
        }));
        while (measures.length < count) measures.push(createEmptyMeasure(score.timeSignature));
        return { ...staff, measures };
      }),
    })),
  };
}

export function clampTempo(bpm: number): number {
  if (!Number.isFinite(bpm)) return 100;
  return Math.round(Math.min(400, Math.max(20, bpm)));
}
