/**
 * Editor commands. The keyboard shortcuts, toolbar and score clicks all go
 * through these functions, which translate intent into model operations and
 * commit the result as one undoable step.
 */
import {
  addPart,
  addPitch,
  appendMeasures,
  changeDuration,
  deleteMeasures,
  insertMeasures,
  movePart,
  removePart,
  renamePart,
  setClef,
  setKeySignature,
  setMetadata,
  setPitches,
  setTempo,
  setTie,
  setTimeSignature,
  tiedChain,
  toRest,
  writeEvent,
} from '../model/operations';
import {
  clefMiddlePitch,
  keyAlter,
  nearestPitchForStep,
  pitchToMidi,
  samePitch,
  stepDiatonic,
  transposeChromatic,
  transposeOctave,
} from '../model/pitch';
import {
  absoluteTick,
  eventIndexAtTick,
  eventOffset,
  getEvent,
  getMeasure,
  getStaff,
  isValidLocation,
  locationAfter,
  locationBefore,
  measureCount,
  staffAddresses,
} from '../model/score';
import type { ClefType, Duration, DurationType, EventLocation, Pitch, Score, Step, TimeSignature } from '../model/types';
import { playback } from '../playback/engine';
import { commit, setStatus, useEditor } from './store';

const state = () => useEditor.getState();
const fifths = () => state().score.keySignature.fifths;
const currentDuration = (): Duration => ({ type: state().duration, dots: state().dots });

function firstLocation(): EventLocation {
  return { part: 0, staff: 0, measure: 0, event: 0 };
}

function cursor(): EventLocation {
  const s = state();
  return isValidLocation(s.score, s.selection) ? s.selection : firstLocation();
}

/** Where pitch, accidental and tie edits apply. */
function target(): EventLocation | null {
  const s = state();
  if (s.inputMode) return isValidLocation(s.score, s.lastEntered) ? s.lastEntered : null;
  return isValidLocation(s.score, s.selection) ? s.selection : null;
}

/** Location after `loc`, appending a measure when writing off the end of the score. */
function advance(score: Score, loc: EventLocation): { score: Score; next: EventLocation } {
  const next = locationAfter(score, loc);
  if (next) return { score, next };
  const grown = appendMeasures(score, 1);
  return { score: grown, next: { ...loc, measure: loc.measure + 1, event: 0 } };
}

/** The pitch to measure "nearest octave" from: the previous note on this staff. */
function referencePitch(score: Score, loc: EventLocation): Pitch {
  let at: EventLocation | null = loc;
  for (let i = 0; i < 64 && at; i++) {
    at = locationBefore(score, at);
    const e = at ? getEvent(score, at) : undefined;
    if (e?.kind === 'note') return e.pitches[e.pitches.length - 1];
  }
  const staff = getStaff(score, loc);
  return clefMiddlePitch(staff?.clef ?? 'treble');
}

