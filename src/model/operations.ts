/**
 * Pure editing operations. Each takes a Score and returns a new Score (via
 * immer, so unchanged branches are shared); none of them touch the DOM.
 */
import { produce, type Draft } from 'immer';
import { beatTicks, durationFromTicks, durationTicks, fillTicks, measureTicks } from './duration';
import { newId } from './ids';
import { samePitch, sortPitches } from './pitch';
import {
  capacity,
  clampTempo,
  createEmptyMeasure,
  createPart,
  eventOffset,
  eventTicks,
  getEvent,
  locationAfter,
  measureCount,
  mergeRests,
  restsFor,
  withDuration,
} from './score';
import type {
  ClefType,
  Duration,
  EventLocation,
  Measure,
  MusicEvent,
  NoteEvent,
  Pitch,
  Score,
  TimeSignature,
} from './types';

export type EventTemplate = { kind: 'note'; pitches: Pitch[]; tie?: boolean } | { kind: 'rest' };

export interface WriteResult {
  score: Score;
  /** The first event written. */
  first: EventLocation;
  /** The last event written (differs from `first` when a note was split across a barline). */
  last: EventLocation;
}

function fromTemplate(template: EventTemplate, duration: Duration, tie: boolean): MusicEvent {
  if (template.kind === 'rest') return { id: newId(), kind: 'rest', duration: { ...duration } };
  const e: NoteEvent = {
    id: newId(),
    kind: 'note',
    pitches: sortPitches(template.pitches),
    duration: { ...duration },
  };
  if (tie) e.tie = true;
  return e;
}

export function templateOf(e: MusicEvent): EventTemplate {
  return e.kind === 'rest' ? { kind: 'rest' } : { kind: 'note', pitches: e.pitches, tie: e.tie };
}

/**
 * Replace whatever occupies [start, start + length of newEvents) in a measure
 * with `newEvents`. Partially covered events leave rests behind. Returns the
 * index of the first new event.
 */
function overwrite(measure: Draft<Measure>, start: number, newEvents: MusicEvent[], beat: number): number {
  const events = measure.events;
  let i = 0;
  let t = 0;
  while (i < events.length && t < start) {
    t += eventTicks(events[i]);
    i++;
  }
  if (t > start) {
    // `start` falls inside event i-1: shorten it so it ends at `start`.
    const prev = events[i - 1];
    const prevStart = t - eventTicks(prev);
    const head = fillTicks(prevStart, start - prevStart, beat).map((d, k, all) =>
      withDuration(prev, d, k < all.length - 1, k === 0),
    );
    events.splice(i - 1, 1, ...head);
    i = i - 1 + head.length;
    t = start;
  }
  const end = start + newEvents.reduce((n, e) => n + eventTicks(e), 0);
  let j = i;
  let u = t;
  while (j < events.length && u < end) {
    u += eventTicks(events[j]);
    j++;
  }
  const tail = u > end ? restsFor(end, u - end, beat) : [];
  events.splice(i, j - i, ...newEvents, ...tail);
  return i;
}

function appendMeasureDraft(draft: Draft<Score>): void {
  for (const part of draft.parts) {
    for (const staff of part.staves) staff.measures.push(createEmptyMeasure(draft.timeSignature));
  }
}

/**
 * Write a note or rest of `duration` at `loc`, overwriting what was there
 * (the way most notation editors' input mode works). Values that cross the
 * barline are split into tied notes, and measures are appended as needed.
 */
export function writeEvent(
  score: Score,
  loc: EventLocation,
  template: EventTemplate,
  duration: Duration,
): WriteResult {
  const cap = capacity(score);
  const beat = beatTicks(score.timeSignature);
  const measure = score.parts[loc.part].staves[loc.staff].measures[loc.measure];
  const start = eventOffset(measure, loc.event);
  const total = durationTicks(duration);

  const pieces: { measure: number; start: number; durations: Duration[] }[] = [];
  if (start + total <= cap) {
    pieces.push({ measure: loc.measure, start, durations: [duration] });
  } else {
    pieces.push({ measure: loc.measure, start, durations: fillTicks(start, cap - start, beat) });
    let remaining = total - (cap - start);
    let m = loc.measure + 1;
    while (remaining > 0) {
      const len = Math.min(remaining, cap);
      const exact = len === remaining ? durationFromTicks(len) : null;
      pieces.push({ measure: m, start: 0, durations: exact ? [exact] : fillTicks(0, len, beat) });
      remaining -= len;
      m++;
    }
  }

  const needed = pieces[pieces.length - 1].measure + 1;
  const pieceCount = pieces.reduce((n, p) => n + p.durations.length, 0);
  let first = loc;
  let last = loc;
  const next = produce(score, (draft) => {
    while (draft.parts[0].staves[0].measures.length < needed) appendMeasureDraft(draft);
    const staff = draft.parts[loc.part].staves[loc.staff];
    let written = 0;
    pieces.forEach((piece, pi) => {
      const events = piece.durations.map((d) => {
        written++;
        const tie = written < pieceCount || (template.kind === 'note' && !!template.tie);
        return fromTemplate(template, d, tie);
      });
      const index = overwrite(staff.measures[piece.measure], piece.start, events, beat);
      if (pi === 0) first = { ...loc, measure: piece.measure, event: index };
      last = { ...loc, measure: piece.measure, event: index + events.length - 1 };
    });
  });
  return { score: next, first, last };
}

