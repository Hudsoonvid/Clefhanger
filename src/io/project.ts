/**
 * The native Clefhanger project format: the score model as JSON, wrapped in
 * a small envelope with a format marker and version so it can be migrated.
 */
import { DURATION_TYPES } from '../model/duration';
import { newId } from '../model/ids';
import { getInstrument } from '../model/instruments';
import { STEPS } from '../model/pitch';
import { normalizeScore } from '../model/score';
import type { ClefType, MusicEvent, Score } from '../model/types';

export const PROJECT_FORMAT = 'clefhanger';
export const PROJECT_VERSION = 1;
export const PROJECT_EXTENSION = '.clef.json';

export interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  version: number;
  savedAt: string;
  score: Score;
}

export function serializeProject(score: Score): string {
  const file: ProjectFile = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    score,
  };
  return JSON.stringify(file, null, 1);
}

export class ProjectError extends Error {}

const CLEFS: ClefType[] = ['treble', 'bass', 'alto', 'tenor'];

function fail(message: string): never {
  throw new ProjectError(message);
}

function checkEvent(e: unknown): MusicEvent {
  const ev = e as MusicEvent;
  if (!ev || typeof ev !== 'object') fail('Invalid event');
  if (!DURATION_TYPES.includes(ev.duration?.type)) fail('Invalid duration');
  const duration = { type: ev.duration.type, dots: Math.max(0, Math.min(2, Number(ev.duration.dots) || 0)) };
  const id = typeof ev.id === 'string' ? ev.id : newId();
  if (ev.kind === 'rest') return { id, kind: 'rest', duration };
  if (ev.kind !== 'note' || !Array.isArray(ev.pitches) || ev.pitches.length === 0) fail('Invalid note');
  const pitches = ev.pitches.map((p) => {
    if (!STEPS.includes(p.step) || !Number.isInteger(p.octave) || !Number.isInteger(p.alter)) fail('Invalid pitch');
    return { step: p.step, octave: p.octave, alter: Math.max(-2, Math.min(2, p.alter)) };
  });
  return ev.tie ? { id, kind: 'note', duration, pitches, tie: true } : { id, kind: 'note', duration, pitches };
}

/** Parse and validate a project file. Throws ProjectError with a readable message. */
export function parseProject(text: string): Score {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    fail('This file is not valid JSON.');
  }
  const file = data as Partial<ProjectFile>;
  if (file?.format !== PROJECT_FORMAT) fail('This is not a Clefhanger project file.');
  if (typeof file.version !== 'number' || file.version > PROJECT_VERSION) {
    fail('This project was saved by a newer version of Clefhanger.');
  }
  const s = file.score as Score;
  if (!s || !Array.isArray(s.parts)) fail('The project has no score.');
  const ts = s.timeSignature;
  if (!ts || !Number.isInteger(ts.beats) || ![1, 2, 4, 8, 16, 32].includes(ts.beatType) || ts.beats < 1 || ts.beats > 32) {
    fail('The project has an invalid time signature.');
  }
  const score: Score = {
    id: typeof s.id === 'string' ? s.id : newId(),
    title: String(s.title ?? ''),
    composer: String(s.composer ?? ''),
    tempo: Number(s.tempo) || 100,
    keySignature: { fifths: Math.max(-7, Math.min(7, Math.round(Number(s.keySignature?.fifths) || 0))) },
    timeSignature: { beats: ts.beats, beatType: ts.beatType },
    parts: s.parts.map((p) => ({
      id: typeof p.id === 'string' ? p.id : newId(),
      name: String(p.name ?? ''),
      abbreviation: String(p.abbreviation ?? ''),
      instrument: getInstrument(String(p.instrument)).id,
      staves: (Array.isArray(p.staves) ? p.staves : []).map((st) => ({
        id: typeof st.id === 'string' ? st.id : newId(),
        clef: CLEFS.includes(st.clef) ? st.clef : 'treble',
        measures: (Array.isArray(st.measures) ? st.measures : []).map((m) => ({
          id: typeof m.id === 'string' ? m.id : newId(),
          events: (Array.isArray(m.events) ? m.events : []).map(checkEvent),
        })),
      })),
    })),
  };
  if (score.parts.some((p) => p.staves.length === 0)) fail('A part in this project has no staves.');
  return normalizeScore(score);
}