function preview(score: Score, loc: EventLocation | null): void {
  if (!loc || state().playback === 'playing') return;
  const e = getEvent(score, loc);
  if (e?.kind !== 'note') return;
  void playback.preview(score.parts[loc.part].instrument, e.pitches.map(pitchToMidi)).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Note entry
// ---------------------------------------------------------------------------

/** Type a letter name: writes a note in input mode, changes the selected note otherwise. */
export function enterStep(step: Step, addToChord = false): void {
  const s = state();
  if (addToChord) {
    const loc = target() ?? (s.inputMode ? null : cursor());
    const e = loc ? getEvent(s.score, loc) : undefined;
    if (!loc || e?.kind !== 'note') return;
    const pitch = nearestPitchForStep(step, e.pitches[e.pitches.length - 1], fifths());
    const score = addPitch(s.score, loc, pitch);
    commit(score, { lastEntered: s.inputMode ? loc : null });
    preview(score, loc);
    return;
  }
  if (s.inputMode) {
    const loc = cursor();
    const pitch = nearestPitchForStep(step, referencePitch(s.score, loc), fifths());
    writeNote(loc, [pitch]);
    return;
  }
  const loc = cursor();
  const e = getEvent(s.score, loc);
  const reference = e?.kind === 'note' ? e.pitches[e.pitches.length - 1] : referencePitch(s.score, loc);
  const score = setPitches(s.score, loc, [nearestPitchForStep(step, reference, fifths())]);
  commit(score, { selection: loc });
  preview(score, loc);
}

function writeNote(loc: EventLocation, pitches: Pitch[], tie = false): void {
  const s = state();
  const result = writeEvent(s.score, loc, { kind: 'note', pitches, tie }, currentDuration());
  const { score, next } = advance(result.score, result.last);
  commit(score, { selection: next, lastEntered: result.first });
  preview(score, result.first);
}

/** Click on the staff: place a note (input mode) or select (otherwise). */
export function clickAt(loc: EventLocation, pitch: Pitch, addToChord: boolean): void {
  const s = state();
  if (!s.inputMode) {
    select(loc);
    return;
  }
  if (addToChord) {
    const score = addPitch(s.score, loc, pitch);
    commit(score, { selection: s.selection, lastEntered: loc });
    preview(score, loc);
    return;
  }
  const e = getEvent(s.score, loc);
  const sameNote =
    e?.kind === 'note' &&
    e.pitches.length === 1 &&
    samePitch(e.pitches[0], pitch) &&
    e.duration.type === s.duration &&
    e.duration.dots === s.dots;
  if (sameNote) {
    const { score, next } = advance(s.score, loc);
    commit(score, { selection: next, lastEntered: loc });
    preview(score, loc);
    return;
  }
  writeNote(loc, [pitch]);
}

export function enterRest(): void {
  const s = state();
  if (s.inputMode) {
    const result = writeEvent(s.score, cursor(), { kind: 'rest' }, currentDuration());
    const { score, next } = advance(result.score, result.last);
    commit(score, { selection: next });
    return;
  }
  const loc = cursor();
  commit(toRest(s.score, loc), { selection: loc });
}

/** Delete: notes become rests. Backspace in input mode also steps back first. */
export function deleteAtCursor(backspace: boolean): void {
  const s = state();
  let loc: EventLocation | null = cursor();
  if (s.inputMode && backspace) loc = locationBefore(s.score, loc);
  if (!loc) return;
  commit(toRest(s.score, loc), { selection: loc });
}

// ---------------------------------------------------------------------------
// Duration, dots, accidentals, ties, transposition
// ---------------------------------------------------------------------------

export function setDuration(type: DurationType): void {
  useEditor.setState({ duration: type });
  applyDurationToSelection();
}

export function toggleDot(): void {
  useEditor.setState({ dots: state().dots ? 0 : 1 });
  applyDurationToSelection();
}

function applyDurationToSelection(): void {
  const s = state();
  if (s.inputMode || !isValidLocation(s.score, s.selection)) return;
  const result = changeDuration(s.score, s.selection, currentDuration());
  if (result) commit(result.score, { selection: result.first });
}

function editTarget(fn: (score: Score, loc: EventLocation, pitches: Pitch[]) => Pitch[] | null): void {
  const s = state();
  const loc = target();
  const e = loc ? getEvent(s.score, loc) : undefined;
  if (!loc || e?.kind !== 'note') {
    if (!s.inputMode) setStatus('Select a note first');
    return;
  }
  const pitches = fn(s.score, loc, e.pitches);
  if (!pitches) return;
  let score = s.score;
  for (const at of tiedChain(s.score, loc)) score = setPitches(score, at, pitches);
  commit(score, { selection: s.selection, lastEntered: s.inputMode ? loc : null });
  preview(score, loc);
}

/** Sharp (+1), flat (-1) or natural (0) on the target note; applying it twice returns to the key's spelling. */
export function setAccidental(alter: number): void {
  editTarget((_score, _loc, pitches) => {
    const top = pitches[pitches.length - 1];
    const keyDefault = keyAlter(top.step, fifths());
    const next = alter !== 0 && top.alter === alter ? keyDefault : alter;
    return [...pitches.slice(0, -1), { ...top, alter: next }];
  });
}

export type TransposeKind = 'diatonic' | 'chromatic' | 'octave';

export function transpose(kind: TransposeKind, direction: 1 | -1): void {
  editTarget((_score, _loc, pitches) =>
    pitches.map((p) =>
      kind === 'octave'
        ? transposeOctave(p, direction)
        : kind === 'chromatic'
          ? transposeChromatic(p, direction, fifths())
          : stepDiatonic(p, direction, fifths()),
    ),
  );
}

/** Tie: in input mode adds a tied copy of the last note; otherwise toggles the tie. */
export function tie(): void {
  const s = state();
  const loc = target();
  const e = loc ? getEvent(s.score, loc) : undefined;
  if (!loc || e?.kind !== 'note') {
    setStatus('Select a note to tie');
    return;
  }
  if (s.inputMode) {
    // Tie the last note and write its continuation as a single undo step.
    const tied = setTie(s.score, loc, true);
    const result = writeEvent(tied, cursor(), { kind: 'note', pitches: e.pitches }, currentDuration());
    const { score, next } = advance(result.score, result.last);
    commit(score, { selection: next, lastEntered: result.first });
    return;
  }
  commit(setTie(s.score, loc, !e.tie), { selection: loc });
}

// ---------------------------------------------------------------------------
// Selection and navigation
// ---------------------------------------------------------------------------

export function select(loc: EventLocation | null): void {
  useEditor.setState({ selection: loc, lastEntered: null });
}

export function toggleInputMode(force?: boolean): void {
  const s = state();
  const inputMode = force ?? !s.inputMode;
  useEditor.setState({ inputMode, lastEntered: null, selection: s.selection ?? firstLocation() });
  setStatus(inputMode ? 'Note input: click the staff or type A–G' : 'Select mode: click notes to select them');
}

export function moveCursor(direction: 1 | -1, byMeasure = false): void {
  const s = state();
  const loc = cursor();
  let next: EventLocation | null;
  if (byMeasure) {
    const measure = loc.measure + direction;
    next = measure >= 0 && measure < measureCount(s.score) ? { ...loc, measure, event: 0 } : null;
  } else {
    next = direction > 0 ? locationAfter(s.score, loc) : locationBefore(s.score, loc);
  }
  if (next) select(next);
}

export function moveToEdge(end: boolean): void {
  const s = state();
  const loc = cursor();
  const measure = end ? measureCount(s.score) - 1 : 0;
  const m = getMeasure(s.score, { ...loc, measure });
  select({ ...loc, measure, event: end && m ? m.events.length - 1 : 0 });
}

/** Move the cursor to the staff above or below, keeping the beat position. */
export function moveStaff(direction: 1 | -1): void {
  const s = state();
  const loc = cursor();
  const all = staffAddresses(s.score);
  const index = all.findIndex((a) => a.part === loc.part && a.staff === loc.staff);
  const to = all[index + direction];
  if (!to) return;
  const measure = getMeasure(s.score, loc);
  const tick = measure ? eventOffset(measure, loc.event) : 0;
  const target = getMeasure(s.score, { ...to, measure: loc.measure });
  select({ ...to, measure: loc.measure, event: target ? eventIndexAtTick(target, tick) : 0 });
}

// ---------------------------------------------------------------------------
// Measures, score settings and parts
// ---------------------------------------------------------------------------

export function addMeasure(): void {
  const s = state();
  commit(appendMeasures(s.score, 1));
  setStatus(`Added measure ${measureCount(state().score)}`);
}

export function insertMeasureBefore(): void {
  const s = state();
  const loc = cursor();
  commit(insertMeasures(s.score, loc.measure, 1), { selection: { ...loc, event: 0 } });
}

export function deleteMeasure(): void {
  const s = state();
  const loc = cursor();
  if (measureCount(s.score) <= 1) {
    setStatus('A score needs at least one measure', 'error');
    return;
  }
  const score = deleteMeasures(s.score, loc.measure, 1);
  const measure = Math.min(loc.measure, measureCount(score) - 1);
  commit(score, { selection: { ...loc, measure, event: 0 } });
  setStatus(`Deleted measure ${loc.measure + 1}`);
}

export function updateTitle(title: string): void {
  commit(setMetadata(state().score, { title }), { coalesce: 'title' });
}

export function updateComposer(composer: string): void {
  commit(setMetadata(state().score, { composer }), { coalesce: 'composer' });
}

export function updateTempo(bpm: number): void {
  const score = setTempo(state().score, bpm);
  commit(score, { coalesce: 'tempo' });
  playback.setTempo(score.tempo);
}

export function updateKey(f: number): void {
  commit(setKeySignature(state().score, f));
}

export function updateTime(ts: TimeSignature): void {
  const s = state();
  const score = setTimeSignature(s.score, ts);
  commit(score, { selection: { ...cursor(), measure: 0, event: 0 } });
}

export function addInstrument(instrumentId: string): void {
  const s = state();
  const score = addPart(s.score, instrumentId);
  commit(score, { selection: { part: score.parts.length - 1, staff: 0, measure: 0, event: 0 } });
}

export function removeInstrument(index: number): void {
  const s = state();
  if (s.score.parts.length <= 1) {
    setStatus('A score needs at least one instrument', 'error');
    return;
  }
  commit(removePart(s.score, index), { selection: firstLocation() });
}

export function moveInstrument(index: number, delta: number): void {
  commit(movePart(state().score, index, delta), { selection: firstLocation() });
}

export function renameInstrument(index: number, name: string, abbreviation?: string): void {
  commit(renamePart(state().score, index, name, abbreviation), { coalesce: `rename-${index}` });
}

export function changeClef(part: number, staff: number, clef: ClefType): void {
  commit(setClef(state().score, part, staff, clef));
}

/** Playback starts at the beginning of the selected measure, or of the score. */
export function playbackStartTick(): number {
  const s = state();
  return isValidLocation(s.score, s.selection) ? absoluteTick(s.score, { ...s.selection, event: 0 }) : 0;
}