/** Change an event's length in place, overwriting or freeing up what follows. */
export function changeDuration(score: Score, loc: EventLocation, duration: Duration): WriteResult | null {
  const e = getEvent(score, loc);
  if (!e) return null;
  return writeEvent(score, loc, templateOf(e), duration);
}

function updateEvent(score: Score, loc: EventLocation, fn: (e: Draft<MusicEvent>) => void): Score {
  if (!getEvent(score, loc)) return score;
  return produce(score, (draft) => {
    fn(draft.parts[loc.part].staves[loc.staff].measures[loc.measure].events[loc.event]);
  });
}

/** Replace the pitches of a note (or turn a rest into a note). */
export function setPitches(score: Score, loc: EventLocation, pitches: Pitch[]): Score {
  if (pitches.length === 0) return toRest(score, loc);
  const unique = pitches.filter((p, i) => pitches.findIndex((q) => samePitch(p, q)) === i);
  return produce(score, (draft) => {
    const events = draft.parts[loc.part].staves[loc.staff].measures[loc.measure].events;
    const e = events[loc.event];
    if (!e) return;
    if (e.kind === 'note') {
      e.pitches = sortPitches(unique);
    } else {
      events[loc.event] = { id: e.id, kind: 'note', duration: e.duration, pitches: sortPitches(unique) };
    }
  });
}

/** Add a pitch to a note, making a chord. */
export function addPitch(score: Score, loc: EventLocation, pitch: Pitch): Score {
  const e = getEvent(score, loc);
  if (!e) return score;
  if (e.kind === 'rest') return setPitches(score, loc, [pitch]);
  if (e.pitches.some((p) => samePitch(p, pitch))) return score;
  return setPitches(score, loc, [...e.pitches, pitch]);
}

export function setTie(score: Score, loc: EventLocation, tie: boolean): Score {
  return updateEvent(score, loc, (e) => {
    if (e.kind !== 'note') return;
    if (tie) e.tie = true;
    else delete e.tie;
  });
}

export function toRest(score: Score, loc: EventLocation): Score {
  return produce(score, (draft) => {
    const events = draft.parts[loc.part].staves[loc.staff].measures[loc.measure].events;
    const e = events[loc.event];
    if (e && e.kind === 'note') events[loc.event] = { id: e.id, kind: 'rest', duration: e.duration };
  });
}

/**
 * The event at `loc` plus every following note it is tied to, so that
 * transposing a tied note keeps the whole tie chain together.
 */
export function tiedChain(score: Score, loc: EventLocation): EventLocation[] {
  const chain = [loc];
  let current = getEvent(score, loc);
  let at: EventLocation | null = loc;
  while (current && current.kind === 'note' && current.tie && at) {
    const nextLoc = locationAfter(score, at);
    const next = nextLoc ? getEvent(score, nextLoc) : undefined;
    if (!nextLoc || !next || next.kind !== 'note') break;
    const pitches: Pitch[] = current.pitches;
    const same = next.pitches.length === pitches.length && next.pitches.every((p, i) => samePitch(p, pitches[i]));
    if (!same) break;
    chain.push(nextLoc);
    current = next;
    at = nextLoc;
  }
  return chain;
}

// ---------------------------------------------------------------------------
// Measures
// ---------------------------------------------------------------------------

export function insertMeasures(score: Score, index: number, count = 1): Score {
  return produce(score, (draft) => {
    const at = Math.max(0, Math.min(index, measureCount(score)));
    for (const part of draft.parts) {
      for (const staff of part.staves) {
        const fresh = Array.from({ length: count }, () => createEmptyMeasure(draft.timeSignature));
        staff.measures.splice(at, 0, ...fresh);
      }
    }
  });
}

export function appendMeasures(score: Score, count = 1): Score {
  return insertMeasures(score, measureCount(score), count);
}

