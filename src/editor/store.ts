import { create } from 'zustand';
import { clampLocation, isValidLocation } from '../model/score';
import type { DurationType, EventLocation, Score } from '../model/types';

export type PlaybackState = 'stopped' | 'playing' | 'paused';

interface Snapshot {
  score: Score;
  selection: EventLocation | null;
}

export interface EditorState {
  score: Score;
  /** In note input mode this is the insertion cursor; otherwise the selected event. */
  selection: EventLocation | null;
  /** The note most recently written in input mode; arrows, accidentals and ties act on it. */
  lastEntered: EventLocation | null;
  inputMode: boolean;
  duration: DurationType;
  dots: number;

  past: Snapshot[];
  future: Snapshot[];
  /** Consecutive commits with the same key (e.g. dragging the tempo slider) share one undo step. */
  coalesceKey: string | null;
  coalesceAt: number;

  playback: PlaybackState;
  playingIds: string[];

  status: { text: string; tone: 'info' | 'error'; at: number } | null;
  fileName: string | null;
  savedLocallyAt: number | null;
}

const HISTORY_LIMIT = 200;
const COALESCE_MS = 1200;

export const useEditor = create<EditorState>(() => ({
  score: { id: '', title: '', composer: '', tempo: 100, keySignature: { fifths: 0 }, timeSignature: { beats: 4, beatType: 4 }, parts: [] },
  selection: null,
  lastEntered: null,
  inputMode: true,
  duration: 'q',
  dots: 0,
  past: [],
  future: [],
  coalesceKey: null,
  coalesceAt: 0,
  playback: 'stopped',
  playingIds: [],
  status: null,
  fileName: null,
  savedLocallyAt: null,
}));

export interface CommitOptions {
  selection?: EventLocation | null;
  lastEntered?: EventLocation | null;
  coalesce?: string;
}

/** Apply a new score as one undoable step. */
export function commit(score: Score, options: CommitOptions = {}): void {
  const s = useEditor.getState();
  const selection = options.selection !== undefined ? options.selection : s.selection;
  const lastEntered = options.lastEntered !== undefined ? options.lastEntered : null;
  if (score === s.score) {
    useEditor.setState({ selection, lastEntered });
    return;
  }
  const now = Date.now();
  const merge = !!options.coalesce && options.coalesce === s.coalesceKey && now - s.coalesceAt < COALESCE_MS;
  const past = merge ? s.past : [...s.past, { score: s.score, selection: s.selection }].slice(-HISTORY_LIMIT);
  useEditor.setState({
    score,
    selection,
    lastEntered,
    past,
    future: [],
    coalesceKey: options.coalesce ?? null,
    coalesceAt: now,
  });
}

function restore(score: Score, selection: EventLocation | null): Partial<EditorState> {
  const valid = selection && score.parts.length > 0 ? clampLocation(score, selection) : null;
  return { score, selection: isValidLocation(score, valid) ? valid : null, lastEntered: null, coalesceKey: null };
}

export function undo(): void {
  const s = useEditor.getState();
  const prev = s.past[s.past.length - 1];
  if (!prev) return;
  useEditor.setState({
    ...restore(prev.score, prev.selection),
    past: s.past.slice(0, -1),
    future: [{ score: s.score, selection: s.selection }, ...s.future],
  });
}

export function redo(): void {
  const s = useEditor.getState();
  const next = s.future[0];
  if (!next) return;
  useEditor.setState({
    ...restore(next.score, next.selection),
    past: [...s.past, { score: s.score, selection: s.selection }],
    future: s.future.slice(1),
  });
}

/** Replace the whole document (new, open, import). Clears history. */
export function loadDocument(score: Score, fileName: string | null = null): void {
  useEditor.setState({
    score,
    selection: { part: 0, staff: 0, measure: 0, event: 0 },
    lastEntered: null,
    past: [],
    future: [],
    coalesceKey: null,
    fileName,
    playingIds: [],
  });
}

export function setStatus(text: string, tone: 'info' | 'error' = 'info'): void {
  useEditor.setState({ status: { text, tone, at: Date.now() } });
}