/** Delete measures. A score always keeps at least one (empty) measure. */
export function deleteMeasures(score: Score, index: number, count = 1): Score {
  return produce(score, (draft) => {
    for (const part of draft.parts) {
      for (const staff of part.staves) {
        staff.measures.splice(index, count);
        if (staff.measures.length === 0) staff.measures.push(createEmptyMeasure(draft.timeSignature));
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Score-wide settings
// ---------------------------------------------------------------------------

export function setMetadata(score: Score, meta: { title?: string; composer?: string }): Score {
  return produce(score, (draft) => {
    if (meta.title !== undefined) draft.title = meta.title;
    if (meta.composer !== undefined) draft.composer = meta.composer;
  });
}

export function setTempo(score: Score, bpm: number): Score {
  return produce(score, (draft) => {
    draft.tempo = clampTempo(bpm);
  });
}

export function setKeySignature(score: Score, fifths: number): Score {
  return produce(score, (draft) => {
    draft.keySignature = { fifths: Math.max(-7, Math.min(7, Math.round(fifths))) };
  });
}

/**
 * Re-bar one staff's music into measures of a new length, splitting notes
 * that now cross a barline into tied notes.
 */
function rebar(measures: Measure[], newCap: number, beat: number): Measure[] {
  const out: MusicEvent[][] = [[]];
  let t = 0;
  for (const e of measures.flatMap((m) => m.events)) {
    let remaining = eventTicks(e);
    let firstPiece = true;
    while (remaining > 0) {
      const len = Math.min(newCap - t, remaining);
      const durations =
        firstPiece && len === remaining && durationTicks(e.duration) === len ? [e.duration] : fillTicks(t, len, beat);
      durations.forEach((d, i) => {
        const endsEvent = len === remaining && i === durations.length - 1;
        const tie = e.kind === 'note' && (endsEvent ? !!e.tie : true);
        out[out.length - 1].push(withDuration(e, d, tie, firstPiece && i === 0));
      });
      t += len;
      remaining -= len;
      firstPiece = false;
      if (t >= newCap) {
        out.push([]);
        t = 0;
      }
    }
  }
  if (out[out.length - 1].length === 0) out.pop();
  if (out.length === 0) out.push([]);
  const last = out[out.length - 1];
  const used = last.reduce((n, e) => n + eventTicks(e), 0);
  if (used < newCap) last.push(...restsFor(used, newCap - used, beat));
  return out.map((events, i) => ({ id: measures[i]?.id ?? newId(), events: mergeRests(events, beat) }));
}

export function setTimeSignature(score: Score, ts: TimeSignature): Score {
  if (ts.beats === score.timeSignature.beats && ts.beatType === score.timeSignature.beatType) return score;
  const newCap = measureTicks(ts);
  const rebarred = score.parts.map((p) => p.staves.map((s) => rebar(s.measures, newCap, beatTicks(ts))));
  const count = Math.max(...rebarred.flat().map((m) => m.length));
  return produce(score, (draft) => {
    draft.timeSignature = { ...ts };
    draft.parts.forEach((part, pi) =>
      part.staves.forEach((staff, si) => {
        const measures = rebarred[pi][si];
        while (measures.length < count) measures.push(createEmptyMeasure(ts));
        staff.measures = measures;
      }),
    );
  });
}

// ---------------------------------------------------------------------------
// Parts and staves
// ---------------------------------------------------------------------------

export function addPart(score: Score, instrumentId: string, index = score.parts.length): Score {
  const part = createPart(instrumentId, measureCount(score), score.timeSignature);
  return produce(score, (draft) => {
    draft.parts.splice(index, 0, part);
  });
}

/** Remove a part. The last remaining part cannot be removed. */
export function removePart(score: Score, index: number): Score {
  if (score.parts.length <= 1) return score;
  return produce(score, (draft) => {
    draft.parts.splice(index, 1);
  });
}

export function movePart(score: Score, index: number, delta: number): Score {
  const to = index + delta;
  if (to < 0 || to >= score.parts.length || delta === 0) return score;
  return produce(score, (draft) => {
    const [part] = draft.parts.splice(index, 1);
    draft.parts.splice(to, 0, part);
  });
}

export function renamePart(score: Score, index: number, name: string, abbreviation?: string): Score {
  return produce(score, (draft) => {
    const part = draft.parts[index];
    if (!part) return;
    part.name = name;
    if (abbreviation !== undefined) part.abbreviation = abbreviation;
  });
}

export function setClef(score: Score, part: number, staff: number, clef: ClefType): Score {
  return produce(score, (draft) => {
    const s = draft.parts[part]?.staves[staff];
    if (s) s.clef = clef;
  });
}
